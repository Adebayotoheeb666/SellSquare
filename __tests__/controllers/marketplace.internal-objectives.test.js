jest.mock("../../models/productModel", () => ({
  findById: jest.fn(),
}));

jest.mock("../../models/inventoryHoldModel", () => ({
  find: jest.fn(),
  updateMany: jest.fn(),
}));

jest.mock("../../models/businessRegistration", () => ({
  findById: jest.fn(),
}));

jest.mock("../../models/businessKycModel", () => ({
  findOne: jest.fn(),
}));

jest.mock("../../models/internalMarketplaceOrderModel", () => ({
  create: jest.fn(),
  findOne: jest.fn(),
}));

jest.mock("../../models/escrowEntryModel", () => ({
  create: jest.fn(),
}));

jest.mock("../../models/businessWalletModel", () => ({
  findOne: jest.fn(),
  create: jest.fn(),
}));

jest.mock("../../models/buyerWalletModel", () => ({
  findOne: jest.fn(),
  create: jest.fn(),
}));

jest.mock("../../services/marketplace/inventoryHoldService", () => ({
  consumeOrderHolds: jest.fn(),
  releaseOrderHolds: jest.fn(),
  finalizeAcceptedOrderHolds: jest.fn(),
}));

jest.mock("../../services/marketplace/orderStateService", () => ({
  normalizeLineDecision: jest.fn(),
  assertValidOrderTransition: jest.fn(),
}));

jest.mock("axios", () => ({
  get: jest.fn(),
}));

jest.mock("../../events/EventEmitter", () => ({
  eventBus: {
    emitBusinessEvent: jest.fn(),
    emitBuyerEvent: jest.fn(),
  },
}));

const axios = require("axios");
const Product = require("../../models/productModel");
const InventoryHold = require("../../models/inventoryHoldModel");
const Business = require("../../models/businessRegistration");
const InternalMarketplaceOrder = require("../../models/internalMarketplaceOrderModel");
const EscrowEntry = require("../../models/escrowEntryModel");
const BuyerWallet = require("../../models/buyerWalletModel");
const {
  consumeOrderHolds,
  releaseOrderHolds,
} = require("../../services/marketplace/inventoryHoldService");
const { eventBus } = require("../../events/EventEmitter");
const {
  checkout,
} = require("../../controllers/buyerMarketplaceController");
const {
  decideInternalOrder,
} = require("../../controllers/internalMarketplaceOrderController");
const { mockRequest, mockResponse } = require("../helpers/testHelpers");

describe("Marketplace objective critical flows", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("checkout splits one cart into per-business internal orders", async () => {
    const buyer = {
      _id: "buyer_1",
      constructor: {
        findById: jest.fn().mockReturnValue({
          select: jest.fn().mockResolvedValue({
            firstName: "Ada",
            lastName: "Buyer",
            email: "ada@example.com",
          }),
        }),
      },
    };

    const holdDocs = [
      {
        _id: "hold_1",
        quantity: 2,
        product: { _id: "prod_1", business: "biz_A", name: "A1", sku: "A1", image: "", price: 1000 },
      },
      {
        _id: "hold_2",
        quantity: 1,
        product: { _id: "prod_2", business: "biz_B", name: "B1", sku: "B1", image: "", price: 500 },
      },
    ];

    InventoryHold.find.mockReturnValue({
      populate: jest.fn().mockResolvedValue(holdDocs),
    });

    axios.get.mockResolvedValue({
      data: {
        data: {
          status: "successful",
          amount_settled: (2 * 1000 + 1 * 500) * 100,
        },
      },
    });

    let orderCounter = 0;
    InternalMarketplaceOrder.create.mockImplementation(async (payload) => {
      orderCounter += 1;
      return {
        _id: `order_${orderCounter}`,
        orderNumber: `IMO-${orderCounter}`,
        ...payload,
        save: jest.fn().mockResolvedValue(true),
      };
    });

    EscrowEntry.create.mockImplementation(async (payload) => ({
      _id: `escrow_${payload.business}`,
      ...payload,
    }));

    Business.findById.mockReturnValue({
      select: jest.fn().mockResolvedValue({ businessName: "Business" }),
    });

    const req = mockRequest(
      {
        paymentReference: "trx_123",
        shippingAddress: "12 Test Street",
      },
      {},
      {},
      null,
      null,
    );
    req.buyer = buyer;
    const res = mockResponse();

    await checkout(req, res);

    expect(InternalMarketplaceOrder.create).toHaveBeenCalledTimes(2);
    expect(EscrowEntry.create).toHaveBeenCalledTimes(2);
    expect(consumeOrderHolds).toHaveBeenCalledTimes(2);
    expect(eventBus.emitBusinessEvent).toHaveBeenCalledWith(
      "marketplace.internal_order.placed",
      expect.any(String),
      expect.objectContaining({
        checkoutSessionRef: expect.any(String),
      }),
    );

    const firstCheckoutRef = InternalMarketplaceOrder.create.mock.calls[0][0].checkoutSessionRef;
    const secondCheckoutRef = InternalMarketplaceOrder.create.mock.calls[1][0].checkoutSessionRef;
    expect(firstCheckoutRef).toBeTruthy();
    expect(firstCheckoutRef).toBe(secondCheckoutRef);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          orders: expect.any(Array),
          checkoutSessionRef: firstCheckoutRef,
        }),
      }),
    );
  });

  test("rejecting internal order refunds buyer wallet and emits notification", async () => {
    const escrowSave = jest.fn().mockResolvedValue(true);
    const escrowEntry = {
      _id: "escrow_1",
      amount: 3200,
      status: "held",
      settledAt: null,
      save: escrowSave,
    };

    const orderSave = jest.fn().mockResolvedValue(true);
    const orderDoc = {
      _id: "order_1",
      orderNumber: "IMO-1",
      status: "payment_confirmed",
      rejectionReason: "",
      buyer_notified_at: null,
      business: "biz_1",
      buyer: { _id: "buyer_1" },
      escrowEntryId: escrowEntry,
      lines: [
        { requestedQty: 2, acceptedQty: 0, rejectedQty: 0, lineStatus: "pending", decisionReason: "" },
      ],
      statusHistory: [],
      save: orderSave,
      populate: jest.fn(),
    };

    InternalMarketplaceOrder.findOne.mockReturnValue({
      populate: jest.fn().mockReturnValue({
        populate: jest.fn().mockResolvedValue(orderDoc),
      }),
    });

    const buyerWallet = {
      balance: 1000,
      currency: "NGN",
      transactions: [],
      save: jest.fn().mockResolvedValue(true),
    };
    BuyerWallet.findOne.mockResolvedValue(buyerWallet);

    const req = mockRequest(
      {
        decision: "rejected",
        reason: "Out of stock",
      },
      { orderId: "order_1" },
    );
    req.business = { _id: "biz_1", businessName: "Demo Biz" };
    const res = mockResponse();

    await decideInternalOrder(req, res);

    expect(orderDoc.status).toBe("rejected");
    expect(escrowEntry.status).toBe("refunded_to_buyer");
    expect(buyerWallet.balance).toBe(4200);
    expect(buyerWallet.transactions[0]).toEqual(
      expect.objectContaining({
        type: "credit",
        amount: 3200,
      }),
    );
    expect(releaseOrderHolds).toHaveBeenCalledWith(
      expect.objectContaining({ orderId: "order_1", reason: "order_rejected" }),
    );
    expect(eventBus.emitBuyerEvent).toHaveBeenCalledWith(
      "marketplace.internal_order.rejected",
      "buyer_1",
      expect.objectContaining({
        orderId: "order_1",
        reason: "Out of stock",
      }),
    );
    expect(res.status).toHaveBeenCalledWith(200);
  });
});
