const { saleEventMiddleware } = require("../../events/eventMiddleware");
const { eventBus } = require("../../events/EventEmitter");

describe("Sale event middleware dedupe guard", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  const buildReqRes = (path) => {
    const req = {
      method: "POST",
      path,
      business: { _id: "biz_1" },
      user: { email: "owner@example.com" },
      get: jest.fn(() => "jest-agent"),
      ip: "127.0.0.1",
    };

    const originalJson = jest.fn((data) => data);
    const res = {
      statusCode: 201,
      json: originalJson,
    };

    return { req, res, originalJson };
  };

  test("does not emit middleware sale event for checkout route", () => {
    const emitSpy = jest
      .spyOn(eventBus, "emitBusinessEvent")
      .mockReturnValue(null);

    const { req, res, originalJson } = buildReqRes("/checkout");
    const next = jest.fn();

    saleEventMiddleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);

    const payload = {
      checkOut: {
        _id: "checkout_1",
        items: [{ _id: "item_1", quantity: 1, price: 500 }],
        customer: { name: "Alice" },
      },
      cart: { _id: "cart_1" },
    };

    res.json(payload);

    expect(emitSpy).not.toHaveBeenCalled();
    expect(originalJson).toHaveBeenCalledWith(payload);
  });

  test("does not emit middleware sale event for returned-goods route", () => {
    const emitSpy = jest
      .spyOn(eventBus, "emitBusinessEvent")
      .mockReturnValue(null);

    const { req, res, originalJson } = buildReqRes("/returned-goods/checkout_1");
    const next = jest.fn();

    saleEventMiddleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);

    const payload = {
      checkouts: [],
      message: "returned items processed successfully",
    };

    res.json(payload);

    expect(emitSpy).not.toHaveBeenCalled();
    expect(originalJson).toHaveBeenCalledWith(payload);
  });

  test("emits middleware sale event for non-checkout sale route", () => {
    const emitSpy = jest
      .spyOn(eventBus, "emitBusinessEvent")
      .mockReturnValue(null);

    const { req, res, originalJson } = buildReqRes("/manual-sale");
    const next = jest.fn();

    saleEventMiddleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);

    const payload = {
      _id: "checkout_2",
      items: [{ name: "Soap", quantity: 2, price: 500 }],
      customer: { name: "Bob" },
      createdAt: new Date().toISOString(),
    };

    res.json(payload);

    expect(emitSpy).toHaveBeenCalledTimes(1);
    expect(emitSpy).toHaveBeenCalledWith(
      "sale.completed",
      "biz_1",
      expect.objectContaining({
        _id: "checkout_2",
        saleId: "checkout_2",
        items: expect.arrayContaining([
          expect.objectContaining({ name: "Soap", quantity: 2, price: 500 }),
        ]),
        customer: expect.objectContaining({ name: "Bob" }),
      }),
      expect.objectContaining({
        source: "event_middleware",
        path: "/manual-sale",
        method: "POST",
      }),
    );
    expect(originalJson).toHaveBeenCalledWith(payload);
  });
});
