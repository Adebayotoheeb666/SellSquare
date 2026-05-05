jest.mock("../../middleWare/authMiddleware", () =>
  jest.fn((req, res, next) => next()),
);

jest.mock("../../events", () => ({
  cartEventMiddleware: jest.fn((req, res, next) => next()),
  saleEventMiddleware: jest.fn((req, res, next) => next()),
}));

jest.mock("../../controllers/cartController", () => ({
  addToCart: jest.fn(),
  getCart: jest.fn(),
  getCheckOuts: jest.fn(),
  getAllCheckOuts: jest.fn(),
  getCheckoutYears: jest.fn(),
  increaseCartItems: jest.fn(),
  checkoutCart: jest.fn(),
  decreaseCartitems: jest.fn(),
  deleteCartItem: jest.fn(),
  generateReceipt: jest.fn(),
  sendReceipt: jest.fn(),
  sendReceiptToPrinter: jest.fn(),
  setCartQuantity: jest.fn(),
  setPrice: jest.fn(),
  returnItemSold: jest.fn(),
  getCustomers: jest.fn(),
  getIncompletePayments: jest.fn(),
  updateIncompletePayment: jest.fn(),
  updateDeliveryStatus: jest.fn(),
}));

const protect = require("../../middleWare/authMiddleware");
const { cartEventMiddleware, saleEventMiddleware } = require("../../events");
const cartController = require("../../controllers/cartController");
const router = require("../../routes/cartRoute");

const getRouteHandlers = (path, method) => {
  const layer = router.stack.find(
    (entry) =>
      entry.route &&
      entry.route.path === path &&
      entry.route.methods[method.toLowerCase()],
  );

  if (!layer) {
    return null;
  }

  return layer.route.stack.map((routeLayer) => routeLayer.handle);
};

describe("cartRoute middleware composition", () => {
  test("uses protect + cartEventMiddleware for cart mutation routes", () => {
    expect(getRouteHandlers("/add-to-cart/:id", "post")).toEqual([
      protect,
      cartEventMiddleware,
      cartController.addToCart,
    ]);

    expect(getRouteHandlers("/increase", "post")).toEqual([
      protect,
      cartEventMiddleware,
      cartController.increaseCartItems,
    ]);

    expect(getRouteHandlers("/set-quantity", "post")).toEqual([
      protect,
      cartEventMiddleware,
      cartController.setCartQuantity,
    ]);

    expect(getRouteHandlers("/set-price", "post")).toEqual([
      protect,
      cartEventMiddleware,
      cartController.setPrice,
    ]);

    expect(getRouteHandlers("/decrease", "post")).toEqual([
      protect,
      cartEventMiddleware,
      cartController.decreaseCartitems,
    ]);

    expect(getRouteHandlers("/delete-cart-item/:id", "delete")).toEqual([
      protect,
      cartEventMiddleware,
      cartController.deleteCartItem,
    ]);
  });

  test("uses protect + saleEventMiddleware for checkout and returned-goods", () => {
    expect(getRouteHandlers("/checkout", "post")).toEqual([
      protect,
      saleEventMiddleware,
      cartController.checkoutCart,
    ]);

    expect(getRouteHandlers("/returned-goods/:id", "post")).toEqual([
      protect,
      saleEventMiddleware,
      cartController.returnItemSold,
    ]);
  });
});
