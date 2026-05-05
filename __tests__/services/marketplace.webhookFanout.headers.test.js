jest.mock("axios", () => ({
  post: jest.fn(),
}));

jest.mock("../../models/marketplaceWebhookEndpointModel", () => ({
  findById: jest.fn(),
  findByIdAndUpdate: jest.fn(),
}));

jest.mock("../../models/marketplaceWebhookDeliveryModel", () => ({
  find: jest.fn(),
  findOneAndUpdate: jest.fn(),
  findByIdAndUpdate: jest.fn(),
}));

jest.mock("../../utils/secretCrypto", () => ({
  decryptSecret: jest.fn(),
}));

jest.mock("../../services/marketplace/webhookSecurity", () => ({
  buildTimestampedSignatureHeader: jest.fn(),
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
const MarketplaceWebhookEndpoint = require("../../models/marketplaceWebhookEndpointModel");
const MarketplaceWebhookDelivery = require("../../models/marketplaceWebhookDeliveryModel");
const { decryptSecret } = require("../../utils/secretCrypto");
const {
  buildTimestampedSignatureHeader,
} = require("../../services/marketplace/webhookSecurity");
const {
  processDueRetries,
} = require("../../services/marketplace/webhookFanoutService");

const waitForAsyncWork = async () => {
  await new Promise((resolve) => setTimeout(resolve, 20));
};

describe("marketplace webhook fanout delivery headers", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  test("preserves signature, correlation id and schema version headers for listing delivery", async () => {
    const delivery = {
      _id: "delivery_1",
      endpoint: "endpoint_1",
      business: { toString: () => "biz_1" },
      eventType: "marketplace.listing.updated",
      eventId: "evt_1",
      correlationId: "corr_listing_1",
      schemaVersion: "1.0.0",
      payload: {
        id: "evt_1",
        type: "marketplace.listing.updated",
        data: {
          listings: [{ listingId: "product_1", listingType: "single" }],
        },
      },
      attemptCount: 0,
      updatedAt: new Date(),
      createdAt: new Date(),
    };

    MarketplaceWebhookDelivery.find.mockReturnValue({
      sort: jest.fn().mockReturnValue({
        limit: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue([delivery]),
        }),
      }),
    });

    MarketplaceWebhookDelivery.findOneAndUpdate
      .mockResolvedValueOnce(delivery)
      .mockResolvedValueOnce({ _id: "delivery_1" });

    MarketplaceWebhookEndpoint.findById.mockReturnValue({
      select: jest.fn().mockResolvedValue({
        _id: "endpoint_1",
        status: "active",
        url: "https://integrator.example.com/webhook",
        secretCiphertext: "cipher_1",
        nextSecretCiphertext: "",
        secretOverlapUntil: null,
      }),
    });

    decryptSecret.mockReturnValue("plain_secret");
    buildTimestampedSignatureHeader.mockReturnValue("t=1700000000,v1=abc");

    axios.post.mockResolvedValue({
      status: 200,
      data: { ok: true },
    });

    await processDueRetries();
    await waitForAsyncWork();

    expect(axios.post).toHaveBeenCalledWith(
      "https://integrator.example.com/webhook",
      delivery.payload,
      expect.objectContaining({
        headers: expect.objectContaining({
          "x-correlation-id": "corr_listing_1",
          "x-marketplace-signature": "t=1700000000,v1=abc",
          "x-marketplace-schema-version": "1.0.0",
        }),
      }),
    );
  });
});
