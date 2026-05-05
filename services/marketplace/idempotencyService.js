const crypto = require("crypto");
const PublicIdempotencyKey = require("../../models/publicIdempotencyKeyModel");

const DEFAULT_TTL_MINUTES = 120;

const stableStringify = (value) => {
  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableStringify(entry)).join(",")}]`;
  }

  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
      .join(",")}}`;
  }

  return JSON.stringify(value);
};

const hashRequestPayload = ({ method, routeKey, body }) => {
  const canonical = `${String(method || "POST").toUpperCase()}|${routeKey}|${stableStringify(body || {})}`;
  return crypto.createHash("sha256").update(canonical).digest("hex");
};

const buildExpiry = (ttlMinutes = DEFAULT_TTL_MINUTES) => {
  const expiresAt = new Date();
  expiresAt.setMinutes(expiresAt.getMinutes() + ttlMinutes);
  return expiresAt;
};

const reserveIdempotencyKey = async ({
  businessId,
  credentialId,
  idempotencyKey,
  routeKey,
  requestHash,
  ttlMinutes = DEFAULT_TTL_MINUTES,
}) => {
  const existing = await PublicIdempotencyKey.findOne({
    credential: credentialId,
    routeKey,
    idempotencyKey,
  }).lean();

  if (existing) {
    if (existing.requestHash !== requestHash) {
      const conflictError = new Error(
        "Idempotency key reuse detected with different payload",
      );
      conflictError.code = "IDEMPOTENCY_KEY_PAYLOAD_CONFLICT";
      conflictError.statusCode = 409;
      throw conflictError;
    }

    return {
      isReplay: existing.status === "completed",
      isProcessing: existing.status === "processing",
      record: existing,
    };
  }

  const record = await PublicIdempotencyKey.create({
    business: businessId,
    credential: credentialId,
    idempotencyKey,
    routeKey,
    requestHash,
    status: "processing",
    expiresAt: buildExpiry(ttlMinutes),
  });

  return {
    isReplay: false,
    isProcessing: false,
    record,
  };
};

const completeIdempotencyKey = async ({
  credentialId,
  routeKey,
  idempotencyKey,
  responseCode,
  responseBody,
  failed = false,
}) => {
  return PublicIdempotencyKey.findOneAndUpdate(
    {
      credential: credentialId,
      routeKey,
      idempotencyKey,
    },
    {
      $set: {
        status: failed ? "failed" : "completed",
        responseCode,
        responseBody,
      },
    },
    {
      new: true,
    },
  ).lean();
};

module.exports = {
  hashRequestPayload,
  reserveIdempotencyKey,
  completeIdempotencyKey,
};
