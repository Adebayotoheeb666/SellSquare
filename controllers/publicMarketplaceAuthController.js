const asyncHandler = require("express-async-handler");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const PublicApiCredential = require("../models/publicApiCredentialModel");
const PublicRefreshSession = require("../models/publicRefreshSessionModel");
const { encryptSecret } = require("../utils/secretCrypto");
const {
  validateDomainAllowlistInput,
} = require("../validators/marketplaceSchemas");
const { getPartnerJwtSecret } = require("../middleWare/publicPartnerAuthMiddleware");

const ACCESS_TTL_SECONDS = 15 * 60;
const REFRESH_TTL_DAYS = 14;

const toIdString = (value) => {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (value.toString) return value.toString();
  return "";
};

const hashToken = (value) =>
  crypto.createHash("sha256").update(String(value || "")).digest("hex");

const buildExpiryDate = () => {
  const expiry = new Date();
  expiry.setDate(expiry.getDate() + REFRESH_TTL_DAYS);
  return expiry;
};

const generateAccessToken = ({ businessId, credential }) => {
  return jwt.sign(
    {
      typ: "access",
      businessId: toIdString(businessId),
      credentialId: toIdString(credential._id),
      keyId: credential.keyId,
      scopes: credential.scopes || [],
    },
    getPartnerJwtSecret(),
    { expiresIn: ACCESS_TTL_SECONDS },
  );
};

const createRefreshSession = async ({
  businessId,
  credential,
  rotatedFrom = null,
  revokeRotatedFrom = true,
  ip = "",
  userAgent = "",
}) => {
  const refreshToken = crypto.randomBytes(48).toString("hex");
  const refreshHash = hashToken(refreshToken);
  const tokenFamilyId =
    rotatedFrom?.tokenFamilyId || crypto.randomBytes(12).toString("hex");

  const session = await PublicRefreshSession.create({
    business: businessId,
    credential: credential._id,
    tokenFamilyId,
    refreshTokenHash: refreshHash,
    expiresAt: buildExpiryDate(),
    rotatedFrom: rotatedFrom?._id || null,
    meta: {
      ip,
      userAgent,
    },
  });

  if (rotatedFrom?._id && revokeRotatedFrom) {
    await PublicRefreshSession.findByIdAndUpdate(rotatedFrom._id, {
      $set: {
        replacedBy: session._id,
        revokedAt: new Date(),
        revokeReason: "rotated",
      },
    });
  }

  return {
    session,
    refreshToken,
  };
};

const normalizeAllowlistedDomains = (domains = []) =>
  (Array.isArray(domains) ? domains : []).map((entry) => ({
    domain: String(typeof entry === "string" ? entry : entry?.domain || "")
      .trim()
      .toLowerCase(),
    isActive: true,
  }));

const createApiCredential = asyncHandler(async (req, res) => {
  const businessId = req.business?._id;
  const { name, scopes, allowlistedDomains, rateLimit } = req.body;

  if (!name) {
    return res.status(400).json({ message: "Credential name is required" });
  }

  const domainValidation = validateDomainAllowlistInput(allowlistedDomains || []);
  if (!domainValidation.valid) {
    return res.status(400).json({
      message: "Invalid domain allowlist",
      errors: domainValidation.errors,
    });
  }

  const keyId = `mkp_${crypto.randomBytes(12).toString("hex")}`;
  const plainSecret = crypto.randomBytes(32).toString("hex");

  const secretHash = await bcrypt.hash(plainSecret, 12);
  const secretCiphertext = encryptSecret(plainSecret);

  const credential = await PublicApiCredential.create({
    business: businessId,
    keyId,
    name,
    secretHash,
    secretCiphertext,
    scopes: Array.isArray(scopes) && scopes.length > 0 ? scopes : undefined,
    allowlistedDomains: normalizeAllowlistedDomains(allowlistedDomains || []),
    rateLimit:
      typeof rateLimit?.perMinute === "number"
        ? { perMinute: Math.max(1, rateLimit.perMinute) }
        : undefined,
    metadata: {
      createdBy: req.user?.email || req.user?.name || "business_owner",
    },
  });

  return res.status(201).json({
    credential: {
      id: credential._id,
      keyId: credential.keyId,
      name: credential.name,
      scopes: credential.scopes,
      allowlistedDomains: credential.allowlistedDomains,
      rateLimit: credential.rateLimit,
      status: credential.status,
      createdAt: credential.createdAt,
    },
    secret: plainSecret,
    warning: "Secret is only returned once. Store it securely.",
  });
});

const listApiCredentials = asyncHandler(async (req, res) => {
  const businessId = req.business?._id;
  const rows = await PublicApiCredential.find({ business: businessId })
    .sort({ createdAt: -1 })
    .lean();

  return res.status(200).json({
    credentials: rows.map((row) => ({
      id: row._id,
      keyId: row.keyId,
      name: row.name,
      status: row.status,
      scopes: row.scopes,
      allowlistedDomains: row.allowlistedDomains,
      rateLimit: row.rateLimit,
      lastRotatedAt: row.lastRotatedAt,
      revokedAt: row.revokedAt,
      createdAt: row.createdAt,
    })),
  });
});

const updateApiCredentialSettings = asyncHandler(async (req, res) => {
  const businessId = req.business?._id;
  const { keyId } = req.params;
  const { name, scopes, allowlistedDomains, rateLimit } = req.body || {};

  const credential = await PublicApiCredential.findOne({
    business: businessId,
    keyId,
    status: "active",
  });

  if (!credential) {
    return res.status(404).json({ message: "Credential not found" });
  }

  if (typeof name === "string") {
    const trimmed = name.trim();
    if (!trimmed) {
      return res.status(400).json({ message: "Credential name cannot be empty" });
    }
    credential.name = trimmed;
  }

  if (typeof scopes !== "undefined") {
    if (!Array.isArray(scopes) || scopes.length === 0) {
      return res.status(400).json({ message: "scopes must be a non-empty array" });
    }

    credential.scopes = scopes
      .map((scope) => String(scope || "").trim())
      .filter(Boolean);

    if (credential.scopes.length === 0) {
      return res.status(400).json({ message: "At least one valid scope is required" });
    }
  }

  if (typeof allowlistedDomains !== "undefined") {
    const domainValidation = validateDomainAllowlistInput(allowlistedDomains || []);
    if (!domainValidation.valid) {
      return res.status(400).json({
        message: "Invalid domain allowlist",
        errors: domainValidation.errors,
      });
    }

    credential.allowlistedDomains = normalizeAllowlistedDomains(allowlistedDomains || []);
  }

  if (typeof rateLimit !== "undefined") {
    const perMinute = Number(rateLimit?.perMinute);

    if (!Number.isFinite(perMinute) || perMinute < 1) {
      return res.status(400).json({
        message: "rateLimit.perMinute must be a number greater than or equal to 1",
      });
    }

    credential.rateLimit = {
      perMinute: Math.max(1, Math.floor(perMinute)),
    };
  }

  await credential.save();

  return res.status(200).json({
    credential: {
      id: credential._id,
      keyId: credential.keyId,
      name: credential.name,
      scopes: credential.scopes,
      allowlistedDomains: credential.allowlistedDomains,
      rateLimit: credential.rateLimit,
      status: credential.status,
      lastRotatedAt: credential.lastRotatedAt,
      revokedAt: credential.revokedAt,
      createdAt: credential.createdAt,
      updatedAt: credential.updatedAt,
    },
  });
});

const rotateApiCredentialSecret = asyncHandler(async (req, res) => {
  const businessId = req.business?._id;
  const { keyId } = req.params;

  const credential = await PublicApiCredential.findOne({
    business: businessId,
    keyId,
    status: "active",
  }).select("+secretHash +secretCiphertext");

  if (!credential) {
    return res.status(404).json({ message: "Credential not found" });
  }

  const newSecret = crypto.randomBytes(32).toString("hex");
  credential.secretHash = await bcrypt.hash(newSecret, 12);
  credential.secretCiphertext = encryptSecret(newSecret);
  credential.secretVersion = Number(credential.secretVersion || 1) + 1;
  credential.lastRotatedAt = new Date();
  await credential.save();

  return res.status(200).json({
    keyId: credential.keyId,
    secretVersion: credential.secretVersion,
    secret: newSecret,
    warning: "Secret is only returned once. Store it securely.",
  });
});

const revokeApiCredential = asyncHandler(async (req, res) => {
  const businessId = req.business?._id;
  const { keyId } = req.params;

  const credential = await PublicApiCredential.findOneAndUpdate(
    {
      business: businessId,
      keyId,
      status: "active",
    },
    {
      $set: {
        status: "revoked",
        revokedAt: new Date(),
      },
    },
    { new: true },
  );

  if (!credential) {
    return res.status(404).json({ message: "Credential not found" });
  }

  await PublicRefreshSession.updateMany(
    {
      credential: credential._id,
      revokedAt: null,
    },
    {
      $set: {
        revokedAt: new Date(),
        revokeReason: "credential_revoked",
      },
    },
  );

  return res.status(200).json({
    keyId: credential.keyId,
    status: credential.status,
  });
});

const issuePartnerToken = asyncHandler(async (req, res) => {
  const credential = req.partnerCredential;
  const apiSecret = req.get("x-api-secret") || req.body?.apiSecret;

  if (!apiSecret) {
    return res.status(401).json({ message: "Missing API secret" });
  }

  const isMatch = await bcrypt.compare(apiSecret, credential.secretHash);
  if (!isMatch) {
    return res.status(401).json({ message: "Invalid API key/secret" });
  }

  const accessToken = generateAccessToken({
    businessId: req.business._id,
    credential,
  });

  const { session, refreshToken } = await createRefreshSession({
    businessId: req.business._id,
    credential,
    ip: req.ip,
    userAgent: req.get("User-Agent") || "",
  });

  return res.status(200).json({
    accessToken,
    accessTokenExpiresIn: ACCESS_TTL_SECONDS,
    refreshToken,
    refreshTokenExpiresAt: session.expiresAt,
    keyId: credential.keyId,
    scopes: credential.scopes,
  });
});

const refreshPartnerToken = asyncHandler(async (req, res) => {
  const refreshToken = req.body?.refreshToken;
  if (!refreshToken) {
    return res.status(400).json({ message: "refreshToken is required" });
  }

  const refreshHash = hashToken(refreshToken);
  const now = new Date();

  const existing = await PublicRefreshSession.findOneAndUpdate(
    {
      refreshTokenHash: refreshHash,
      revokedAt: null,
      expiresAt: { $gt: now },
    },
    {
      $set: {
        revokedAt: now,
        revokeReason: "rotated",
      },
    },
    {
      new: true,
    },
  );

  if (!existing) {
    return res.status(401).json({ message: "Invalid refresh token" });
  }

  const credential = await PublicApiCredential.findOne({
    _id: existing.credential,
    status: "active",
  });

  if (!credential) {
    return res.status(401).json({ message: "Credential inactive for refresh token" });
  }

  const accessToken = generateAccessToken({
    businessId: existing.business,
    credential,
  });

  const { session, refreshToken: newRefreshToken } = await createRefreshSession({
    businessId: existing.business,
    credential,
    rotatedFrom: existing,
    revokeRotatedFrom: false,
    ip: req.ip,
    userAgent: req.get("User-Agent") || "",
  });

  await PublicRefreshSession.findByIdAndUpdate(existing._id, {
    $set: {
      replacedBy: session._id,
    },
  });

  return res.status(200).json({
    accessToken,
    accessTokenExpiresIn: ACCESS_TTL_SECONDS,
    refreshToken: newRefreshToken,
    refreshTokenExpiresAt: session.expiresAt,
    keyId: credential.keyId,
    scopes: credential.scopes,
  });
});

const revokePartnerToken = asyncHandler(async (req, res) => {
  const refreshToken = req.body?.refreshToken;
  if (!refreshToken) {
    return res.status(400).json({ message: "refreshToken is required" });
  }

  const refreshHash = hashToken(refreshToken);
  const updated = await PublicRefreshSession.findOneAndUpdate(
    {
      refreshTokenHash: refreshHash,
      revokedAt: null,
    },
    {
      $set: {
        revokedAt: new Date(),
        revokeReason: "manual_revoke",
      },
    },
    {
      new: true,
    },
  );

  return res.status(200).json({
    message: updated
      ? "Refresh token revoked"
      : "If refresh token exists, it has been revoked",
  });
});

module.exports = {
  createApiCredential,
  listApiCredentials,
  updateApiCredentialSettings,
  rotateApiCredentialSecret,
  revokeApiCredential,
  issuePartnerToken,
  refreshPartnerToken,
  revokePartnerToken,
};
