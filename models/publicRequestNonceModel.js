const mongoose = require("mongoose");

const publicRequestNonceSchema = new mongoose.Schema(
  {
    business: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BusinessRegistration",
      required: true,
      index: true,
    },
    credential: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PublicApiCredential",
      required: true,
      index: true,
    },
    nonce: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    requestTimestamp: {
      type: Date,
      required: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
  },
  {
    timestamps: true,
  },
);

publicRequestNonceSchema.index({ credential: 1, nonce: 1 }, { unique: true });
publicRequestNonceSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const PublicRequestNonce = mongoose.model(
  "PublicRequestNonce",
  publicRequestNonceSchema,
);

module.exports = PublicRequestNonce;
