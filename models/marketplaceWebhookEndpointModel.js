const mongoose = require("mongoose");

const marketplaceWebhookEndpointSchema = new mongoose.Schema(
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
      default: null,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    url: {
      type: String,
      required: true,
      trim: true,
    },
    subscribedEvents: {
      type: [String],
      default: ["marketplace.*"],
    },
    endpointIdentity: {
      type: String,
      default: "default",
      trim: true,
      index: true,
    },
    environment: {
      type: String,
      enum: ["development", "staging", "production"],
      default: "production",
      index: true,
    },
    providerEndpointId: {
      type: String,
      default: "",
      trim: true,
      index: true,
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
    nextSecretHash: {
      type: String,
      default: "",
      select: false,
    },
    nextSecretCiphertext: {
      type: String,
      default: "",
      select: false,
    },
    secretOverlapUntil: {
      type: Date,
      default: null,
      index: true,
    },
    lastSecretRotatedAt: {
      type: Date,
      default: null,
    },
    status: {
      type: String,
      enum: ["active", "disabled"],
      default: "active",
      index: true,
    },
    failureCount: {
      type: Number,
      default: 0,
    },
    lastDeliveredAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

marketplaceWebhookEndpointSchema.index({ business: 1, status: 1 });
marketplaceWebhookEndpointSchema.index({ business: 1, url: 1 }, { unique: true });
marketplaceWebhookEndpointSchema.index(
  { business: 1, endpointIdentity: 1, environment: 1 },
  { unique: true },
);
marketplaceWebhookEndpointSchema.index(
  { business: 1, providerEndpointId: 1 },
  {
    unique: true,
    partialFilterExpression: { providerEndpointId: { $type: "string", $ne: "" } },
  },
);

const MarketplaceWebhookEndpoint = mongoose.model(
  "MarketplaceWebhookEndpoint",
  marketplaceWebhookEndpointSchema,
);

module.exports = MarketplaceWebhookEndpoint;
