const mongoose = require("mongoose");

const marketplaceWebhookDeliverySchema = new mongoose.Schema(
  {
    business: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BusinessRegistration",
      required: true,
      index: true,
    },
    endpoint: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MarketplaceWebhookEndpoint",
      required: true,
      index: true,
    },
    eventType: {
      type: String,
      required: true,
      index: true,
    },
    eventId: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    correlationId: {
      type: String,
      default: "",
      trim: true,
      index: true,
    },
    schemaVersion: {
      type: String,
      default: "1.0.0",
      index: true,
    },
    payload: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
    attemptCount: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ["pending", "success", "failed", "dead_letter"],
      default: "pending",
      index: true,
    },
    responseCode: {
      type: Number,
      default: null,
    },
    responseBody: {
      type: String,
      default: "",
    },
    errorMessage: {
      type: String,
      default: "",
    },
    nextRetryAt: {
      type: Date,
      default: null,
      index: true,
    },
    deliveredAt: {
      type: Date,
      default: null,
    },
    deadLetteredAt: {
      type: Date,
      default: null,
    },
    dispatchLease: {
      owner: {
        type: String,
        default: "",
      },
      claimedAt: {
        type: Date,
        default: null,
      },
      expiresAt: {
        type: Date,
        default: null,
        index: true,
      },
    },
  },
  {
    timestamps: true,
  },
);

marketplaceWebhookDeliverySchema.index(
  { endpoint: 1, eventId: 1, schemaVersion: 1 },
  { unique: true },
);
marketplaceWebhookDeliverySchema.index({ status: 1, nextRetryAt: 1 });
marketplaceWebhookDeliverySchema.index({ status: 1, "dispatchLease.expiresAt": 1 });

const MarketplaceWebhookDelivery = mongoose.model(
  "MarketplaceWebhookDelivery",
  marketplaceWebhookDeliverySchema,
);

module.exports = MarketplaceWebhookDelivery;
