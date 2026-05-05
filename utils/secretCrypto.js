const crypto = require("crypto");

const getKey = () => {
  const raw =
    process.env.MARKETPLACE_SECRET_ENCRYPTION_KEY ||
    process.env.JWT_SECRET ||
    "sell-square-marketplace-default-key";

  return crypto.createHash("sha256").update(raw).digest();
};

const encryptSecret = (secret) => {
  const iv = crypto.randomBytes(12);
  const key = getKey();
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);

  const encrypted = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return `${iv.toString("hex")}:${tag.toString("hex")}:${encrypted.toString("hex")}`;
};

const decryptSecret = (payload) => {
  if (!payload || typeof payload !== "string") return "";

  const [ivHex, tagHex, encryptedHex] = payload.split(":");
  if (!ivHex || !tagHex || !encryptedHex) return "";

  const key = getKey();
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(ivHex, "hex"),
  );
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedHex, "hex")),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
};

module.exports = {
  encryptSecret,
  decryptSecret,
};
