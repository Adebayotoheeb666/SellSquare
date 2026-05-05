const Activities = require("../models/Activities");

const publicAuditMiddleware = (actionLabel = "partner_request") => {
  return async (req, res, next) => {
    try {
      const isMarketplaceRoute = String(req.originalUrl || "").includes(
        "/marketplace",
      );
      const isMarketplaceAction = String(actionLabel || "")
        .toLowerCase()
        .includes("marketplace");

      if (isMarketplaceRoute || isMarketplaceAction) {
        return next();
      }

      const businessId = req.business?._id;
      const keyId = req.partnerCredential?.keyId || "unknown_key";

      if (businessId) {
        const activity = `Marketplace ${actionLabel}: ${req.method} ${req.originalUrl} (key: ${keyId})`;
        await Activities.create({
          business: businessId,
          activity,
        });
      }

      return next();
    } catch (error) {
      return next();
    }
  };
};

module.exports = publicAuditMiddleware;
