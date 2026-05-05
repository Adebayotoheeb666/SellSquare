const { eventBus, EventTypes } = require("../../events");
const { buildMarketplaceListingSnapshot } = require("./listingWebhookPayloadBuilder");

const toIdString = (value) => {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (value._id) return value._id.toString();
  if (value.toString) return value.toString();
  return "";
};

const toArray = (value) => (Array.isArray(value) ? value : []);

const buildRefsFromProductPayload = (data) => {
  const refs = [];
  const rows = toArray(data?.products);

  rows.forEach((item) => {
    const productId = toIdString(item?._id || item?.productId);
    const groupId = toIdString(item?.itemGroup);
    if (productId) {
      refs.push({
        productId,
        groupId,
      });
    }
  });

  const directProductId = toIdString(data?._id || data?.productId);
  if (directProductId) {
    refs.push({
      productId: directProductId,
      groupId: toIdString(data?.itemGroup),
    });
  }

  toArray(data?.productIds).forEach((id) => {
    const productId = toIdString(id);
    if (productId) refs.push({ productId });
  });

  return refs;
};

const buildRefsFromProductGroupPayload = (data) => {
  const refs = [];
  const groupId = toIdString(data?._id || data?.groupId);
  if (groupId) {
    refs.push({ groupId });
  }

  toArray(data?.deletedGroupIds).forEach((id) => {
    const deletedGroupId = toIdString(id);
    if (deletedGroupId) refs.push({ groupId: deletedGroupId });
  });

  return refs;
};

const buildRefsFromDiscountPayload = (data) => {
  const refs = [];

  toArray(data?.appliedProducts).forEach((id) => {
    const productId = toIdString(id);
    if (productId) refs.push({ productId });
  });

  toArray(data?.appliedProductGroups).forEach((id) => {
    const groupId = toIdString(id);
    if (groupId) refs.push({ groupId });
  });

  toArray(data?.appliedGroupItems).forEach((id) => {
    const productId = toIdString(id);
    if (productId) refs.push({ productId });
  });

  return refs;
};

const buildRefsFromCheckoutPayload = (data) => {
  return toArray(data?.items)
    .map((item) => toIdString(item?.id || item?._id || item?.productId))
    .filter(Boolean)
    .map((productId) => ({ productId }));
};

const buildRefsFromMarketplaceOrderPayload = (data) => {
  const refs = [];
  const lines = [
    ...toArray(data?.affectedLines),
    ...toArray(data?.lines),
    ...toArray(data?.order?.lines),
  ];

  lines.forEach((line) => {
    const productId = toIdString(
      line?.productId
      || line?.product
      || line?.variantId,
    );
    const groupId = toIdString(
      line?.parentGroupId
      || line?.productGroup
      || line?.groupId
      || line?.listingId,
    );

    if (productId || groupId) {
      refs.push({
        productId,
        groupId,
      });
    }
  });

  return refs;
};

const extractListingRefsFromBusinessEvent = ({ type, data }) => {
  switch (type) {
    case EventTypes.PRODUCT_CREATED:
    case EventTypes.PRODUCT_UPDATED:
    case EventTypes.PRODUCT_DELETED:
    case EventTypes.PRODUCT_SOLD:
      return buildRefsFromProductPayload(data);

    case EventTypes.PRODUCT_GROUP_CREATED:
    case EventTypes.PRODUCT_GROUP_UPDATED:
    case EventTypes.PRODUCT_GROUP_DELETED:
    case EventTypes.PRODUCT_GROUP_BULK_DELETED:
      return buildRefsFromProductGroupPayload(data);

    case EventTypes.DISCOUNT_CREATED:
    case EventTypes.DISCOUNT_UPDATED:
    case EventTypes.DISCOUNT_DELETED:
      return buildRefsFromDiscountPayload(data);

    case EventTypes.CHECKOUT_COMPLETED:
      return buildRefsFromCheckoutPayload(data);

    case EventTypes.MARKETPLACE_ORDER_LINE_UPDATED:
      return buildRefsFromMarketplaceOrderPayload(data);

    default:
      return [];
  }
};

const SUPPORTED_SOURCE_EVENTS = new Set([
  EventTypes.PRODUCT_CREATED,
  EventTypes.PRODUCT_UPDATED,
  EventTypes.PRODUCT_DELETED,
  EventTypes.PRODUCT_SOLD,
  EventTypes.PRODUCT_GROUP_CREATED,
  EventTypes.PRODUCT_GROUP_UPDATED,
  EventTypes.PRODUCT_GROUP_DELETED,
  EventTypes.PRODUCT_GROUP_BULK_DELETED,
  EventTypes.DISCOUNT_CREATED,
  EventTypes.DISCOUNT_UPDATED,
  EventTypes.DISCOUNT_DELETED,
  EventTypes.CHECKOUT_COMPLETED,
  EventTypes.MARKETPLACE_ORDER_LINE_UPDATED,
]);

const emitMarketplaceListingUpdateFromSourceEvent = async ({ businessId, payload }) => {
  const sourceEventTimestamp = payload?.timestamp
    ? new Date(payload.timestamp).toISOString()
    : new Date().toISOString();
  const sourceBusinessId = toIdString(payload?.metadata?.businessId || businessId);

  const refs = extractListingRefsFromBusinessEvent({
    type: payload.type,
    data: payload.data,
  });

  if (!refs.length) {
    return;
  }

  const listings = await buildMarketplaceListingSnapshot({
    businessId,
    refs,
    occurredAt: payload?.timestamp ? new Date(payload.timestamp).toISOString() : undefined,
  });

  if (!listings.length) {
    return;
  }

  eventBus.emitBusinessEvent(
    EventTypes.MARKETPLACE_LISTING_UPDATED,
    businessId,
    {
      sourceEventType: payload.type,
      sourceEventId: payload.id,
      sourceEventTimestamp,
      sourceEventSequence: Number(payload?.metadata?.sequence || 0) || null,
      sourceBusinessId,
      dedupeKey: payload.id || null,
      updatedAt: sourceEventTimestamp,
      listings,
    },
    {
      source: "marketplace_listing_bridge",
      correlationId:
        payload?.metadata?.correlationId
        || payload?.data?.correlationId
        || payload?.id,
    },
  );
};

let initialized = false;

const initializeMarketplaceListingEventBridge = () => {
  if (initialized) {
    return;
  }

  initialized = true;

  eventBus.on("business_event", (businessId, payload) => {
    if (!payload?.type || !SUPPORTED_SOURCE_EVENTS.has(payload.type)) {
      return;
    }

    if (payload.type === EventTypes.MARKETPLACE_LISTING_UPDATED) {
      return;
    }

    setImmediate(async () => {
      try {
        await emitMarketplaceListingUpdateFromSourceEvent({
          businessId: toIdString(businessId),
          payload,
        });
      } catch (error) {
        console.error(
          "[MarketplaceListingEventBridge] Failed to emit listing update",
          error,
        );
      }
    });
  });
};

module.exports = {
  initializeMarketplaceListingEventBridge,
  extractListingRefsFromBusinessEvent,
  emitMarketplaceListingUpdateFromSourceEvent,
};
