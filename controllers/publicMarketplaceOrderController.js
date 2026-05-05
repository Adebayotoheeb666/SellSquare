const asyncHandler = require("express-async-handler");
const mongoose = require("mongoose");
const { MarketplaceOrder } = require("../models/marketplaceOrderModel");
const {
  validateOrderCreatePayload,
} = require("../validators/marketplaceSchemas");
const {
  resolveMarketplaceLineIdentity,
} = require("../services/marketplace/marketplaceLineResolver");
const { resolveEffectiveDiscount } = require("../services/marketplace/discountResolver");
const {
  createLineHold,
  releaseOrderHolds,
  releaseLineHold,
  consumeOrderHolds,
  expireStaleHolds,
  getActiveHeldQuantity,
} = require("../services/marketplace/inventoryHoldService");
const {
  assertValidOrderTransition,
  normalizeLineDecision,
} = require("../services/marketplace/orderStateService");
const {
  fulfillMarketplaceOrderToCheckout,
  SYSTEM_MARKETPLACE_USER,
} = require("../services/marketplace/checkoutFulfillmentService");
const {
  completeIdempotencyKey,
} = require("../services/marketplace/idempotencyService");
const { eventBus } = require("../events");
const {
  buildOrderLineSnapshots,
} = require("../services/marketplace/webhookEventBuilder");
const logActivity = require("../middleWare/logActivityMiddleware");

const MARKETPLACE_DISCOUNT_TYPES = ["marketplace_sales"];

const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const normalizeObject = (value) =>
  value && typeof value === "object" && !Array.isArray(value) ? value : {};

const normalizeFulfillment = (value) => {
  const fulfillment = normalizeObject(value);
  if (!Object.keys(fulfillment).length) return {};

  const method = typeof fulfillment.method === "string"
    ? fulfillment.method.toLowerCase().trim()
    : "";

  return {
    ...fulfillment,
    ...(method ? { method } : {}),
  };
};

const normalizeLineMetadata = (lineInput = {}) => {
  const normalizedLineMeta = normalizeObject(lineInput.lineMeta);

  const variantImage =
    lineInput.variantImage
    || normalizedLineMeta.variantImage
    || normalizedLineMeta.image
    || "";

  const groupImage = lineInput.groupImage || normalizedLineMeta.groupImage || "";
  const selectedImage =
    lineInput.selectedImage
    || normalizedLineMeta.selectedImage
    || variantImage
    || groupImage
    || "";

  return {
    variantImage: typeof variantImage === "string" ? variantImage : "",
    groupImage: typeof groupImage === "string" ? groupImage : "",
    selectedImage: typeof selectedImage === "string" ? selectedImage : "",
    lineMeta: normalizedLineMeta,
  };
};

const createMarketplaceOrderNumber = (businessName = "MKP") => {
  const random = Math.floor(100000 + Math.random() * 900000);
  return `MKT-${String(businessName).substring(0, 3).toUpperCase()}-${random}`;
};

const appendStatusHistory = (order, toStatus, by = "system", reason = "") => {
  order.statusHistory = Array.isArray(order.statusHistory) ? order.statusHistory : [];
  order.statusHistory.push({
    from: order.status || undefined,
    to: toStatus,
    by,
    reason,
    at: new Date(),
  });
};

const finalizeIdempotencySuccess = async (req, responseCode, responseBody) => {
  if (!req.idempotency || !req.partnerCredential?._id) return;

  await completeIdempotencyKey({
    credentialId: req.partnerCredential._id,
    routeKey: req.idempotency.routeKey,
    idempotencyKey: req.idempotency.idempotencyKey,
    responseCode,
    responseBody,
    failed: false,
  });
};

const finalizeIdempotencyFailure = async (req, responseCode, responseBody) => {
  if (!req.idempotency || !req.partnerCredential?._id) return;

  await completeIdempotencyKey({
    credentialId: req.partnerCredential._id,
    routeKey: req.idempotency.routeKey,
    idempotencyKey: req.idempotency.idempotencyKey,
    responseCode,
    responseBody,
    failed: true,
  });
};

const emitMarketplaceOrderSnapshot = async ({ eventType, businessId, order, extraData = {} }) => {
  if (!order) return;

  const snapshot = typeof order.toObject === "function" ? order.toObject() : order;
  const lines = await buildOrderLineSnapshots({ businessId, order: snapshot });
  const correlationId =
    extraData.correlationId
    || snapshot.partnerOrderRef
    || snapshot._id?.toString?.()
    || "";

  const affectedLineIds = Array.isArray(extraData.affectedLineIds)
    ? extraData.affectedLineIds
    : lines.map((line) => line.lineId);

  const affectedLines = lines.filter((line) => affectedLineIds.includes(line.lineId));

  eventBus.emitBusinessEvent(
    eventType,
    businessId.toString(),
    {
      orderId: snapshot._id?.toString?.() || String(snapshot._id || ""),
      status: snapshot.status,
      order: snapshot,
      lines,
      affectedLines,
      correlationId,
      ...extraData,
    },
    { source: "marketplace_public_api" },
  );
};

const createMarketplaceOrder = asyncHandler(async (req, res) => {
  const payloadValidation = validateOrderCreatePayload(req.body || {});
  if (!payloadValidation.valid) {
    const body = {
      message: "Invalid marketplace order payload",
      errors: payloadValidation.errors,
    };
    await finalizeIdempotencyFailure(req, 400, body);
    console.log()
    return res.status(400).json(body);
  }

  const businessId = req.business._id;
  const credentialId = req.partnerCredential._id;
  const linesPayload = req.body.lines || [];
  const shippingAddress = normalizeObject(req.body.shippingAddress);
  const fulfillment = normalizeFulfillment(req.body.fulfillment);

  const builtLines = [];
  let requestedSubtotal = 0;

  for (const [index, lineInput] of linesPayload.entries()) {
    let resolvedLine;
    try {
      resolvedLine = await resolveMarketplaceLineIdentity({
        businessId,
        lineInput,
      });
    } catch (error) {
      if (error?.statusCode === 400) {
        const body = {
          message: error.message,
          code: error.code || "INVALID_LISTING_PRODUCT",
        };
        await finalizeIdempotencyFailure(req, 400, body);
        return res.status(400).json(body);
      }

      throw error;
    }

    const product = resolvedLine.resolvedProduct;

    const requestedQty = Math.max(1, toNumber(lineInput.quantity));
    const activeHeldQty = await getActiveHeldQuantity({
      businessId,
      productId: product._id,
    });

    const availableQty = Math.max(0, toNumber(product.quantity) - activeHeldQty);
    const outOfStock = availableQty < requestedQty;

    const discountResult = await resolveEffectiveDiscount({
      businessId,
      productId: product._id,
      variantProductId: product._id,
      groupId: product.itemGroup || null,
      basePrice: product.price,
      discountTypes: MARKETPLACE_DISCOUNT_TYPES,
    });

    const line = {
      lineId: lineInput.lineId || `line_${index + 1}`,
      product: product._id,
      productGroup: resolvedLine.resolvedGroupId || null,
      isGroupVariant: Boolean(resolvedLine.isGroupVariant),
      listingId: resolvedLine.canonicalListingId || "",
      variantId: resolvedLine.canonicalVariantId || "",
      sku: product.sku || "",
      name: product.name,
      requestedQty,
      acceptedQty: 0,
      rejectedQty: outOfStock ? requestedQty : 0,
      lineStatus: outOfStock ? "out_of_stock" : "pending",
      baseUnitPrice: toNumber(product.price),
      effectiveUnitPrice: toNumber(discountResult.effectivePrice),
      discountMeta: {
        discountId: discountResult.discount?.id || null,
        discountName: discountResult.discount?.name || "",
        discountType: discountResult.discount?.valueType || "none",
        discountAmount: toNumber(discountResult.discount?.amount || 0),
      },
      decisionReason: outOfStock ? "Insufficient stock" : "",
      ...normalizeLineMetadata(lineInput),
    };

    requestedSubtotal += line.effectiveUnitPrice * requestedQty;
    builtLines.push(line);
  }

  const orderId = new mongoose.Types.ObjectId();

  const orderPayload = {
    _id: orderId,
    business: businessId,
    credential: credentialId,
    orderNumber: createMarketplaceOrderNumber(req.business.businessName),
    partnerOrderRef: req.body.partnerOrderRef || "",
    idempotencyKey: req.get("Idempotency-Key") || req.body.idempotencyKey || `gen_${Date.now()}`,
    status: "placed",
    lines: builtLines,
    customer: req.body.customer || {},
    shippingAddress,
    fulfillment,
    payment: {
      paymentId: req.body.paymentId || "",
      isPaid: false,
      trustedPaidFlag: Boolean(req.body.trustedPaidFlag),
      partnerPaymentMeta: req.body.partnerPaymentMeta || {},
    },
    totals: {
      requestedSubtotal,
      acceptedSubtotal: 0,
      rejectedSubtotal: builtLines
        .filter((line) => line.rejectedQty > 0)
        .reduce((sum, line) => sum + line.effectiveUnitPrice * line.rejectedQty, 0),
    },
    statusHistory: [
      {
        to: "placed",
        by: "partner",
        reason: "Order created",
        at: new Date(),
      },
    ],
    warnings: [],
    auditTrail: [
      {
        action: "order_created",
        by: req.partnerCredential.keyId,
        at: new Date(),
      },
    ],
  };

  for (const line of builtLines.filter((item) => item.lineStatus === "pending")) {
    try {
      await createLineHold({
        businessId,
        orderId,
        lineId: line.lineId,
        productId: line.product,
        productGroupId: line.productGroup,
        quantity: line.requestedQty,
      });
    } catch (error) {
      if (error?.code === "INSUFFICIENT_STOCK_HOLD_CAPACITY") {
        line.acceptedQty = 0;
        line.rejectedQty = line.requestedQty;
        line.lineStatus = "out_of_stock";
        line.decisionReason = "Insufficient stock";
        continue;
      }

      await releaseOrderHolds({
        orderId,
        reason: "order_create_hold_failed",
      });
      throw error;
    }
  }

  orderPayload.totals.rejectedSubtotal = builtLines
    .filter((line) => line.rejectedQty > 0)
    .reduce((sum, line) => sum + line.effectiveUnitPrice * line.rejectedQty, 0);

  const order = await MarketplaceOrder.create(orderPayload);

  if (req.body.paymentId && req.body.trustedPaidFlag) {
    assertValidOrderTransition({ from: order.status, to: "payment_confirmed" });
    appendStatusHistory(order, "payment_confirmed", "partner", "Trusted paid flag supplied");
    order.status = "payment_confirmed";
    order.payment.paymentId = req.body.paymentId;
    order.payment.isPaid = true;
    order.payment.trustedPaidFlag = true;
    order.payment.paidAt = new Date();
    order.warnings.push({
      code: "TRUSTED_PAID_FLAG_UNVERIFIED",
      message:
        "Payment auto-confirmed from trusted partner payload. Verify settlement asynchronously.",
      severity: "warning",
      meta: { paymentId: req.body.paymentId },
    });
    await order.save();
  }

  await emitMarketplaceOrderSnapshot({
    eventType: "marketplace.order.placed",
    businessId,
    order,
    extraData: {
      orderNumber: order.orderNumber,
    },
  });

  const responseBody = {
    order,
    metadata: {
      autoPaymentConfirmed: Boolean(req.body.paymentId && req.body.trustedPaidFlag),
    },
  };

  logActivity(`Created marketplace order #${order.orderNumber} with ${builtLines.filter(l => l.acceptedQty > 0).length} accepted item(s)`)(req, res);

  await finalizeIdempotencySuccess(req, 201, responseBody);
  return res.status(201).json(responseBody);
});

const confirmMarketplacePayment = asyncHandler(async (req, res) => {
  const { orderId } = req.params;
  const order = await MarketplaceOrder.findOne({
    _id: orderId,
    business: req.business._id,
  });

  if (!order) {
    return res.status(404).json({ message: "Marketplace order not found" });
  }

  assertValidOrderTransition({ from: order.status, to: "payment_confirmed" });

  order.payment.paymentId = req.body.paymentId || order.payment.paymentId;
  order.payment.isPaid = true;
  order.payment.paidAt = new Date();
  order.payment.trustedPaidFlag = Boolean(req.body.trustedPaidFlag);
  order.payment.partnerPaymentMeta = req.body.partnerPaymentMeta || order.payment.partnerPaymentMeta;

  if (req.body.trustedPaidFlag && req.body.paymentId) {
    order.warnings.push({
      code: "TRUSTED_PAID_FLAG_UNVERIFIED",
      message:
        "Payment auto-confirmed from trusted partner payload. Verify settlement asynchronously.",
      severity: "warning",
      meta: { paymentId: req.body.paymentId },
    });
  }

  appendStatusHistory(order, "payment_confirmed", "partner", "Payment confirmed");
  order.status = "payment_confirmed";
  await order.save();

  logActivity(`Confirmed payment for marketplace order #${order.orderNumber}`)(req, res);

  await emitMarketplaceOrderSnapshot({
    eventType: "marketplace.order.payment_confirmed",
    businessId: req.business._id,
    order,
  });

  return res.status(200).json({ order });
});

const applyMarketplaceLineDecisions = asyncHandler(async (req, res) => {
  const { orderId } = req.params;
  const decisions = Array.isArray(req.body.decisions) ? req.body.decisions : [];

  const order = await MarketplaceOrder.findOne({
    _id: orderId,
    business: req.business._id,
  });

  if (!order) {
    return res.status(404).json({ message: "Marketplace order not found" });
  }

  if (order.status !== "payment_confirmed") {
    return res.status(409).json({ message: "Line decisions require payment_confirmed status" });
  }

  for (const decision of decisions) {
    const line = order.lines.find((entry) => entry.lineId === decision.lineId);
    if (!line) continue;

    if (line.lineStatus === "out_of_stock") {
      line.acceptedQty = 0;
      line.rejectedQty = line.requestedQty;
      line.lineStatus = "rejected";
      line.decisionReason = "Out of stock";
      continue;
    }

    const normalized = normalizeLineDecision({
      requestedQty: line.requestedQty,
      acceptedQty: decision.acceptedQty,
      rejectedQty: decision.rejectedQty,
    });

    line.acceptedQty = normalized.acceptedQty;
    line.rejectedQty = normalized.rejectedQty;
    line.lineStatus = normalized.lineStatus;
    line.decisionReason = decision.reason || line.decisionReason || "";

    if (normalized.rejectedQty > 0 && normalized.acceptedQty === 0) {
      await releaseLineHold({
        orderId: order._id,
        lineId: line.lineId,
        reason: `line_rejected:${line.lineId}`,
      });
    }
  }

  const acceptedLines = order.lines.filter((line) => line.acceptedQty > 0);
  const rejectedLines = order.lines.filter((line) => line.rejectedQty > 0);

  order.totals.acceptedSubtotal = acceptedLines.reduce(
    (sum, line) => sum + toNumber(line.effectiveUnitPrice) * toNumber(line.acceptedQty),
    0,
  );
  order.totals.rejectedSubtotal = rejectedLines.reduce(
    (sum, line) => sum + toNumber(line.effectiveUnitPrice) * toNumber(line.rejectedQty),
    0,
  );

  if (acceptedLines.length > 0) {
    assertValidOrderTransition({ from: order.status, to: "accepted" });
    appendStatusHistory(order, "accepted", "business", "Line decisions accepted");
    order.status = "accepted";

    await consumeOrderHolds({ orderId: order._id, reason: "order_accepted" });
    const { checkOut } = await fulfillMarketplaceOrderToCheckout({
      business: req.business,
      order,
      acceptedLines,
      customer: order.customer,
      actor: SYSTEM_MARKETPLACE_USER,
    });

    order.checkoutSession = {
      checkoutId: checkOut._id,
      orderId: checkOut.orderId,
      actor: SYSTEM_MARKETPLACE_USER.email,
    };
  } else {
    assertValidOrderTransition({ from: order.status, to: "rejected" });
    appendStatusHistory(order, "rejected", "business", "All lines rejected");
    order.status = "rejected";
    await releaseOrderHolds({ orderId: order._id, reason: "order_rejected" });
  }

  await order.save();

  const affectedLineIds = decisions
    .map((decision) => decision?.lineId)
    .filter(Boolean);

  const acceptedCount = order.lines.filter(l => l.acceptedQty > 0).length;
  const rejectedCount = order.lines.filter(l => l.rejectedQty > 0).length;
  logActivity(`Applied line decisions for marketplace order #${order.orderNumber}: ${acceptedCount} accepted, ${rejectedCount} rejected`)(req, res);

  await emitMarketplaceOrderSnapshot({
    eventType: "marketplace.order.line.updated",
    businessId: req.business._id,
    order,
    extraData: {
      lines: order.lines,
      affectedLineIds,
    },
  });

  return res.status(200).json({ order });
});

const updateMarketplaceOrderStatus = asyncHandler(async (req, res) => {
  const { orderId } = req.params;
  const { status, reason = "" } = req.body;

  const order = await MarketplaceOrder.findOne({
    _id: orderId,
    business: req.business._id,
  });

  if (!order) {
    return res.status(404).json({ message: "Marketplace order not found" });
  }

  assertValidOrderTransition({ from: order.status, to: status });
  appendStatusHistory(order, status, "business", reason || "Manual status update");
  order.status = status;
  await order.save();

  logActivity(`Updated marketplace order #${order.orderNumber} status to "${status}"${reason ? ` (${reason})` : ""}`)(req, res);

  await emitMarketplaceOrderSnapshot({
    eventType: `marketplace.order.${status}`,
    businessId: req.business._id,
    order,
    extraData: {
      reason,
    },
  });

  return res.status(200).json({ order });
});

const getMarketplaceOrder = asyncHandler(async (req, res) => {
  const order = await MarketplaceOrder.findOne({
    _id: req.params.orderId,
    business: req.business._id,
  }).lean();

  if (!order) {
    return res.status(404).json({ message: "Marketplace order not found" });
  }

  return res.status(200).json({ order });
});

const listMarketplaceOrders = asyncHandler(async (req, res) => {
  const status = req.query.status;
  const filter = {
    business: req.business._id,
  };
  if (status) {
    filter.status = status;
  }

  const orders = await MarketplaceOrder.find(filter).sort({ createdAt: -1 }).lean();

  return res.status(200).json({
    orders,
    total: orders.length,
  });
});

const runMarketplaceHoldExpirySweep = asyncHandler(async (_req, res) => {
  const updateResult = await expireStaleHolds();
  return res.status(200).json({
    matched: updateResult.matchedCount || 0,
    modified: updateResult.modifiedCount || 0,
  });
});

module.exports = {
  createMarketplaceOrder,
  confirmMarketplacePayment,
  applyMarketplaceLineDecisions,
  updateMarketplaceOrderStatus,
  getMarketplaceOrder,
  listMarketplaceOrders,
  runMarketplaceHoldExpirySweep,
};
