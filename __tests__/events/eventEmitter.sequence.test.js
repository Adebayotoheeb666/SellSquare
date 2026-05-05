const { eventBus, EventTypes } = require("../../events/EventEmitter");

describe("EventBus sequence ordering", () => {
  afterEach(() => {
    eventBus.semanticEvents.clear();
    eventBus.eventBatches.clear();
    eventBus.sequenceNumbers.clear();
    eventBus.processedEvents.clear();
  });

  test("increments sequence monotonically per business", () => {
    const bizAEvent1 = eventBus.emitBusinessEvent(
      EventTypes.CART_UPDATED,
      "biz_A",
      { _id: "cart_1" },
      { source: "unit_test", dedupeKey: "cart.updated:cart_1" },
    );

    const bizBEvent1 = eventBus.emitBusinessEvent(
      EventTypes.CART_UPDATED,
      "biz_B",
      { _id: "cart_2" },
      { source: "unit_test", dedupeKey: "cart.updated:cart_2" },
    );

    const bizAEvent2 = eventBus.emitBusinessEvent(
      EventTypes.CART_UPDATED,
      "biz_A",
      { _id: "cart_3" },
      { source: "unit_test", dedupeKey: "cart.updated:cart_3" },
    );

    const bizBEvent2 = eventBus.emitBusinessEvent(
      EventTypes.PRODUCT_UPDATED,
      "biz_B",
      { _id: "prod_1" },
      { source: "unit_test", dedupeKey: "product.updated:prod_1" },
    );

    const bizAEvent3 = eventBus.emitBusinessEvent(
      EventTypes.PRODUCT_UPDATED,
      "biz_A",
      { _id: "prod_2" },
      { source: "unit_test", dedupeKey: "product.updated:prod_2" },
    );

    expect(bizAEvent1.metadata.sequence).toBe(1);
    expect(bizAEvent2.metadata.sequence).toBe(2);
    expect(bizAEvent3.metadata.sequence).toBe(3);

    expect(bizBEvent1.metadata.sequence).toBe(1);
    expect(bizBEvent2.metadata.sequence).toBe(2);
  });

  test("keeps sequence continuity when businessId arrives as object then string", () => {
    const objectBusinessId = { toString: () => "biz_norm_1" };

    const first = eventBus.emitBusinessEvent(
      EventTypes.CART_UPDATED,
      objectBusinessId,
      { _id: "cart_11" },
      { source: "unit_test", dedupeKey: "cart.updated:cart_11" },
    );

    const second = eventBus.emitBusinessEvent(
      EventTypes.CART_UPDATED,
      "biz_norm_1",
      { _id: "cart_12" },
      { source: "unit_test", dedupeKey: "cart.updated:cart_12" },
    );

    expect(first.metadata.businessId).toBe("biz_norm_1");
    expect(second.metadata.businessId).toBe("biz_norm_1");
    expect(first.metadata.sequence).toBe(1);
    expect(second.metadata.sequence).toBe(2);
  });
});
