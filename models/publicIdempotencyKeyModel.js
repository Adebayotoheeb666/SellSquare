const mongoose = require("mongoose");

const publicIdempotencyKeySchema = new mongoose.Schema(
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
    idempotencyKey: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    routeKey: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    requestHash: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ["processing", "completed", "failed"],
      default: "processing",
      index: true,
    },
    responseCode: {
      type: Number,
      default: null,
    },
    responseBody: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
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

publicIdempotencyKeySchema.index(
  { credential: 1, routeKey: 1, idempotencyKey: 1 },
  { unique: true },
);
publicIdempotencyKeySchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const PublicIdempotencyKey = mongoose.model(
  "PublicIdempotencyKey",
  publicIdempotencyKeySchema,
);

module.exports = PublicIdempotencyKey;
