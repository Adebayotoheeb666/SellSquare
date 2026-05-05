const { eventBus } = require("../../events/EventEmitter");

describe("EventBus semantic dedupe", () => {
  afterEach(() => {
    eventBus.semanticEvents.clear();
    eventBus.eventBatches.clear();
  });

  test("drops duplicate semantic event across middleware and change stream sources", () => {
    const first = eventBus.emitBusinessEvent(
      "product.updated",
      "biz_1",
      { _id: "prod_1", name: "Item" },
      { source: "event_middleware", dedupeKey: "product.updated:prod_1" },
    );

    const second = eventBus.emitBusinessEvent(
      "product.updated",
      "biz_1",
      { _id: "prod_1", name: "Item" },
      { source: "change_stream", dedupeKey: "product.updated:prod_1" },
    );

    expect(first).toBeTruthy();
    expect(second).toBeNull();
  });
});
