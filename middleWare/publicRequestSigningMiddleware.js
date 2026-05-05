const crypto = require("crypto");
const PublicRequestNonce = require("../models/publicRequestNonceModel");
const { decryptSecret } = require("../utils/secretCrypto");

const MAX_CLOCK_SKEW_MS = 5 * 60 * 1000;

const sha256 = (value) =>
  crypto.createHash("sha256").update(String(value || "")).digest("hex");

const buildSigningPayload = ({ method, path, timestamp, nonce, bodyHash }) =>
  `${String(method || "GET").toUpperCase()}\n${path}\n${timestamp}\n${nonce}\n${bodyHash}`;

const timingSafeMatch = (a, b) => {
  const left = Buffer.from(String(a || ""));
  const right = Buffer.from(String(b || ""));
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
};

const publicRequestSigningMiddleware = ({ required = true } = {}) => {
  return async (req, res, next) => {
    try {
      const signature = req.get("x-partner-signature");
      const timestamp = req.get("x-partner-timestamp");
      const nonce = req.get("x-partner-nonce");

      if (!signature || !timestamp || !nonce) {
        if (!required) return next();
        return res.status(401).json({ message: "Missing signed request headers" });
      }

      const timestampMs = Number(timestamp);
      if (!Number.isFinite(timestampMs)) {
        return res.status(400).json({ message: "Invalid request timestamp" });
      }

      if (Math.abs(Date.now() - timestampMs) > MAX_CLOCK_SKEW_MS) {
        return res.status(401).json({ message: "Request timestamp is outside allowed skew" });
      }

      const decryptedSecret = decryptSecret(req.partnerCredential?.secretCiphertext || "");
      if (!decryptedSecret) {
        return res.status(401).json({ message: "Credential secret unavailable for signature verification" });
      }

      const bodyHash = sha256(JSON.stringify(req.body || {}));
      const path = req.originalUrl.split("?")[0];
      const signingPayload = buildSigningPayload({
        method: req.method,
        path,
        timestamp,
        nonce,
        bodyHash,
      });

      const expectedSignature = crypto
        .createHmac("sha256", decryptedSecret)
        .update(signingPayload)
        .digest("hex");

      if (!timingSafeMatch(signature, expectedSignature)) {
        return res.status(401).json({ message: "Invalid partner request signature" });
      }

      const expiresAt = new Date(timestampMs + MAX_CLOCK_SKEW_MS);

      try {
        await PublicRequestNonce.create({
          business: req.business._id,
          credential: req.partnerCredential._id,
          nonce,
          requestTimestamp: new Date(timestampMs),
          expiresAt,
        });
      } catch (nonceError) {
        if (nonceError?.code === 11000) {
          return res.status(409).json({ message: "Replay request detected" });
        }
        throw nonceError;
      }

      return next();
    } catch (error) {
      return res.status(500).json({ message: "Failed to validate request signature" });
    }
  };
};

module.exports = publicRequestSigningMiddleware;
