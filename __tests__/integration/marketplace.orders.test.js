jest.mock("../../models/marketplaceOrderModel", () => ({
  MarketplaceOrder: {
    create: jest.fn(),
    findOne: jest.fn(),
  },
}));

jest.mock("../../services/marketplace/marketplaceLineResolver", () => ({
  resolveMarketplaceLineIdentity: jest.fn(),
}));

jest.mock("../../services/marketplace/discountResolver", () => ({
  resolveEffectiveDiscount: jest.fn(),
}));

jest.mock("../../services/marketplace/inventoryHoldService", () => ({
  createLineHold: jest.fn(),
  releaseOrderHolds: jest.fn(),
  releaseLineHold: jest.fn(),
  consumeOrderHolds: jest.fn(),
  expireStaleHolds: jest.fn(),
  getActiveHeldQuantity: jest.fn(),
}));

jest.mock("../../services/marketplace/idempotencyService", () => ({
  completeIdempotencyKey: jest.fn(),
}));

jest.mock("../../services/marketplace/webhookEventBuilder", () => ({
  buildOrderLineSnapshots: jest.fn().mockResolvedValue([]),
}));

jest.mock("../../events", () => ({
  eventBus: {
    emitBusinessEvent: jest.fn(),
  },
}));

const { MarketplaceOrder } = require("../../models/marketplaceOrderModel");
const {
  resolveMarketplaceLineIdentity,
} = require("../../services/marketplace/marketplaceLineResolver");
const { resolveEffectiveDiscount } = require("../../services/marketplace/discountResolver");
const {
  createLineHold,
  getActiveHeldQuantity,
} = require("../../services/marketplace/inventoryHoldService");
const {
  buildOrderLineSnapshots,
} = require("../../services/marketplace/webhookEventBuilder");
const {
  createMarketplaceOrder,
  getMarketplaceOrder,
} = require("../../controllers/publicMarketplaceOrderController");

const createRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe("marketplace orders integration", () => {
  beforeEach(() => {
    buildOrderLineSnapshots.mockResolvedValue([]);
    resolveEffectiveDiscount.mockResolvedValue({
      effectivePrice: 100,
      discount: null,
    });
    getActiveHeldQuantity.mockResolvedValue(0);
    MarketplaceOrder.create.mockImplementation(async (payload) => ({
      _id: "order_1",
      ...payload,
      save: jest.fn().mockResolvedValue(true),
      toObject() {
        return this;
      },
    }));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test("rejects malformed create order payload", async () => {
    const req = {
      business: { _id: "b1" },
      partnerCredential: { _id: "cred1" },
      get: jest.fn().mockReturnValue("idem_1"),
      body: {
        externalOrderId: "",
        customer: { name: "", phone: "" },
        lines: [],
      },
    };
    const res = createRes();
    const next = jest.fn((error) => {
      if (error) throw error;
    });

    await createMarketplaceOrder(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  test("creates order from group listing identity using listingId + variantId", async () => {
    resolveMarketplaceLineIdentity.mockResolvedValue({
      resolvedProduct: {
        _id: "variant_1",
        itemGroup: "group_1",
        productIsaGroup: true,
        sku: "SKU-1",
        name: "Variant 1",
        price: 100,
        quantity: 10,
      },
      resolvedGroupId: "group_1",
      isGroupVariant: true,
      canonicalListingId: "group_1",
      canonicalVariantId: "variant_1",
    });

    const req = {
      business: { _id: "b1", businessName: "Demo Biz" },
      partnerCredential: { _id: "cred1", keyId: "key_1" },
      get: jest.fn().mockReturnValue("idem_2"),
      body: {
        lines: [
          {
            lineId: "line_1",
            listingId: "group_1",
            variantId: "variant_1",
            quantity: 2,
          },
        ],
      },
    };
    const res = createRes();
    const next = jest.fn((error) => {
      if (error) throw error;
    });

    await createMarketplaceOrder(req, res, next);

    expect(resolveMarketplaceLineIdentity).toHaveBeenCalledWith({
      businessId: "b1",
      lineInput: req.body.lines[0],
    });
    expect(MarketplaceOrder.create).toHaveBeenCalledWith(
      expect.objectContaining({
        lines: [
          expect.objectContaining({
            product: "variant_1",
            productGroup: "group_1",
            isGroupVariant: true,
            listingId: "group_1",
            variantId: "variant_1",
          }),
        ],
      }),
    );
    expect(createLineHold).toHaveBeenCalledWith(
      expect.objectContaining({
        productId: "variant_1",
        productGroupId: "group_1",
        quantity: 2,
      }),
    );
    expect(res.status).toHaveBeenCalledWith(201);
    expect(next).not.toHaveBeenCalled();
  });

  test("legacy productId line still creates order", async () => {
    resolveMarketplaceLineIdentity.mockResolvedValue({
      resolvedProduct: {
        _id: "product_legacy",
        itemGroup: null,
        productIsaGroup: false,
        sku: "SKU-LEGACY",
        name: "Legacy Product",
        price: 50,
        quantity: 5,
      },
      resolvedGroupId: null,
      isGroupVariant: false,
      canonicalListingId: "product_legacy",
      canonicalVariantId: "product_legacy",
    });

    const req = {
      business: { _id: "b1", businessName: "Demo Biz" },
      partnerCredential: { _id: "cred1", keyId: "key_1" },
      get: jest.fn().mockReturnValue("idem_3"),
      body: {
        lines: [
          {
            lineId: "line_legacy",
            productId: "product_legacy",
            quantity: 1,
          },
        ],
      },
    };
    const res = createRes();
    const next = jest.fn((error) => {
      if (error) throw error;
    });

    await createMarketplaceOrder(req, res, next);

    expect(MarketplaceOrder.create).toHaveBeenCalledWith(
      expect.objectContaining({
        lines: [
          expect.objectContaining({
            product: "product_legacy",
            productGroup: null,
            listingId: "product_legacy",
            variantId: "product_legacy",
          }),
        ],
      }),
    );
    expect(res.status).toHaveBeenCalledWith(201);
    expect(next).not.toHaveBeenCalled();
  });

  test("downgrades line to out_of_stock when atomic hold reservation fails", async () => {
    resolveMarketplaceLineIdentity.mockResolvedValue({
      resolvedProduct: {
        _id: "product_race",
        itemGroup: null,
        productIsaGroup: false,
        sku: "SKU-RACE",
        name: "Racy Item",
        price: 75,
        quantity: 1,
      },
      resolvedGroupId: null,
      isGroupVariant: false,
      canonicalListingId: "product_race",
      canonicalVariantId: "product_race",
    });

    createLineHold.mockRejectedValueOnce(
      Object.assign(new Error("Insufficient stock to reserve inventory hold"), {
        code: "INSUFFICIENT_STOCK_HOLD_CAPACITY",
      }),
    );

    const req = {
      business: { _id: "b1", businessName: "Demo Biz" },
      partnerCredential: { _id: "cred1", keyId: "key_1" },
      get: jest.fn().mockReturnValue("idem_race_1"),
      body: {
        lines: [
          {
            lineId: "line_race",
            productId: "product_race",
            quantity: 1,
          },
        ],
      },
    };
    const res = createRes();
    const next = jest.fn((error) => {
      if (error) throw error;
    });

    await createMarketplaceOrder(req, res, next);

    expect(MarketplaceOrder.create).toHaveBeenCalledWith(
      expect.objectContaining({
        lines: [
          expect.objectContaining({
            lineId: "line_race",
            lineStatus: "out_of_stock",
            rejectedQty: 1,
            acceptedQty: 0,
          }),
        ],
      }),
    );
    expect(res.status).toHaveBeenCalledWith(201);
    expect(next).not.toHaveBeenCalled();
  });

  test("creates order with optional fulfillment, shipping, and line image metadata", async () => {
    resolveMarketplaceLineIdentity.mockResolvedValue({
      resolvedProduct: {
        _id: "variant_2",
        itemGroup: "group_2",
        productIsaGroup: true,
        sku: "SKU-2",
        name: "Variant 2",
        price: 120,
        quantity: 20,
      },
      resolvedGroupId: "group_2",
      isGroupVariant: true,
      canonicalListingId: "group_2",
      canonicalVariantId: "variant_2",
    });

    const req = {
      business: { _id: "b1", businessName: "Demo Biz" },
      partnerCredential: { _id: "cred1", keyId: "key_1" },
      get: jest.fn().mockReturnValue("idem_4"),
      body: {
        customer: {
          name: "Buyer One",
          phone: "+2348000000000",
          email: "buyer@example.com",
        },
        shippingAddress: {
          name: "Buyer One",
          phone: "+2348000000000",
          addressLine1: "12 Market Street",
          city: "Lagos",
          country: "NG",
        },
        fulfillment: {
          method: "delivery",
          pickupLocation: "Victoria Island Hub",
        },
        lines: [
          {
            lineId: "line_2",
            listingId: "group_2",
            variantId: "variant_2",
            quantity: 3,
            selectedImage: "https://cdn.example.com/selected.jpg",
            lineMeta: {
              variantImage: "https://cdn.example.com/variant.jpg",
              groupImage: "https://cdn.example.com/group.jpg",
            },
          },
        ],
      },
    };

    const res = createRes();
    const next = jest.fn((error) => {
      if (error) throw error;
    });

    await createMarketplaceOrder(req, res, next);

    expect(MarketplaceOrder.create).toHaveBeenCalledWith(
      expect.objectContaining({
        shippingAddress: expect.objectContaining({
          addressLine1: "12 Market Street",
          city: "Lagos",
        }),
        fulfillment: expect.objectContaining({
          method: "delivery",
          pickupLocation: "Victoria Island Hub",
        }),
        lines: [
          expect.objectContaining({
            selectedImage: "https://cdn.example.com/selected.jpg",
            variantImage: "https://cdn.example.com/variant.jpg",
            groupImage: "https://cdn.example.com/group.jpg",
            lineMeta: expect.objectContaining({
              variantImage: "https://cdn.example.com/variant.jpg",
              groupImage: "https://cdn.example.com/group.jpg",
            }),
          }),
        ],
      }),
    );
    expect(res.status).toHaveBeenCalledWith(201);
    expect(next).not.toHaveBeenCalled();
  });

  test("order read returns persisted optional metadata fields", async () => {
    const storedOrder = {
      _id: "order_read_1",
      business: "b1",
      shippingAddress: {
        addressLine1: "12 Market Street",
        city: "Lagos",
      },
      fulfillment: {
        method: "pickup",
      },
      lines: [
        {
          lineId: "line_1",
          selectedImage: "https://cdn.example.com/selected.jpg",
          lineMeta: {
            variantImage: "https://cdn.example.com/variant.jpg",
          },
        },
      ],
    };

    MarketplaceOrder.findOne.mockReturnValue({
      lean: jest.fn().mockResolvedValue(storedOrder),
    });

    const req = {
      params: { orderId: "order_read_1" },
      business: { _id: "b1" },
    };
    const res = createRes();
    const next = jest.fn((error) => {
      if (error) throw error;
    });

    await getMarketplaceOrder(req, res, next);

    expect(MarketplaceOrder.findOne).toHaveBeenCalledWith({
      _id: "order_read_1",
      business: "b1",
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ order: storedOrder });
    expect(next).not.toHaveBeenCalled();
  });
});
