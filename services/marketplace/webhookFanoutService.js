const crypto = require("crypto");
const axios = require("axios");
const mongoose = require("mongoose");
const MarketplaceWebhookEndpoint = require("../../models/marketplaceWebhookEndpointModel");
const MarketplaceWebhookDelivery = require("../../models/marketplaceWebhookDeliveryModel");
const { decryptSecret } = require("../../utils/secretCrypto");
const { eventBus, EventTypes } = require("../../events");
const {
  buildWebhookEventPayloads,
  buildWebhookV2Envelope,
  createStableEventId,
} = require("./webhookEventBuilder");
const {
  buildTimestampedSignatureHeader,
  assertSecureWebhookUrl,
} = require("./webhookSecurity");

const MAX_ATTEMPTS = 5;
const RETRY_DELAYS_MIN = [1, 5, 15, 30, 60];
const DISPATCH_LEASE_MS = 30 * 1000;

let retryTimer = null;

const webhookMetrics = {
  dispatchAttempts: 0,
  successCount: 0,
  failureCount: 0,
  retryCount: 0,
  deadLetterCount: 0,
  totalLatencyMs: 0,
};

const shouldSendLegacyWebhook = () => {
  const envValue = String(process.env.MARKETPLACE_WEBHOOK_LEGACY_ENABLED || "true").toLowerCase();
  return envValue !== "false";
};

const shouldSendV2Webhook = () => {
  const envValue = String(process.env.MARKETPLACE_WEBHOOK_V2_ENABLED || "true").toLowerCase();
  return envValue !== "false";
};

const shouldDualRunWebhook = () => {
  const envValue = String(process.env.MARKETPLACE_WEBHOOK_DUAL_RUN || "false").toLowerCase();
  return envValue === "true";
};

const toIdString = (value) => {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (value.toString) return value.toString();
  return "";
};

const emitWebhookLog = (level, details) => {
  const logger = console[level] || console.log;
  logger(
    JSON.stringify({
      service: "marketplace_webhook",
      ...details,
    }),
  );
};

const buildSignature = (secret, body) => {
  return crypto.createHmac("sha256", secret).update(body).digest("hex");
};

const claimDeliveryForDispatch = async (deliveryId) => {
  const now = new Date();
  const leaseOwner = crypto.randomBytes(12).toString("hex");
  const leaseExpiresAt = new Date(now.getTime() + DISPATCH_LEASE_MS);

  const claimed = await MarketplaceWebhookDelivery.findOneAndUpdate(
    {
      _id: deliveryId,
      status: "pending",
      $and: [
        {
          $or: [{ nextRetryAt: null }, { nextRetryAt: { $lte: now } }],
        },
        {
          $or: [
            { "dispatchLease.expiresAt": null },
            { "dispatchLease.expiresAt": { $lte: now } },
            { "dispatchLease.owner": "" },
          ],
        },
      ],
    },
    {
      $set: {
        "dispatchLease.owner": leaseOwner,
        "dispatchLease.claimedAt": now,
        "dispatchLease.expiresAt": leaseExpiresAt,
      },
    },
    {
      new: true,
    },
  );

  if (!claimed) {
    return null;
  }

  return {
    delivery: claimed,
    leaseOwner,
  };
};

const shouldSendForEvent = (endpoint, eventType) => {
  const subscriptions = Array.isArray(endpoint.subscribedEvents)
    ? endpoint.subscribedEvents
    : [];

  if (subscriptions.length === 0) return false;
  if (subscriptions.includes("marketplace.*") && eventType.startsWith("marketplace.")) {
    return true;
  }

  return subscriptions.includes(eventType);
};

const extractOrderContext = (delivery) => {
  const payloadData = delivery?.payload?.data || {};
  const orderSnapshot = payloadData?.order || null;
  const orderId =
    payloadData?.orderId
    || orderSnapshot?._id
    || null;

  if (!orderId) {
    return {
      orderId: null,
      order: null,
      orderNumber: "",
    };
  }

  return {
    orderId: String(orderId),
    order: orderSnapshot,
    orderNumber: orderSnapshot?.orderNumber || payloadData?.orderNumber || "",
  };
};

const markDeliverySuccess = async (delivery, responseCode, responseBody = "", leaseOwner = "") => {
  const completedAt = new Date();
  const startedAt = delivery.updatedAt || delivery.createdAt || completedAt;
  const latencyMs = Math.max(0, completedAt.getTime() - new Date(startedAt).getTime());

  await MarketplaceWebhookDelivery.findOneAndUpdate(
    {
      _id: delivery._id,
      ...(leaseOwner ? { "dispatchLease.owner": leaseOwner } : {}),
    },
    {
    $set: {
      status: "success",
      attemptCount: Number(delivery.attemptCount || 0) + 1,
      responseCode,
      responseBody: String(responseBody).substring(0, 5000),
      deliveredAt: completedAt,
      nextRetryAt: null,
      errorMessage: "",
      dispatchLease: {
        owner: "",
        claimedAt: null,
        expiresAt: null,
      },
    },
  });

  await MarketplaceWebhookEndpoint.findByIdAndUpdate(delivery.endpoint, {
    $set: {
      lastDeliveredAt: new Date(),
      failureCount: 0,
    },
  });

  const orderContext = extractOrderContext(delivery);

  webhookMetrics.successCount += 1;
  webhookMetrics.totalLatencyMs += latencyMs;

  emitWebhookLog("info", {
    action: "delivery_success",
    eventId: delivery.eventId,
    correlationId: delivery.correlationId,
    orderId: orderContext.orderId,
    deliveryId: toIdString(delivery._id),
    responseCode,
    latencyMs,
    attemptCount: Number(delivery.attemptCount || 0) + 1,
  });

  eventBus.emitBusinessEvent(
    EventTypes.MARKETPLACE_WEBHOOK_DELIVERY_SUCCEEDED,
    delivery.business.toString(),
    {
      deliveryId: delivery._id.toString(),
      eventType: delivery.eventType,
      responseCode,
      orderId: orderContext.orderId,
      orderNumber: orderContext.orderNumber,
      order: orderContext.order,
    },
    { source: "webhook_fanout" },
  );
};

const markDeliveryFailure = async (
  delivery,
  errorMessage,
  responseCode = null,
  leaseOwner = "",
) => {
  const nextAttempt = Number(delivery.attemptCount || 0) + 1;
  const exhausted = nextAttempt >= MAX_ATTEMPTS;

  const nextRetryAt = exhausted
    ? null
    : new Date(Date.now() + getRetryDelayMinutes(nextAttempt) * 60 * 1000);

  await MarketplaceWebhookDelivery.findOneAndUpdate(
    {
      _id: delivery._id,
      ...(leaseOwner ? { "dispatchLease.owner": leaseOwner } : {}),
    },
    {
    $set: {
      status: exhausted ? "dead_letter" : "pending",
      attemptCount: nextAttempt,
      responseCode,
      errorMessage: String(errorMessage || "Webhook delivery failed").substring(0, 2000),
      nextRetryAt,
      deadLetteredAt: exhausted ? new Date() : null,
      dispatchLease: {
        owner: "",
        claimedAt: null,
        expiresAt: null,
      },
    },
  });

  await MarketplaceWebhookEndpoint.findByIdAndUpdate(delivery.endpoint, {
    $inc: { failureCount: 1 },
  });

  const orderContext = extractOrderContext(delivery);

  webhookMetrics.failureCount += 1;
  if (!exhausted) {
    webhookMetrics.retryCount += 1;
  } else {
    webhookMetrics.deadLetterCount += 1;
  }

  emitWebhookLog("warn", {
    action: exhausted ? "delivery_dead_letter" : "delivery_failure",
    eventId: delivery.eventId,
    correlationId: delivery.correlationId,
    orderId: orderContext.orderId,
    deliveryId: toIdString(delivery._id),
    errorMessage,
    responseCode,
    attemptCount: nextAttempt,
    exhausted,
  });

  eventBus.emitBusinessEvent(
    EventTypes.MARKETPLACE_WEBHOOK_DELIVERY_FAILED,
    delivery.business.toString(),
    {
      deliveryId: delivery._id.toString(),
      eventType: delivery.eventType,
      attemptCount: nextAttempt,
      exhausted,
      errorMessage,
      orderId: orderContext.orderId,
      orderNumber: orderContext.orderNumber,
      order: orderContext.order,
    },
    { source: "webhook_fanout" },
  );
};

const deliverWebhook = async (delivery, leaseOwner = "") => {
  const endpoint = await MarketplaceWebhookEndpoint.findById(delivery.endpoint).select(
    "+secretCiphertext +nextSecretCiphertext",
  );
  if (!endpoint || endpoint.status !== "active") {
    await markDeliveryFailure(delivery, "Endpoint is inactive or missing", null, leaseOwner);
    return;
  }

  try {
    assertSecureWebhookUrl(endpoint.url);
  } catch (error) {
    await markDeliveryFailure(
      delivery,
      error.message || "Endpoint URL is not secure",
      null,
      leaseOwner,
    );
    return;
  }

  const secret = decryptSecret(endpoint.secretCiphertext);
  if (!secret) {
    await markDeliveryFailure(delivery, "Endpoint signing secret unavailable", null, leaseOwner);
    return;
  }

  const overlapActive =
    endpoint.secretOverlapUntil
    && new Date(endpoint.secretOverlapUntil).getTime() > Date.now();
  const nextSecret = overlapActive ? decryptSecret(endpoint.nextSecretCiphertext || "") : "";

  const serializedBody = JSON.stringify(delivery.payload || {});
  const signature = buildSignature(secret, serializedBody);
  const correlationId =
    delivery.correlationId
    || delivery.payload?.metadata?.correlationId
    || delivery.payload?.correlationId
    || delivery.payload?.data?.partnerOrderRef
    || "";
  const eventTimestamp = Math.floor(Date.now() / 1000);
  const timestampedSignature = buildTimestampedSignatureHeader({
    payload: serializedBody,
    currentSecret: secret,
    nextSecret,
    unixTimestamp: eventTimestamp,
  });

  webhookMetrics.dispatchAttempts += 1;

  try {
    const response = await axios.post(endpoint.url, delivery.payload, {
      timeout: 8000,
      headers: {
        "content-type": "application/json",
        "x-marketplace-event-type": delivery.eventType,
        "x-marketplace-event-id": delivery.eventId,
        "x-marketplace-delivery-id": delivery._id.toString(),
        "x-marketplace-event-timestamp": String(eventTimestamp),
        "x-correlation-id": correlationId || undefined,
        "x-marketplace-signature": timestampedSignature,
        "x-marketplace-signature-v1": signature,
        "x-provider-signature": signature,
        "x-marketplace-schema-version": delivery.schemaVersion || "1.0.0",
      },
      validateStatus: () => true,
    });

    if (response.status >= 200 && response.status < 300) {
      await markDeliverySuccess(delivery, response.status, response.data, leaseOwner);
      return;
    }

    await markDeliveryFailure(
      delivery,
      `Webhook responded with non-2xx status: ${response.status}`,
      response.status,
      leaseOwner,
    );
  } catch (error) {
    await markDeliveryFailure(
      delivery,
      error.message || "Webhook request failed",
      error.response?.status || null,
      leaseOwner,
    );
  }
};

const queueWebhookEvent = async ({ businessId, eventType, payload }) => {
  const endpoints = await MarketplaceWebhookEndpoint.find({
    business: businessId,
    status: "active",
  }).lean();

  const eventId = payload?.id ? createStableEventId(payload.id) : createStableEventId();
  const correlationId =
    payload?.metadata?.correlationId
    || payload?.data?.correlationId
    || payload?.data?.orderId
    || payload?.data?.order?.partnerOrderRef
    || "";

  const { shouldSendV2, v2Template } = await buildWebhookEventPayloads({
    businessId,
    eventType,
    payload,
  });

  const sendLegacy = shouldSendLegacyWebhook() || shouldDualRunWebhook();
  const sendV2 = shouldSendV2Webhook() && shouldSendV2;

  const createdDeliveries = [];
  for (const endpoint of endpoints) {
    if (!shouldSendForEvent(endpoint, eventType)) continue;

    try {
      if (sendLegacy) {
        const legacyDelivery = await MarketplaceWebhookDelivery.create({
          business: businessId,
          endpoint: endpoint._id,
          eventType,
          eventId,
          correlationId,
          schemaVersion: "1.0.0",
          payload,
          status: "pending",
          attemptCount: 0,
          nextRetryAt: new Date(),
        });

        createdDeliveries.push(legacyDelivery);
      }

      if (sendV2) {
        const deliveryId = new mongoose.Types.ObjectId();
        const v2Payload = buildWebhookV2Envelope({
          ...v2Template,
          eventId,
          deliveryId: deliveryId.toString(),
        });

        const v2Delivery = await MarketplaceWebhookDelivery.create({
          _id: deliveryId,
          business: businessId,
          endpoint: endpoint._id,
          eventType,
          eventId,
          correlationId: v2Payload.correlationId,
          schemaVersion: v2Payload.schemaVersion,
          payload: v2Payload,
          status: "pending",
          attemptCount: 0,
          nextRetryAt: new Date(),
        });

        createdDeliveries.push(v2Delivery);
      }
    } catch (error) {
      if (error.code !== 11000) {
        emitWebhookLog("error", {
          action: "delivery_queue_error",
          eventType,
          eventId,
          correlationId,
          endpointId: toIdString(endpoint._id),
          errorMessage: error.message,
        });
      }
    }
  }

  createdDeliveries.forEach((delivery) => {
    setImmediate(() => {
      dispatchWebhookDeliveryById(delivery._id).catch(() => {});
    });
  });
};

const processDueRetries = async () => {
  const dueDeliveries = await MarketplaceWebhookDelivery.find({
    status: "pending",
    nextRetryAt: { $lte: new Date() },
  })
    .sort({ nextRetryAt: 1 })
    .limit(50)
    .lean();

  dueDeliveries.forEach((delivery) => {
    setImmediate(() => {
      dispatchWebhookDeliveryById(delivery._id).catch(() => {});
    });
  });
};

const dispatchWebhookDeliveryById = async (deliveryId) => {
  const claimed = await claimDeliveryForDispatch(deliveryId);
  if (!claimed) return false;

  setImmediate(() => deliverWebhook(claimed.delivery, claimed.leaseOwner));
  return true;
};

const getWebhookMetricsSnapshot = () => {
  const attempts = webhookMetrics.dispatchAttempts || 0;
  return {
    ...webhookMetrics,
    averageLatencyMs: attempts > 0 ? Math.round(webhookMetrics.totalLatencyMs / attempts) : 0,
  };
};

const resetWebhookMetrics = () => {
  webhookMetrics.dispatchAttempts = 0;
  webhookMetrics.successCount = 0;
  webhookMetrics.failureCount = 0;
  webhookMetrics.retryCount = 0;
  webhookMetrics.deadLetterCount = 0;
  webhookMetrics.totalLatencyMs = 0;
};

const getRetryDelayMinutes = (attemptNumber) => {
  const index = Math.max(0, Number(attemptNumber || 1) - 1);
  return RETRY_DELAYS_MIN[Math.min(index, RETRY_DELAYS_MIN.length - 1)];
};

const initializeMarketplaceWebhookFanout = () => {
  eventBus.on("business_event", async (_businessId, payload) => {
    if (!payload?.type || !String(payload.type).startsWith("marketplace.")) {
      return;
    }

    if (String(payload.type).startsWith("marketplace.webhook.delivery_")) {
      return;
    }

    const businessId = payload?.metadata?.businessId;
    if (!businessId) return;

    await queueWebhookEvent({
      businessId,
      eventType: payload.type,
      payload,
    });
  });

  if (!retryTimer) {
    retryTimer = setInterval(processDueRetries, 60 * 1000);
    if (retryTimer.unref) {
      retryTimer.unref();
    }
  }
};

module.exports = {
  initializeMarketplaceWebhookFanout,
  queueWebhookEvent,
  processDueRetries,
  dispatchWebhookDeliveryById,
  getWebhookMetricsSnapshot,
  getRetryDelayMinutes,
  resetWebhookMetrics,
};
