const { cartEventMiddleware } = require("../../events/eventMiddleware");
const { eventBus, EventTypes } = require("../../events/EventEmitter");

describe("Cart event middleware contract", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("emits cart.updated with full cart payload including items and user identity", () => {
    const emitSpy = jest
      .spyOn(eventBus, "emitBusinessEvent")
      .mockReturnValue(null);

    const req = {
      method: "PATCH",
      path: "/set-quantity",
      business: { _id: "biz_1" },
      user: { email: "actor@example.com" },
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
      _id: "cart_1",
      user: { email: "alice@example.com" },
      items: [{ _id: "item_1", quantity: 2, price: 400 }],
      updatedAt: new Date().toISOString(),
    };

    res.json(cart);

    expect(emitSpy).toHaveBeenCalledTimes(1);
    expect(emitSpy).toHaveBeenCalledWith(
      EventTypes.CART_UPDATED,
      "biz_1",
      expect.objectContaining({
        _id: "cart_1",
        user: expect.objectContaining({ email: "alice@example.com" }),
        items: expect.arrayContaining([
          expect.objectContaining({ _id: "item_1", quantity: 2 }),
        ]),
        userId: "alice@example.com",
      }),
      expect.objectContaining({
        source: "event_middleware",
        method: "PATCH",
      }),
    );

    expect(originalJson).toHaveBeenCalledWith(cart);
  });
});
