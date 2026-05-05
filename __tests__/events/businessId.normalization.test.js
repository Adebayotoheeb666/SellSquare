const { eventBus, EventTypes } = require("../../events/EventEmitter");
const { cartEventMiddleware } = require("../../events/eventMiddleware");

describe("businessId normalization", () => {
  afterEach(() => {
    jest.restoreAllMocks();
    eventBus.semanticEvents.clear();
    eventBus.eventBatches.clear();
    eventBus.sequenceNumbers.clear();
  });

  test("EventBus emits payload with string-normalized metadata.businessId", () => {
    const businessIdObject = {
      toString: () => "biz_obj_1",
    };

    const payload = eventBus.emitBusinessEvent(
      EventTypes.CART_UPDATED,
      businessIdObject,
      {
        _id: "cart_1",
        user: { email: "alice@example.com" },
        items: [],
      },
      { source: "unit_test" },
    );

    expect(payload).toBeTruthy();
    expect(payload.metadata.businessId).toBe("biz_obj_1");
    expect(typeof payload.metadata.businessId).toBe("string");
  });

  test("eventMiddleware passes normalized businessId string to emitBusinessEvent", () => {
    const emitSpy = jest
      .spyOn(eventBus, "emitBusinessEvent")
      .mockReturnValue(null);

    const req = {
      method: "PATCH",
      path: "/set-quantity",
      business: { _id: { toString: () => "biz_obj_2" } },
      user: { email: "owner@example.com" },
      get: jest.fn(() => "jest-agent"),
      ip: "127.0.0.1",
    };

    const originalJson = jest.fn((data) => data);
    const res = {
      statusCode: 200,
      json: originalJson,
    };

    const next = jest.fn();
    cartEventMiddleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);

    const cart = {
      _id: "cart_2",
      user: { email: "alice@example.com" },
      items: [{ _id: "item_1", quantity: 1, price: 100 }],
    };

    res.json(cart);

    expect(emitSpy).toHaveBeenCalledTimes(1);
    expect(emitSpy).toHaveBeenCalledWith(
      EventTypes.CART_UPDATED,
      "biz_obj_2",
      expect.any(Object),
      expect.objectContaining({ source: "event_middleware" }),
    );
  });
});
