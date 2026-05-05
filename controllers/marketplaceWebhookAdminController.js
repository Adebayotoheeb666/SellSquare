const asyncHandler = require("express-async-handler");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const MarketplaceWebhookEndpoint = require("../models/marketplaceWebhookEndpointModel");
const MarketplaceWebhookDelivery = require("../models/marketplaceWebhookDeliveryModel");
const { encryptSecret } = require("../utils/secretCrypto");
const {
  queueWebhookEvent,
  dispatchWebhookDeliveryById,
} = require("../services/marketplace/webhookFanoutService");
const { assertSecureWebhookUrl } = require("../services/marketplace/webhookSecurity");
const {
  SUPPORTED_MARKETPLACE_EVENT_TYPES,
} = require("../services/marketplace/webhookEventBuilder");

const normalizeSubscribedEvents = (events) => {
  const list = Array.isArray(events) ? events : ["marketplace.*"];
  const sanitized = list
    .map((eventType) => String(eventType || "").trim())
    .filter(Boolean);

  if (sanitized.length === 0) {
    return ["marketplace.*"];
  }

  return Array.from(new Set(sanitized));
};

const resolveEnvironment = (input) => {
  const normalized = String(input || "production").trim().toLowerCase();
  if (["development", "staging", "production"].includes(normalized)) {
    return normalized;
  }
  return "production";
};

const normalizeEndpointIdentity = (value) => {
  const normalized = String(value || "default").trim().toLowerCase();
  return normalized || "default";
};

const listWebhookEndpoints = asyncHandler(async (req, res) => {
  const rows = await MarketplaceWebhookEndpoint.find({ business: req.business._id })
    .sort({ createdAt: -1 })
    .lean();

  return res.status(200).json({
    endpoints: rows.map((row) => ({
      id: row._id,
      name: row.name,
      url: row.url,
      subscribedEvents: row.subscribedEvents,
      endpointIdentity: row.endpointIdentity,
      environment: row.environment,
      providerEndpointId: row.providerEndpointId,
      status: row.status,
      failureCount: row.failureCount,
      lastDeliveredAt: row.lastDeliveredAt,
      secretOverlapUntil: row.secretOverlapUntil,
      createdAt: row.createdAt,
    })),
  });
});

const createWebhookEndpoint = asyncHandler(async (req, res) => {
  const {
    name,
    url,
    subscribedEvents = ["marketplace.*"],
    endpointIdentity = "default",
    environment = "production",
  } = req.body;

  if (!name || !url) {
    return res.status(400).json({ message: "name and url are required" });
  }

  let normalizedUrl;
  try {
    normalizedUrl = assertSecureWebhookUrl(url);
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }

  const plainSecret = crypto.randomBytes(32).toString("hex");
  const secretHash = await bcrypt.hash(plainSecret, 12);
  const secretCiphertext = encryptSecret(plainSecret);
  const providerEndpointId = `wep_${crypto.randomBytes(10).toString("hex")}`;

  const endpoint = await MarketplaceWebhookEndpoint.create({
    business: req.business._id,
    name,
    url: normalizedUrl,
    subscribedEvents: normalizeSubscribedEvents(subscribedEvents),
    endpointIdentity: normalizeEndpointIdentity(endpointIdentity),
    environment: resolveEnvironment(environment),
    providerEndpointId,
    secretHash,
    secretCiphertext,
    status: "active",
  });

  return res.status(201).json({
    endpoint: {
      id: endpoint._id,
      name: endpoint.name,
      url: endpoint.url,
      subscribedEvents: endpoint.subscribedEvents,
      endpointIdentity: endpoint.endpointIdentity,
      environment: endpoint.environment,
      providerEndpointId: endpoint.providerEndpointId,
      status: endpoint.status,
    },
    secret: plainSecret,
    warning: "Webhook secret is returned once. Store it securely.",
  });
});

const updateWebhookEndpoint = asyncHandler(async (req, res) => {
  const updates = {
    name: req.body.name,
    url: req.body.url,
    subscribedEvents: Array.isArray(req.body.subscribedEvents)
      ? normalizeSubscribedEvents(req.body.subscribedEvents)
      : undefined,
    status: req.body.status,
  };

  if (typeof updates.url === "string") {
    try {
      updates.url = assertSecureWebhookUrl(updates.url);
    } catch (error) {
      return res.status(400).json({ message: error.message });
    }
  }

  const endpoint = await MarketplaceWebhookEndpoint.findOneAndUpdate(
    {
      _id: req.params.endpointId,
      business: req.business._id,
    },
    {
      $set: updates,
    },
    {
      new: true,
    },
  );

  if (!endpoint) {
    return res.status(404).json({ message: "Webhook endpoint not found" });
  }

  return res.status(200).json({ endpoint });
});

const upsertProviderWebhookEndpoint = asyncHandler(async (req, res) => {
  const {
    providerEndpointId,
    endpointIdentity = "default",
    environment = "production",
    name,
    url,
    subscribedEvents = ["marketplace.*"],
    status = "active",
    secret,
  } = req.body || {};

  if (!name || !url) {
    return res.status(400).json({ message: "name and url are required" });
  }

  let normalizedUrl;
  try {
    normalizedUrl = assertSecureWebhookUrl(url);
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }

  const resolvedEnvironment = resolveEnvironment(environment);
  const resolvedIdentity = normalizeEndpointIdentity(endpointIdentity);

  const uniqueFilter = providerEndpointId
    ? {
        business: req.business._id,
        providerEndpointId: String(providerEndpointId).trim(),
      }
    : {
        business: req.business._id,
        endpointIdentity: resolvedIdentity,
        environment: resolvedEnvironment,
      };

  const existing = await MarketplaceWebhookEndpoint.findOne(uniqueFilter).select(
    "+secretHash +secretCiphertext",
  );

  let endpoint = existing;
  let created = false;
  let plainSecret = "";

  if (!endpoint) {
    created = true;
    plainSecret = String(secret || crypto.randomBytes(32).toString("hex"));
    endpoint = new MarketplaceWebhookEndpoint({
      business: req.business._id,
      credential: req.partnerCredential?._id || null,
      name,
      url: normalizedUrl,
      subscribedEvents: normalizeSubscribedEvents(subscribedEvents),
      status,
      endpointIdentity: resolvedIdentity,
      environment: resolvedEnvironment,
      providerEndpointId:
        String(providerEndpointId || `wep_${crypto.randomBytes(10).toString("hex")}`).trim(),
      secretHash: await bcrypt.hash(plainSecret, 12),
      secretCiphertext: encryptSecret(plainSecret),
      lastSecretRotatedAt: new Date(),
    });
    await endpoint.save();
  } else {
    endpoint.name = name;
    endpoint.url = normalizedUrl;
    endpoint.subscribedEvents = normalizeSubscribedEvents(subscribedEvents);
    endpoint.status = status;
    endpoint.endpointIdentity = resolvedIdentity;
    endpoint.environment = resolvedEnvironment;

    if (providerEndpointId) {
      endpoint.providerEndpointId = String(providerEndpointId).trim();
    }

    if (secret) {
      plainSecret = String(secret);
      endpoint.secretHash = await bcrypt.hash(plainSecret, 12);
      endpoint.secretCiphertext = encryptSecret(plainSecret);
      endpoint.lastSecretRotatedAt = new Date();
      endpoint.nextSecretHash = "";
      endpoint.nextSecretCiphertext = "";
      endpoint.secretOverlapUntil = null;
    }

    await endpoint.save();
  }

  return res.status(created ? 201 : 200).json({
    endpoint: {
      id: endpoint._id,
      providerEndpointId: endpoint.providerEndpointId,
      endpointIdentity: endpoint.endpointIdentity,
      environment: endpoint.environment,
      name: endpoint.name,
      url: endpoint.url,
      subscribedEvents: endpoint.subscribedEvents,
      status: endpoint.status,
      secretOverlapUntil: endpoint.secretOverlapUntil,
      createdAt: endpoint.createdAt,
      updatedAt: endpoint.updatedAt,
    },
    created,
    secret: plainSecret || undefined,
    supportedEvents: Array.from(SUPPORTED_MARKETPLACE_EVENT_TYPES),
  });
});

const rotateWebhookEndpointSecret = asyncHandler(async (req, res) => {
  const overlapSeconds = Math.max(60, Number(req.body?.overlapSeconds || 24 * 60 * 60));

  const endpoint = await MarketplaceWebhookEndpoint.findOne({
    business: req.business._id,
    providerEndpointId: req.params.providerEndpointId,
  }).select("+secretHash +secretCiphertext +nextSecretHash +nextSecretCiphertext");

  if (!endpoint) {
    return res.status(404).json({ message: "Webhook endpoint not found" });
  }

  const nextSecret = String(req.body?.nextSecret || crypto.randomBytes(32).toString("hex"));
  endpoint.nextSecretHash = await bcrypt.hash(nextSecret, 12);
  endpoint.nextSecretCiphertext = encryptSecret(nextSecret);
  endpoint.secretOverlapUntil = new Date(Date.now() + overlapSeconds * 1000);
  endpoint.lastSecretRotatedAt = new Date();
  await endpoint.save();

  return res.status(200).json({
    providerEndpointId: endpoint.providerEndpointId,
    overlapUntil: endpoint.secretOverlapUntil,
    overlapSeconds,
    nextSecret,
    warning: "Store nextSecret securely and accept signatures from current + next during overlap.",
  });
});

const listWebhookDeliveries = asyncHandler(async (req, res) => {
  const filter = {
    business: req.business._id,
  };

  if (req.query.status) {
    filter.status = req.query.status;
  }

  const deliveries = await MarketplaceWebhookDelivery.find(filter)
    .sort({ createdAt: -1 })
    .limit(200)
    .lean();

  return res.status(200).json({
    deliveries,
    total: deliveries.length,
  });
});

const retryWebhookDelivery = asyncHandler(async (req, res) => {
  const delivery = await MarketplaceWebhookDelivery.findOne({
    _id: req.params.deliveryId,
    business: req.business._id,
  }).lean();

  if (!delivery) {
    return res.status(404).json({ message: "Webhook delivery not found" });
  }

  await MarketplaceWebhookDelivery.findByIdAndUpdate(delivery._id, {
    $set: {
      status: "pending",
      nextRetryAt: new Date(),
      errorMessage: "",
      deadLetteredAt: null,
      dispatchLease: {
        owner: "",
        claimedAt: null,
        expiresAt: null,
      },
    },
  });

  await dispatchWebhookDeliveryById(delivery._id);

  return res.status(200).json({ message: "Webhook delivery queued for retry" });
});

module.exports = {
  listWebhookEndpoints,
  createWebhookEndpoint,
  updateWebhookEndpoint,
  upsertProviderWebhookEndpoint,
  rotateWebhookEndpointSecret,
  listWebhookDeliveries,
  retryWebhookDelivery,
};
