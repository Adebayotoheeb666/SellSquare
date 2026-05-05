const crypto = require("crypto");
const PublicRequestNonce = require("../../models/publicRequestNonceModel");
const { encryptSecret } = require("../../utils/secretCrypto");
const publicRequestSigningMiddleware = require("../../middleWare/publicRequestSigningMiddleware");

describe("marketplace webhook signature integration", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("accepts valid signed request and stores nonce", async () => {
    jest.spyOn(PublicRequestNonce, "create").mockResolvedValue({ _id: "nonce" });

    const body = { event: "order.placed" };
    const timestamp = Date.now().toString();
    const nonce = "nonce-1";
    const secret = "super-secret";
    const bodyHash = crypto
      .createHash("sha256")
      .update(JSON.stringify(body))
      .digest("hex");
    const signedPayload = `POST\n/api/public/v1/marketplace/orders\n${timestamp}\n${nonce}\n${bodyHash}`;
    const signature = crypto
      .createHmac("sha256", secret)
      .update(signedPayload)
      .digest("hex");

    const req = {
      get: (header) => {
        const map = {
          "x-partner-timestamp": timestamp,
          "x-partner-nonce": nonce,
          "x-partner-signature": signature,
        };
        return map[String(header || "").toLowerCase()] || "";
      },
      method: "POST",
      originalUrl: "/api/public/v1/marketplace/orders",
      body,
      business: { _id: "b1" },
      partnerCredential: {
        _id: "cred1",
        secretCiphertext: encryptSecret(secret),
      },
    };

    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    const next = jest.fn();

    await publicRequestSigningMiddleware()(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });
});
