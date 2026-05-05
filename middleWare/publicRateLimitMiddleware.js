const buckets = new Map();

const getBucketKey = (scopeKey) => `${scopeKey}:${Math.floor(Date.now() / 60000)}`;

const resolveCallerKey = (req) => {
  const credentialId = req.partnerCredential?._id?.toString?.();
  if (credentialId) {
    return `cred:${credentialId}`;
  }

  const forwardedFor = String(req.headers["x-forwarded-for"] || "")
    .split(",")[0]
    .trim();
  const ip = forwardedFor || req.ip || req.socket?.remoteAddress || "unknown";
  return `ip:${ip}`;
};

const publicRateLimitMiddleware = (req, res, next) => {
  const callerKey = resolveCallerKey(req);
  const routeKey = `${req.method.toUpperCase()}:${req.baseUrl}${req.route?.path || req.path || ""}`;

  const perMinute = Number(
    req.partnerCredential?.rateLimit?.perMinute
      || process.env.PUBLIC_API_FALLBACK_RATE_LIMIT_PER_MINUTE
      || 60,
  );
  const bucketKey = getBucketKey(`${callerKey}:${routeKey}`);

  const count = buckets.get(bucketKey) || 0;
  if (count >= perMinute) {
    return res.status(429).json({
      message: "Rate limit exceeded",
      limit: perMinute,
    });
  }

  buckets.set(bucketKey, count + 1);
  return next();
};

module.exports = publicRateLimitMiddleware;
