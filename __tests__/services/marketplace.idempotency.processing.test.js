jest.mock("../../models/publicIdempotencyKeyModel", () => ({
  findOne: jest.fn(),
  create: jest.fn(),
  findOneAndUpdate: jest.fn(),
}));

const PublicIdempotencyKey = require("../../models/publicIdempotencyKeyModel");
const {
  reserveIdempotencyKey,
} = require("../../services/marketplace/idempotencyService");

describe("idempotencyService processing replay", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  test("returns in-flight processing state for same key and same payload hash", async () => {
    PublicIdempotencyKey.findOne.mockReturnValue({
      lean: jest.fn().mockResolvedValue({
        credential: "cred_1",
        routeKey: "POST:/orders",
        idempotencyKey: "idem_1",
        requestHash: "hash_1",
        status: "processing",
      }),
    });

    const result = await reserveIdempotencyKey({
      businessId: "biz_1",
      credentialId: "cred_1",
      idempotencyKey: "idem_1",
      routeKey: "POST:/orders",
      requestHash: "hash_1",
    });

    expect(result.isProcessing).toBe(true);
    expect(result.isReplay).toBe(false);
    expect(PublicIdempotencyKey.create).not.toHaveBeenCalled();
  });
});
