jest.mock("../../models/marketplaceOrderModel", () => ({
  MarketplaceOrder: {
    findOne: jest.fn(),
  },
}));

jest.mock("../../services/marketplace/inventoryHoldService", () => ({
  createLineHold: jest.fn(),
  releaseOrderHolds: jest.fn(),
  releaseLineHold: jest.fn(),
  consumeOrderHolds: jest.fn(),
  expireStaleHolds: jest.fn(),
  getActiveHeldQuantity: jest.fn(),
}));

jest.mock("../../services/marketplace/checkoutFulfillmentService", () => ({
  fulfillMarketplaceOrderToCheckout: jest.fn().mockResolvedValue({
    checkOut: { _id: "co_1", orderId: "checkout_1" },
  }),
  SYSTEM_MARKETPLACE_USER: { email: "system@marketplace.local" },
}));

jest.mock("../../services/marketplace/webhookEventBuilder", () => ({
  buildOrderLineSnapshots: jest.fn().mockResolvedValue([
    {
      lineId: "line-1",
      productId: "product-1",
      requestedQty: 2,
      acceptedQty: 2,
      rejectedQty: 0,
      decisionStatus: "accepted",
      decisionReason: "ok",
      variantId: "variant-1",
      parentGroupId: "group-1",
      groupName: "Group 1",
      variantImage: "https://example.com/variant.jpg",
      groupImage: "https://example.com/group.jpg",
      selectedImage: "https://example.com/variant.jpg",
    },
  ]),
}));

jest.mock("../../events", () => ({
  eventBus: {
    emitBusinessEvent: jest.fn(),
  },
}));

const { MarketplaceOrder } = require("../../models/marketplaceOrderModel");
const { eventBus } = require("../../events");
const {
  buildOrderLineSnapshots,
} = require("../../services/marketplace/webhookEventBuilder");
const {
  fulfillMarketplaceOrderToCheckout,
} = require("../../services/marketplace/checkoutFulfillmentService");
const {
  confirmMarketplacePayment,
  applyMarketplaceLineDecisions,
} = require("../../controllers/publicMarketplaceOrderController");

const createRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const createOrderDoc = (overrides = {}) => {
  return {
    _id: "order-1",
    status: "placed",
    partnerOrderRef: "nino-order-1",
    payment: {
      paymentId: "",
      trustedPaidFlag: false,
      partnerPaymentMeta: {},
    },
    warnings: [],
    lines: [
      {
        lineId: "line-1",
        requestedQty: 2,
        acceptedQty: 0,
        rejectedQty: 0,
        lineStatus: "pending",
        decisionReason: "",
        effectiveUnitPrice: 100,
      },
    ],
    totals: {
      acceptedSubtotal: 0,
      rejectedSubtotal: 0,
    },
    statusHistory: [],
    toObject() {
      return {
        _id: "order-1",
        status: this.status,
        partnerOrderRef: this.partnerOrderRef,
        lines: this.lines,
      };
    },
    save: jest.fn().mockResolvedValue(true),
    ...overrides,
  };
};

describe("marketplace order webhook stream integration", () => {
  beforeEach(() => {
    buildOrderLineSnapshots.mockResolvedValue([
      {
        lineId: "line-1",
        productId: "product-1",
        requestedQty: 2,
        acceptedQty: 2,
        rejectedQty: 0,
        decisionStatus: "accepted",
        decisionReason: "ok",
        variantId: "variant-1",
        parentGroupId: "group-1",
        groupName: "Group 1",
        variantImage: "https://example.com/variant.jpg",
        groupImage: "https://example.com/group.jpg",
        selectedImage: "https://example.com/variant.jpg",
      },
    ]);

    fulfillMarketplaceOrderToCheckout.mockResolvedValue({
      checkOut: { _id: "co_1", orderId: "checkout_1" },
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test("emits payment confirmed lifecycle webhook event payload", async () => {
    const order = createOrderDoc({ status: "placed" });
    MarketplaceOrder.findOne.mockResolvedValue(order);

    const req = {
      params: { orderId: "order-1" },
      body: { paymentId: "pay_1" },
      business: { _id: "biz-1" },
    };
    const res = createRes();
    const next = jest.fn((error) => {
      if (error) throw error;
    });

    await confirmMarketplacePayment(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(eventBus.emitBusinessEvent).toHaveBeenCalledWith(
      "marketplace.order.payment_confirmed",
      "biz-1",
      expect.objectContaining({
        orderId: "order-1",
        order: expect.any(Object),
        lines: expect.any(Array),
        affectedLines: expect.any(Array),
      }),
      expect.any(Object),
    );
  });

  test("emits line-level event with affected lines after line decision", async () => {
    const order = createOrderDoc({ status: "payment_confirmed" });
    MarketplaceOrder.findOne.mockResolvedValue(order);

    const req = {
      params: { orderId: "order-1" },
      body: {
        decisions: [
          {
            lineId: "line-1",
            acceptedQty: 2,
            rejectedQty: 0,
            reason: "confirmed",
          },
        ],
      },
      business: { _id: "biz-1" },
    };
    const res = createRes();
    const next = jest.fn((error) => {
      if (error) throw error;
    });

    await applyMarketplaceLineDecisions(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(eventBus.emitBusinessEvent).toHaveBeenCalledWith(
      "marketplace.order.line.updated",
      "biz-1",
      expect.objectContaining({
        lines: expect.any(Array),
        affectedLines: expect.any(Array),
      }),
      expect.any(Object),
    );
  });
});
