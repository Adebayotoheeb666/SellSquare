const {
  hashRequestPayload,
  reserveIdempotencyKey,
} = require("../services/marketplace/idempotencyService");

const publicIdempotencyMiddleware = (routeKeyBuilder = null) => {
  return async (req, res, next) => {
    try {
      const credentialId = req.partnerCredential?._id;
      const businessId = req.business?._id;
      const idempotencyKey = req.get("Idempotency-Key");

      if (!credentialId || !businessId || !idempotencyKey) {
        return next();
      }

      const routeKey =
        typeof routeKeyBuilder === "function"
          ? routeKeyBuilder(req)
          : `${req.method.toUpperCase()}:${req.baseUrl}${req.route?.path || req.path}`;

      const requestHash = hashRequestPayload({
        method: req.method,
        routeKey,
        body: req.body,
      });

      const reservation = await reserveIdempotencyKey({
        businessId,
        credentialId,
        idempotencyKey,
        routeKey,
        requestHash,
      });

      if (reservation.isReplay && reservation.record?.responseBody) {
        return res
          .status(reservation.record.responseCode || 200)
          .json(reservation.record.responseBody);
      }

      if (reservation.isProcessing) {
        return res.status(409).json({
          message: "Idempotency key is still processing",
          code: "IDEMPOTENCY_KEY_IN_PROGRESS",
          retryAfterSeconds: 2,
        });
      }

      req.idempotency = {
        routeKey,
        idempotencyKey,
        requestHash,
      };

      return next();
    } catch (error) {
      if (error.code === "IDEMPOTENCY_KEY_PAYLOAD_CONFLICT") {
        return res.status(error.statusCode || 409).json({
          message: error.message,
          code: error.code,
        });
      }

      return res.status(500).json({
        message: "Failed to process idempotency key",
      });
    }
  };
};

module.exports = publicIdempotencyMiddleware;
