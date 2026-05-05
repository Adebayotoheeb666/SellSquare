const crypto = require("crypto");
const Product = require("../../models/productModel");
const ProductGroup = require("../../models/productGroupModel");

const WEBHOOK_V2_SCHEMA_VERSION = "2.0.0";

const SUPPORTED_ORDER_EVENT_TYPES = new Set([
  "marketplace.order.placed",
  "marketplace.order.payment_confirmed",
  "marketplace.order.accepted",
  "marketplace.order.rejected",
  "marketplace.order.processing",
  "marketplace.order.shipped",
  "marketplace.order.delivered",
  "marketplace.order.line.updated",
]);

const SUPPORTED_MARKETPLACE_EVENT_TYPES = new Set([
  "marketplace.listing.updated",
  ...SUPPORTED_ORDER_EVENT_TYPES,
  "marketplace.webhook.delivery_succeeded",
  "marketplace.webhook.delivery_failed",
]);

const toIdString = (value) => {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (value.toString) return value.toString();
  return "";
};

const resolveImageUrl = (value) => {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    return resolveImageUrl(value[0]);
  }

  if (typeof value === "object") {
    return (
      value.url
      || value.location
      || value.src
      || value.secure_url
      || value.path
      || ""
    );
  }

  return "";
};

const buildLineSnapshot = ({ line, productMap, groupMap }) => {
  const productId = toIdString(line.product);
  const groupId = toIdString(line.productGroup);
  const listingId = toIdString(line.listingId) || groupId || productId;
  const variantId = toIdString(line.variantId) || productId;
  const product = productMap[productId] || null;
  const group = groupMap[groupId] || null;

  const variantImage =
    resolveImageUrl(line?.variantImage)
    || resolveImageUrl(line?.lineMeta?.variantImage)
    || resolveImageUrl(product?.image)
    || resolveImageUrl(product?.images);
  const groupImage =
    resolveImageUrl(line?.groupImage)
    || resolveImageUrl(line?.lineMeta?.groupImage)
    || resolveImageUrl(group?.image)
    || resolveImageUrl(group?.images);
  const selectedImage =
    resolveImageUrl(line?.selectedImage)
    || resolveImageUrl(line?.lineMeta?.selectedImage)
    || variantImage
    || groupImage
    || "";

  return {
    lineId: line.lineId,
    productId,
    listingId,
    requestedQty: Number(line.requestedQty || 0),
    acceptedQty: Number(line.acceptedQty || 0),
    rejectedQty: Number(line.rejectedQty || 0),
    decisionStatus: line.lineStatus || "pending",
    decisionReason: line.decisionReason || "",
    variantId,
    parentGroupId: groupId || null,
    groupName: group?.groupName || "",
    variantImage,
    groupImage,
    selectedImage,
  };
};

const buildOrderLineSnapshots = async ({ businessId, order }) => {
  const lines = Array.isArray(order?.lines) ? order.lines : [];
  const productIds = Array.from(new Set(lines.map((line) => toIdString(line.product)).filter(Boolean)));
  const groupIds = Array.from(new Set(lines.map((line) => toIdString(line.productGroup)).filter(Boolean)));

  const [products, groups] = await Promise.all([
    productIds.length
      ? Product.find({
          business: businessId,
          _id: { $in: productIds },
        })
          .select("_id itemGroup image images")
          .lean()
      : Promise.resolve([]),
    groupIds.length
      ? ProductGroup.find({
          business: businessId,
          _id: { $in: groupIds },
        })
          .select("_id groupName image images")
          .lean()
      : Promise.resolve([]),
  ]);

  const productMap = products.reduce((acc, product) => {
    acc[toIdString(product._id)] = product;
    return acc;
  }, {});

  const groupMap = groups.reduce((acc, group) => {
    acc[toIdString(group._id)] = group;
    return acc;
  }, {});

  return lines.map((line) => buildLineSnapshot({ line, productMap, groupMap }));
};

const createStableEventId = (seed = "") => {
  if (crypto.randomUUID && !seed) {
    return crypto.randomUUID();
  }

  const hash = crypto
    .createHash("sha256")
    .update(String(seed || `${Date.now()}_${Math.random()}`))
    .digest("hex");
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-${hash.slice(12, 16)}-${hash.slice(16, 20)}-${hash.slice(20, 32)}`;
};

const buildWebhookV2Envelope = ({
  eventType,
  eventId,
  deliveryId,
  correlationId,
  occurredAt,
  order,
  lines,
}) => {
  return {
    eventId: eventId || createStableEventId(),
    deliveryId,
    correlationId: correlationId || "",
    eventType,
    schemaVersion: WEBHOOK_V2_SCHEMA_VERSION,
    occurredAt: occurredAt || new Date().toISOString(),
    order,
    lines: Array.isArray(lines) ? lines : [],
  };
};

const buildWebhookEventPayloads = async ({ businessId, eventType, payload }) => {
  const order = payload?.data?.order || null;
  if (!order || !SUPPORTED_ORDER_EVENT_TYPES.has(eventType)) {
    return {
      shouldSendV2: false,
      linesSnapshot: [],
      v2Template: null,
    };
  }

  const linesSnapshot = await buildOrderLineSnapshots({ businessId, order });
  const correlationId =
    payload?.metadata?.correlationId
    || payload?.data?.correlationId
    || toIdString(order.partnerOrderRef)
    || toIdString(order._id);

  return {
    shouldSendV2: true,
    linesSnapshot,
    v2Template: {
      eventType,
      correlationId,
      occurredAt: payload?.timestamp ? new Date(payload.timestamp).toISOString() : new Date().toISOString(),
      order,
      lines: linesSnapshot,
    },
  };
};

module.exports = {
  WEBHOOK_V2_SCHEMA_VERSION,
  SUPPORTED_ORDER_EVENT_TYPES,
  SUPPORTED_MARKETPLACE_EVENT_TYPES,
  buildOrderLineSnapshots,
  buildWebhookV2Envelope,
  buildWebhookEventPayloads,
  createStableEventId,
};
