jest.mock("../../models/marketplaceWebhookEndpointModel", () => {
  const mockModel = jest.fn();
  mockModel.findOne = jest.fn();
  mockModel.find = jest.fn();
  mockModel.create = jest.fn();
  return mockModel;
});

jest.mock("../../models/marketplaceWebhookDeliveryModel", () => ({
  find: jest.fn(),
  findOne: jest.fn(),
  findByIdAndUpdate: jest.fn(),
}));

jest.mock("../../services/marketplace/webhookFanoutService", () => ({
  queueWebhookEvent: jest.fn(),
  dispatchWebhookDeliveryById: jest.fn(),
}));

const MarketplaceWebhookEndpoint = require("../../models/marketplaceWebhookEndpointModel");
const {
  upsertProviderWebhookEndpoint,
  rotateWebhookEndpointSecret,
} = require("../../controllers/marketplaceWebhookAdminController");

const createRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe("marketplace webhook endpoint registration integration", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  test("upserts endpoint by identity/environment and returns provider endpoint id", async () => {
    MarketplaceWebhookEndpoint.findOne.mockReturnValue({
      select: jest.fn().mockResolvedValue(null),
    });

    const savedEndpoint = {
      _id: "endpoint-id",
      providerEndpointId: "wep_123",
      endpointIdentity: "nino-main",
      environment: "production",
      name: "Nino webhook",
      url: "https://nino.example.com/webhooks",
      subscribedEvents: ["marketplace.*"],
      status: "active",
      secretOverlapUntil: null,
      createdAt: new Date("2026-03-03T00:00:00.000Z"),
      updatedAt: new Date("2026-03-03T00:00:00.000Z"),
      save: jest.fn().mockResolvedValue(true),
    };

    MarketplaceWebhookEndpoint.mockImplementation(() => savedEndpoint);

    const req = {
      body: {
        endpointIdentity: "nino-main",
        environment: "production",
        name: "Nino webhook",
        url: "https://nino.example.com/webhooks",
        subscribedEvents: ["marketplace.*"],
      },
      business: { _id: "biz-1" },
      partnerCredential: { _id: "cred-1" },
    };
    const res = createRes();
    const next = jest.fn((error) => {
      if (error) throw error;
    });

    await upsertProviderWebhookEndpoint(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(201);
    const body = res.json.mock.calls[0][0];
    expect(body.endpoint.providerEndpointId).toBeTruthy();
    expect(body.endpoint.endpointIdentity).toBe("nino-main");
    expect(body.endpoint.environment).toBe("production");
  });

  test("rotates secret with overlap window", async () => {
    const endpoint = {
      providerEndpointId: "wep_123",
      save: jest.fn().mockResolvedValue(true),
    };

    MarketplaceWebhookEndpoint.findOne.mockReturnValue({
      select: jest.fn().mockResolvedValue(endpoint),
    });

    const req = {
      params: { providerEndpointId: "wep_123" },
      body: { overlapSeconds: 600 },
      business: { _id: "biz-1" },
    };
    const res = createRes();
    const next = jest.fn((error) => {
      if (error) throw error;
    });

    await rotateWebhookEndpointSecret(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    const payload = res.json.mock.calls[0][0];
    expect(payload.providerEndpointId).toBe("wep_123");
    expect(payload.nextSecret).toBeTruthy();
    expect(endpoint.nextSecretHash).toBeTruthy();
    expect(endpoint.nextSecretCiphertext).toBeTruthy();
    expect(endpoint.secretOverlapUntil).toBeTruthy();
  });
});
