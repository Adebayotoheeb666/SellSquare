jest.mock("axios", () => ({
  post: jest.fn().mockResolvedValue({ status: 200, data: { ok: true } }),
}));

jest.mock("../../models/marketplaceWebhookEndpointModel", () => ({
  findById: jest.fn().mockReturnValue({
    select: jest.fn().mockResolvedValue({
      _id: "endpoint_1",
      status: "active",
      url: "https://integrator.example.com/webhook",
      secretCiphertext: "cipher_1",
      nextSecretCiphertext: "",
      secretOverlapUntil: null,
    }),
  }),
  findByIdAndUpdate: jest.fn(),
}));

jest.mock("../../models/marketplaceWebhookDeliveryModel", () => ({
  findOneAndUpdate: jest.fn(),
}));

jest.mock("../../utils/secretCrypto", () => ({
  decryptSecret: jest.fn().mockReturnValue("plain_secret"),
}));

jest.mock("../../services/marketplace/webhookSecurity", () => ({
  buildTimestampedSignatureHeader: jest.fn().mockReturnValue("t=1700000000,v1=sig"),
  assertSecureWebhookUrl: jest.fn((url) => url),
}));

jest.mock("../../events", () => ({
  eventBus: {
    emitBusinessEvent: jest.fn(),
    on: jest.fn(),
  },
  EventTypes: {
    MARKETPLACE_WEBHOOK_DELIVERY_SUCCEEDED: "marketplace.webhook.delivery_succeeded",
    MARKETPLACE_WEBHOOK_DELIVERY_FAILED: "marketplace.webhook.delivery_failed",
  },
}));

const axios = require("axios");
const MarketplaceWebhookDelivery = require("../../models/marketplaceWebhookDeliveryModel");
const {
  dispatchWebhookDeliveryById,
} = require("../../services/marketplace/webhookFanoutService");

const flush = async () => new Promise((resolve) => setTimeout(resolve, 30));

describe("webhook fanout claim lease", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  test("only one dispatcher claims and sends the same delivery", async () => {
    const setImmediateSpy = jest
      .spyOn(global, "setImmediate")
      .mockImplementation(() => 0);

    let hasClaimed = false;

    MarketplaceWebhookDelivery.findOneAndUpdate.mockImplementation(async (filter) => {
      const isClaimCall = filter?.status === "pending";

      if (isClaimCall) {
        if (hasClaimed) {
          return null;
        }

        hasClaimed = true;
        return {
          _id: "delivery_1",
          endpoint: "endpoint_1",
          business: { toString: () => "biz_1" },
          eventType: "marketplace.order.placed",
          eventId: "evt_1",
          payload: { id: "evt_1", type: "marketplace.order.placed", data: {} },
          attemptCount: 0,
          updatedAt: new Date(),
          createdAt: new Date(),
        };
      }

      return { _id: "delivery_1" };
    });

    const first = await dispatchWebhookDeliveryById("delivery_1");
    const second = await dispatchWebhookDeliveryById("delivery_1");

    expect(first).toBe(true);
    expect(second).toBe(false);
    expect(MarketplaceWebhookDelivery.findOneAndUpdate).toHaveBeenCalledTimes(2);

    setImmediateSpy.mockRestore();
  });
});
