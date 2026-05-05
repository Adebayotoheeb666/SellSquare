const PublicRefreshSession = require("../../models/publicRefreshSessionModel");
const PublicApiCredential = require("../../models/publicApiCredentialModel");
const {
  refreshPartnerToken,
} = require("../../controllers/publicMarketplaceAuthController");

const createRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe("marketplace auth refresh rotation", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("allows only one successful refresh rotation for a single refresh token under race", async () => {
    const now = new Date(Date.now() + 60_000);

    const firstClaimedSession = {
      _id: "sess_old",
      business: "biz_1",
      credential: "cred_1",
      expiresAt: now,
      revokedAt: null,
    };

    jest
      .spyOn(PublicRefreshSession, "findOneAndUpdate")
      .mockResolvedValueOnce(firstClaimedSession)
      .mockResolvedValue(null);

    jest.spyOn(PublicApiCredential, "findOne").mockResolvedValue({
      _id: "cred_1",
      keyId: "mkp_key_1",
      scopes: ["orders:write"],
      status: "active",
    });

    jest.spyOn(PublicRefreshSession, "create").mockResolvedValue({
      _id: "sess_new",
      expiresAt: new Date(Date.now() + 120_000),
      tokenFamilyId: "fam_1",
    });

    process.env.JWT_SECRET = "refresh-rotation-secret";

    const reqA = {
      body: { refreshToken: "token_1" },
      ip: "127.0.0.1",
      get: jest.fn().mockReturnValue("jest-agent"),
    };
    const reqB = {
      body: { refreshToken: "token_1" },
      ip: "127.0.0.1",
      get: jest.fn().mockReturnValue("jest-agent"),
    };

    const resA = createRes();
    const resB = createRes();

    const nextA = jest.fn();
    const nextB = jest.fn();

    await refreshPartnerToken(reqA, resA, nextA);
    await refreshPartnerToken(reqB, resB, nextB);

    expect(resA.status).toHaveBeenCalledWith(200);
    expect(resB.status).toHaveBeenCalledWith(401);
    expect(PublicRefreshSession.create).toHaveBeenCalledTimes(1);
    expect(nextA).not.toHaveBeenCalled();
    expect(nextB).not.toHaveBeenCalled();
  });
});
