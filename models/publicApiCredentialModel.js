const mongoose = require("mongoose");

const allowlistDomainSchema = new mongoose.Schema(
  {
    domain: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { _id: false },
);

const publicApiCredentialSchema = new mongoose.Schema(
  {
    business: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BusinessRegistration",
      required: true,
      index: true,
    },
    keyId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    secretHash: {
      type: String,
      required: true,
      select: false,
    },
    secretCiphertext: {
      type: String,
      required: true,
      select: false,
    },
    secretVersion: {
      type: Number,
      default: 1,
    },
    status: {
      type: String,
      enum: ["active", "revoked"],
      default: "active",
      index: true,
    },
    scopes: {
      type: [String],
      default: [
        "listings:read",
        "orders:read",
        "orders:write",
        "events:read",
      ],
    },
    allowlistedDomains: {
      type: [allowlistDomainSchema],
      default: [],
    },
    rateLimit: {
      perMinute: {
        type: Number,
        default: 120,
        min: 1,
      },
    },
    lastRotatedAt: {
      type: Date,
      default: Date.now,
    },
    revokedAt: {
      type: Date,
      default: null,
    },
    metadata: {
      createdBy: {
        type: String,
        default: "system",
      },
      notes: {
        type: String,
        default: "",
      },
    },
  },
  {
    timestamps: true,
  },
);

publicApiCredentialSchema.index({ business: 1, status: 1 });
publicApiCredentialSchema.index({ business: 1, name: 1 });

const PublicApiCredential = mongoose.model(
  "PublicApiCredential",
  publicApiCredentialSchema,
);

module.exports = PublicApiCredential;
