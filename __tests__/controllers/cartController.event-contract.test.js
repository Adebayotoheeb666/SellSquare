const Cart = require("../../models/cartModel");
const Product = require("../../models/productModel");
const {
  setPrice,
  increaseCartItems,
} = require("../../controllers/cartController");
const { mockRequest, mockResponse } = require("../helpers/testHelpers");

jest.mock("../../models/cartModel");
jest.mock("../../models/productModel");

const mockEmitBusinessEvent = jest.fn();

jest.mock("../../events", () => ({
  eventBus: {
    emitBusinessEvent: (...args) => mockEmitBusinessEvent(...args),
  },
  EventTypes: {
    CART_UPDATED: "cart.updated",
  },
}));

describe("Cart controller event contract", () => {
  const business = { _id: "biz_1" };
  const user = { email: "alice@example.com", name: "Alice" };

  let cartDoc;

  beforeEach(() => {
    jest.clearAllMocks();

    cartDoc = {
      _id: "cart_1",
      user: { email: "alice@example.com" },
      items: [{ _id: "item_1", quantity: 1, price: 100 }],
      save: jest.fn().mockResolvedValue(null),
    };
    cartDoc.save.mockResolvedValue(cartDoc);

    Cart.findOne = jest.fn().mockResolvedValue(cartDoc);
    Product.findOne = jest.fn().mockResolvedValue({
      _id: "prod_1",
      business: "biz_1",
      quantity: 20,
    });
  });

  test("setPrice emits cart.updated with businessId string and full cart payload", async () => {
    const req = mockRequest(
      {
        id: "prod_1",
        cartId: "item_1",
        price: 250,
        email: "alice@example.com",
      },
      {},
      {},
      user,
      business,
    );
    const res = mockResponse();

    await setPrice(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(cartDoc);

    expect(mockEmitBusinessEvent).toHaveBeenCalledTimes(1);
    expect(mockEmitBusinessEvent).toHaveBeenCalledWith(
      "cart.updated",
      "biz_1",
      expect.objectContaining({
        _id: "cart_1",
        user: expect.objectContaining({ email: "alice@example.com" }),
        items: expect.arrayContaining([
          expect.objectContaining({ _id: "item_1", price: 250 }),
        ]),
      }),
      expect.objectContaining({
        type: "price_update",
        source: "inventory-app",
      }),
    );
  });

  test("increaseCartItems emits cart.updated with quantity update metadata", async () => {
    const req = mockRequest(
      {
        id: "prod_1",
        cartId: "item_1",
        quantity: 4,
        email: "alice@example.com",
      },
      {},
      {},
      user,
      business,
    );
    const res = mockResponse();

    await increaseCartItems(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.send).toHaveBeenCalledWith(cartDoc);

    expect(mockEmitBusinessEvent).toHaveBeenCalledTimes(1);
    expect(mockEmitBusinessEvent).toHaveBeenCalledWith(
      "cart.updated",
      "biz_1",
      expect.objectContaining({
        _id: "cart_1",
        items: expect.arrayContaining([
          expect.objectContaining({ _id: "item_1", quantity: 4 }),
        ]),
      }),
      expect.objectContaining({
        type: "quantity_update",
        source: "inventory-app",
      }),
    );
  });
});
