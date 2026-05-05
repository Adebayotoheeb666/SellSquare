const bcrypt = require("bcryptjs");
const PublicRefreshSession = require("../../models/publicRefreshSessionModel");
const {
  issuePartnerToken,
} = require("../../controllers/publicMarketplaceAuthController");

const createRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe("marketplace auth integration", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("issues access and refresh token with valid api secret", async () => {
    const secret = "test-secret";
    const secretHash = await bcrypt.hash(secret, 10);

    jest.spyOn(PublicRefreshSession, "create").mockResolvedValue({
      _id: "session-id",
      expiresAt: new Date(Date.now() + 1000 * 60 * 60),
      tokenFamilyId: "family",
    });

    process.env.JWT_SECRET = "test-jwt-secret";

    const req = {
      get: (name) => (name.toLowerCase() === "x-api-secret" ? secret : ""),
      body: {},
      ip: "127.0.0.1",
      partnerCredential: {
        _id: "credential-id",
        keyId: "mkp_key",
        scopes: ["orders:write"],
        secretHash,
      },
      business: {
        _id: "business-id",
      },
    };
    const res = createRes();
    const next = jest.fn();

    await issuePartnerToken(req, res, next);

    expect(res.status).toHaveBeenCalledWith(200);
    const payload = res.json.mock.calls[0][0];
    expect(payload.accessToken).toBeTruthy();
    expect(payload.refreshToken).toBeTruthy();
    expect(next).not.toHaveBeenCalled();
  });
});
