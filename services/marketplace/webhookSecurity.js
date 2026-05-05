const crypto = require("crypto");

const isLocalHostname = (hostname = "") => {
  const normalized = String(hostname || "").trim().toLowerCase();
  return (
    normalized === "localhost"
    || normalized === "127.0.0.1"
    || normalized === "::1"
  );
};

const shouldAllowInsecureWebhookTargets = () => {
  const env = String(process.env.NODE_ENV || "development").toLowerCase();
  return env === "development" || env === "test" || env === "local";
};

const assertSecureWebhookUrl = (url) => {
  let parsed;
  try {
    parsed = new URL(url);
  } catch (error) {
    throw new Error("Invalid webhook URL");
  }

  const protocol = String(parsed.protocol || "").toLowerCase();
  if (protocol === "https:") return parsed.toString();

  if (protocol !== "http:") {
    throw new Error("Webhook URL must use HTTP or HTTPS");
  }

  if (!shouldAllowInsecureWebhookTargets() || !isLocalHostname(parsed.hostname)) {
    throw new Error("Webhook URL must use HTTPS outside local/dev");
  }

  return parsed.toString();
};

const buildHmacHex = (secret, body) => {
  return crypto.createHmac("sha256", String(secret || "")).update(body).digest("hex");
};

const buildTimestampedSignatureHeader = ({
  payload,
  currentSecret,
  nextSecret = "",
  unixTimestamp = Math.floor(Date.now() / 1000),
}) => {
  const serializedPayload = typeof payload === "string" ? payload : JSON.stringify(payload || {});
  const signedBody = `${unixTimestamp}.${serializedPayload}`;
  const signatureParts = [`t=${unixTimestamp}`];

  if (currentSecret) {
    signatureParts.push(`v1=${buildHmacHex(currentSecret, signedBody)}`);
  }

  if (nextSecret) {
    signatureParts.push(`v1=${buildHmacHex(nextSecret, signedBody)}`);
  }

  return signatureParts.join(",");
};

const parseSignatureHeader = (headerValue = "") => {
  const parts = String(headerValue || "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

  const parsed = {
    timestamp: null,
    signatures: [],
  };

  parts.forEach((part) => {
    const [rawKey, rawValue] = part.split("=");
    const key = String(rawKey || "").trim();
    const value = String(rawValue || "").trim();
    if (!key || !value) return;

    if (key === "t") {
      const parsedTimestamp = Number(value);
      if (Number.isFinite(parsedTimestamp)) {
        parsed.timestamp = parsedTimestamp;
      }
      return;
    }

    if (key === "v1") {
      parsed.signatures.push(value);
    }
  });

  return parsed;
};

const secureHexEqual = (left, right) => {
  const a = Buffer.from(String(left || ""), "hex");
  const b = Buffer.from(String(right || ""), "hex");
  if (a.length === 0 || b.length === 0 || a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
};

const verifyTimestampedSignature = ({ payload, headerValue, currentSecret, nextSecret = "" }) => {
  const parsed = parseSignatureHeader(headerValue);
  if (!parsed.timestamp || parsed.signatures.length === 0) {
    return {
      valid: false,
      matchedSecret: "",
    };
  }

  const serializedPayload = typeof payload === "string" ? payload : JSON.stringify(payload || {});
  const signedBody = `${parsed.timestamp}.${serializedPayload}`;

  const candidatePairs = [
    { name: "current", secret: currentSecret },
    { name: "next", secret: nextSecret },
  ].filter((entry) => entry.secret);

  for (const candidate of candidatePairs) {
    const expected = buildHmacHex(candidate.secret, signedBody);
    const matched = parsed.signatures.some((provided) => secureHexEqual(provided, expected));
    if (matched) {
      return {
        valid: true,
        matchedSecret: candidate.name,
      };
    }
  }

  return {
    valid: false,
    matchedSecret: "",
  };
};

module.exports = {
  assertSecureWebhookUrl,
  buildTimestampedSignatureHeader,
  verifyTimestampedSignature,
};
