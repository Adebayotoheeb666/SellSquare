const mongoose = require("mongoose");

const publicRefreshSessionSchema = new mongoose.Schema(
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
    tokenFamilyId: {
      type: String,
      required: true,
      index: true,
    },
    refreshTokenHash: {
      type: String,
      required: true,
      select: false,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
    rotatedFrom: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PublicRefreshSession",
      default: null,
    },
    replacedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PublicRefreshSession",
      default: null,
    },
    revokedAt: {
      type: Date,
      default: null,
      index: true,
    },
    revokeReason: {
      type: String,
      default: "",
    },
    meta: {
      ip: {
        type: String,
        default: "",
      },
      userAgent: {
        type: String,
        default: "",
      },
    },
  },
  {
    timestamps: true,
  },
);

publicRefreshSessionSchema.index({ credential: 1, revokedAt: 1 });
publicRefreshSessionSchema.index({ tokenFamilyId: 1, createdAt: -1 });
publicRefreshSessionSchema.index({ refreshTokenHash: 1 }, { unique: true });

const PublicRefreshSession = mongoose.model(
  "PublicRefreshSession",
  publicRefreshSessionSchema,
);

module.exports = PublicRefreshSession;
