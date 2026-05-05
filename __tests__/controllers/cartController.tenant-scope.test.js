const Cart = require("../../models/cartModel");
const Product = require("../../models/productModel");
const {
  setPrice,
  setCartQuantity,
} = require("../../controllers/cartController");
const { mockRequest, mockResponse } = require("../helpers/testHelpers");

jest.mock("../../models/cartModel");
jest.mock("../../models/productModel");
jest.mock("../../events", () => ({
  eventBus: { emitBusinessEvent: jest.fn() },
  EventTypes: { CART_UPDATED: "cart.updated" },
}));

describe("Cart controller tenant scoping", () => {
  const business = { _id: "biz_1" };
  const baseUser = { email: "alice@example.com", name: "Alice" };

  const cartDoc = {
    _id: "cart_1",
    user: { email: "alice@example.com" },
    items: [{ _id: "item_1", quantity: 1, price: 100 }],
    save: jest.fn().mockResolvedValue(this),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    cartDoc.save = jest.fn().mockResolvedValue(cartDoc);

    Cart.findOne = jest.fn().mockResolvedValue(cartDoc);
    Product.findOne = jest.fn().mockResolvedValue(null);
  });

  test("setPrice rejects product outside business scope", async () => {
    const req = mockRequest(
      {
        id: "foreign_product",
        cartId: "item_1",
        price: 999,
        email: "alice@example.com",
      },
      {},
      {},
      baseUser,
      business,
    );
    const res = mockResponse();

    await expect(setPrice(req, res)).rejects.toThrow("Product not found");

    expect(Product.findOne).toHaveBeenCalledWith({
      _id: "foreign_product",
      business: "biz_1",
    });
    expect(res.status).toHaveBeenCalledWith(404);
    expect(cartDoc.save).not.toHaveBeenCalled();
  });

  test("setCartQuantity rejects product outside business scope", async () => {
    const req = mockRequest(
      {
        id: "foreign_product",
        cartId: "item_1",
        quantity: 3,
        email: "alice@example.com",
      },
      {},
      {},
      baseUser,
      business,
    );
    const res = mockResponse();

    await expect(setCartQuantity(req, res)).rejects.toThrow("Product not found");

    expect(Product.findOne).toHaveBeenCalledWith({
      _id: "foreign_product",
      business: "biz_1",
    });
    expect(res.status).toHaveBeenCalledWith(404);
    expect(cartDoc.save).not.toHaveBeenCalled();
  });
});
