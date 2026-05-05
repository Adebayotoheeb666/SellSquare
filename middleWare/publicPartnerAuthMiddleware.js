const jwt = require("jsonwebtoken");
const PublicApiCredential = require("../models/publicApiCredentialModel");
const BusinessRegistration = require("../models/businessRegistration");

const getPartnerJwtSecret = () =>
  process.env.PUBLIC_PARTNER_JWT_SECRET || process.env.JWT_SECRET;

const getBearerToken = (req) => {
  const authHeader = req.get("authorization") || "";
  if (!authHeader.toLowerCase().startsWith("bearer ")) return "";
  return authHeader.slice(7).trim();
};

const resolvePartnerCredentialFromApiKey = async (req, res, next) => {
  try {
    const apiKey = req.get("x-api-key") || req.body?.apiKey;
    if (!apiKey) {
      return res.status(401).json({ message: "Missing API key" });
    }

    const credential = await PublicApiCredential.findOne({
      keyId: apiKey,
      status: "active",
    }).select("+secretHash +secretCiphertext");

    if (!credential) {
      return res.status(401).json({ message: "Invalid API key" });
    }

    const business = await BusinessRegistration.findById(credential.business);
    if (!business) {
      return res.status(401).json({ message: "Business not found for API key" });
    }

    req.partnerCredential = credential;
    req.business = business;

    return next();
  } catch (error) {
    return res.status(500).json({ message: "Failed to resolve partner credential" });
  }
};

const requirePartnerAuth = (requiredScopes = []) => {
  return async (req, res, next) => {
    try {
      const token = getBearerToken(req);
      if (!token) {
        return res.status(401).json({ message: "Missing bearer token" });
      }

      const decoded = jwt.verify(token, getPartnerJwtSecret());
      if (decoded.typ !== "access") {
        return res.status(401).json({ message: "Invalid partner access token" });
      }

      const credential = await PublicApiCredential.findOne({
        _id: decoded.credentialId,
        business: decoded.businessId,
        status: "active",
      }).select("+secretCiphertext");

      if (!credential) {
        return res.status(401).json({ message: "Partner credential is not active" });
      }

      const business = await BusinessRegistration.findById(decoded.businessId);
      if (!business) {
        return res.status(401).json({ message: "Business not found" });
      }

      const scopes = Array.isArray(decoded.scopes) ? decoded.scopes : [];
      const missingScopes = requiredScopes.filter((scope) => !scopes.includes(scope));

      if (missingScopes.length > 0) {
        return res.status(403).json({
          message: "Missing required scopes",
          missingScopes,
        });
      }

      req.partnerAuth = decoded;
      req.partnerCredential = credential;
      req.business = business;

      return next();
    } catch (error) {
      return res.status(401).json({ message: "Unauthorized partner request" });
    }
  };
};

module.exports = {
  requirePartnerAuth,
  resolvePartnerCredentialFromApiKey,
  getPartnerJwtSecret,
};
