jest.mock("../../events", () => ({
  eventBus: {
    emitBusinessEvent: jest.fn(),
    on: jest.fn(),
  },
  EventTypes: {
    PRODUCT_CREATED: "product.created",
    PRODUCT_UPDATED: "product.updated",
    PRODUCT_DELETED: "product.deleted",
    PRODUCT_SOLD: "product.sold",
    PRODUCT_GROUP_CREATED: "product_group.created",
    PRODUCT_GROUP_UPDATED: "product_group.updated",
    PRODUCT_GROUP_DELETED: "product_group.deleted",
    PRODUCT_GROUP_BULK_DELETED: "product_group.bulk_deleted",
    DISCOUNT_CREATED: "discount.created",
    DISCOUNT_UPDATED: "discount.updated",
    DISCOUNT_DELETED: "discount.deleted",
    CHECKOUT_COMPLETED: "checkout.completed",
    MARKETPLACE_ORDER_LINE_UPDATED: "marketplace.order.line.updated",
    MARKETPLACE_LISTING_UPDATED: "marketplace.listing.updated",
  },
}));

jest.mock("../../services/marketplace/listingWebhookPayloadBuilder", () => ({
  buildMarketplaceListingSnapshot: jest.fn(),
}));

const { eventBus, EventTypes } = require("../../events");
const {
  buildMarketplaceListingSnapshot,
} = require("../../services/marketplace/listingWebhookPayloadBuilder");
const {
  extractListingRefsFromBusinessEvent,
  emitMarketplaceListingUpdateFromSourceEvent,
} = require("../../services/marketplace/listingEventBridgeService");

describe("marketplace listing event bridge", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  test("extracts refs for product, group, discount and checkout source events", () => {
    expect(
      extractListingRefsFromBusinessEvent({
        type: EventTypes.PRODUCT_UPDATED,
        data: { _id: "product_1" },
      }),
    ).toEqual([{ productId: "product_1", groupId: "" }]);

    expect(
      extractListingRefsFromBusinessEvent({
        type: EventTypes.PRODUCT_GROUP_UPDATED,
        data: { _id: "group_1" },
      }),
    ).toEqual([{ groupId: "group_1" }]);

    expect(
      extractListingRefsFromBusinessEvent({
        type: EventTypes.DISCOUNT_UPDATED,
        data: {
          appliedProducts: ["product_1"],
          appliedProductGroups: ["group_1"],
          appliedGroupItems: ["variant_1"],
        },
      }),
    ).toEqual([
      { productId: "product_1" },
      { groupId: "group_1" },
      { productId: "variant_1" },
    ]);

    expect(
      extractListingRefsFromBusinessEvent({
        type: EventTypes.CHECKOUT_COMPLETED,
        data: {
          items: [{ id: "product_2" }, { productId: "variant_2" }],
        },
      }),
    ).toEqual([{ productId: "product_2" }, { productId: "variant_2" }]);

    expect(
      extractListingRefsFromBusinessEvent({
        type: EventTypes.MARKETPLACE_ORDER_LINE_UPDATED,
        data: {
          affectedLines: [
            {
              productId: "variant_10",
              listingId: "group_10",
            },
          ],
        },
      }),
    ).toEqual([
      {
        productId: "variant_10",
        groupId: "group_10",
      },
    ]);
  });

  test("emits marketplace.listing.updated with canonical listing snapshot", async () => {
    buildMarketplaceListingSnapshot.mockResolvedValue([
      {
        listingId: "product_1",
        listingType: "single",
        identity: { deterministicId: "single:product_1" },
        pricing: { basePrice: 100, effectivePrice: 90, discount: { id: "d_1" } },
      },
    ]);

    await emitMarketplaceListingUpdateFromSourceEvent({
      businessId: "biz_1",
      payload: {
        id: "evt_src_1",
        type: EventTypes.PRODUCT_CREATED,
        timestamp: Date.now(),
        data: { _id: "product_1" },
        metadata: { correlationId: "corr_1" },
      },
    });

    expect(buildMarketplaceListingSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({
        businessId: "biz_1",
        refs: [{ productId: "product_1", groupId: "" }],
      }),
    );

    expect(eventBus.emitBusinessEvent).toHaveBeenCalledWith(
      EventTypes.MARKETPLACE_LISTING_UPDATED,
      "biz_1",
      expect.objectContaining({
        sourceEventType: EventTypes.PRODUCT_CREATED,
        sourceEventId: "evt_src_1",
        sourceEventTimestamp: expect.any(String),
        sourceEventSequence: null,
        sourceBusinessId: "biz_1",
        dedupeKey: "evt_src_1",
        listings: expect.any(Array),
      }),
      expect.objectContaining({ correlationId: "corr_1" }),
    );
  });

  test("maps marketplace order line update to listing refs and emits listing snapshot", async () => {
    buildMarketplaceListingSnapshot.mockResolvedValue([
      {
        listingId: "group_10",
        listingType: "group",
        identity: { deterministicId: "group:group_10" },
      },
    ]);

    await emitMarketplaceListingUpdateFromSourceEvent({
      businessId: "biz_1",
      payload: {
        id: "evt_src_2",
        type: EventTypes.MARKETPLACE_ORDER_LINE_UPDATED,
        timestamp: Date.now(),
        data: {
          affectedLines: [
            {
              productId: "variant_10",
              listingId: "group_10",
            },
          ],
        },
        metadata: { correlationId: "corr_2", sequence: 23, businessId: "biz_1" },
      },
    });

    expect(buildMarketplaceListingSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({
        businessId: "biz_1",
        refs: [{ productId: "variant_10", groupId: "group_10" }],
      }),
    );

    expect(eventBus.emitBusinessEvent).toHaveBeenCalledWith(
      EventTypes.MARKETPLACE_LISTING_UPDATED,
      "biz_1",
      expect.objectContaining({
        sourceEventType: EventTypes.MARKETPLACE_ORDER_LINE_UPDATED,
        sourceEventId: "evt_src_2",
        sourceEventSequence: 23,
        sourceBusinessId: "biz_1",
        dedupeKey: "evt_src_2",
      }),
      expect.objectContaining({ correlationId: "corr_2" }),
    );
  });
});
