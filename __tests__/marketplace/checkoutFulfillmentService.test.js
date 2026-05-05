jest.mock("../../models/cartModel", () => ({
  findOneAndUpdate: jest.fn(),
}));

jest.mock("../../models/productModel", () => ({
  findById: jest.fn(),
}));

jest.mock("../../models/productGroupModel", () => ({
  findById: jest.fn(),
}));

jest.mock("../../models/checkOutSalesModel", () => ({
  create: jest.fn(),
}));

const Cart = require("../../models/cartModel");
const Product = require("../../models/productModel");
const ProductGroup = require("../../models/productGroupModel");
const CheckOut = require("../../models/checkOutSalesModel");
const {
  fulfillMarketplaceOrderToCheckout,
} = require("../../services/marketplace/checkoutFulfillmentService");

describe("checkoutFulfillmentService", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  test("accepted group variant line updates both Product and ProductGroup histories", async () => {
    const productDoc = {
      _id: "variant_1",
      name: "Variant One",
      productIsaGroup: true,
      itemGroup: "group_1",
      isProductUnique: false,
      quantity: 5,
      history: [],
      save: jest.fn().mockResolvedValue(true),
    };

    const productGroupDoc = {
      _id: "group_1",
      combinations: ["Variant One"],
      quantity: [10],
      history: [],
      save: jest.fn().mockResolvedValue(true),
    };

    const cartDoc = {
      items: [],
      save: jest.fn().mockResolvedValue(true),
    };

    Product.findById.mockResolvedValue(productDoc);
    ProductGroup.findById.mockResolvedValue(productGroupDoc);
    Cart.findOneAndUpdate.mockResolvedValue(cartDoc);
    CheckOut.create.mockResolvedValue({ _id: "checkout_1", orderId: "CHK-001" });

    await fulfillMarketplaceOrderToCheckout({
      business: { _id: "biz_1", businessName: "Demo Biz" },
      order: { _id: "order_1" },
      acceptedLines: [
        {
          product: "variant_1",
          productGroup: "group_1",
          isGroupVariant: true,
          name: "Variant One",
          sku: "SKU-1",
          acceptedQty: 2,
          effectiveUnitPrice: 100,
        },
      ],
      customer: { name: "Jane" },
    });

    expect(productDoc.quantity).toBe(3);
    expect(productDoc.history).toHaveLength(1);
    expect(productDoc.history[0]).toMatchObject({
      type: "sale",
      quantityChange: -2,
      balance: 3,
      amount: 100,
    });

    expect(productGroupDoc.quantity[0]).toBe(8);
    expect(productGroupDoc.history).toHaveLength(1);
    expect(productGroupDoc.history[0]).toMatchObject({
      type: "sale",
      itemName: "Variant One",
      quantityChange: -2,
      amount: 100,
    });

    expect(productDoc.save).toHaveBeenCalledTimes(1);
    expect(productGroupDoc.save).toHaveBeenCalledTimes(1);
  });
});
