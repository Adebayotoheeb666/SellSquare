const getDomainFromUrl = (rawUrl = "") => {
  if (!rawUrl || typeof rawUrl !== "string") return "";

  const candidate = String(rawUrl).split(",")[0].trim();
  if (!candidate) return "";

  try {
    const parsed = new URL(
      candidate.includes("://") ? candidate : `http://${candidate}`,
    );
    return parsed.hostname.toLowerCase();
  } catch (error) {
    return candidate
      .toLowerCase()
      .split("/")[0]
      .split(":")[0]
      .trim();
  }
};

const isDomainAllowed = (requestDomain, allowlist = []) => {
  if (!requestDomain) return false;

  return allowlist.some((entry) => {
    const allowedDomain =
      typeof entry === "string"
        ? entry.toLowerCase()
        : String(entry?.domain || "").toLowerCase();

    if (!allowedDomain) return false;
    return requestDomain === allowedDomain || requestDomain.endsWith(`.${allowedDomain}`);
  });
};

const getHeaderValue = (req, headerName) => {
  if (!req) return "";

  if (typeof req.get === "function") {
    return req.get(headerName) || "";
  }

  const normalized = String(headerName || "").toLowerCase();
  return req.headers?.[normalized] || "";
};

const uniqueNonEmpty = (values = []) => {
  return [...new Set(values.filter(Boolean))];
};

const publicDomainAllowlistMiddleware = (req, res, next) => {
  const allowlist = req.partnerCredential?.allowlistedDomains || [];

  if (!Array.isArray(allowlist) || allowlist.length === 0) {
    return next();
  }

  const originDomain = getDomainFromUrl(getHeaderValue(req, "origin"));
  const refererDomain = getDomainFromUrl(getHeaderValue(req, "referer"));
  const forwardedOriginDomain = getDomainFromUrl(
    getHeaderValue(req, "x-forwarded-origin"),
  );
  const forwardedHostDomain = getDomainFromUrl(
    getHeaderValue(req, "x-forwarded-host"),
  );
  const hostDomain = getDomainFromUrl(getHeaderValue(req, "host"));

  const callerSignalDomains = uniqueNonEmpty([
    originDomain,
    refererDomain,
    forwardedOriginDomain,
  ]);

  const candidateDomains = uniqueNonEmpty([
    ...callerSignalDomains,
    forwardedHostDomain,
    hostDomain,
  ]);

  if (candidateDomains.length === 0) {
    return next();
  }

  // If only infrastructure host headers are available (common in server-to-server
  // or proxy-terminated requests), do not hard-fail on domain allowlist. Domain
  // allowlist enforcement remains strict whenever caller-origin headers are present.
  if (callerSignalDomains.length === 0) {
    return next();
  }

  const domainsToEvaluate =
    callerSignalDomains.length > 0 ? callerSignalDomains : candidateDomains;

  const matchedDomain = domainsToEvaluate.find((domain) =>
    isDomainAllowed(domain, allowlist),
  );

  if (!matchedDomain) {
    return res.status(403).json({
      message: "Request domain is not allowlisted for this credential",
      domain: callerSignalDomains[0] || candidateDomains[0],
    });
  }

  return next();
};

module.exports = publicDomainAllowlistMiddleware;
