const mongoose = require("mongoose");

const inventoryHoldSchema = new mongoose.Schema(
  {
    business: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BusinessRegistration",
      required: true,
      index: true,
    },
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MarketplaceOrder",
      required: true,
      index: true,
    },
    lineId: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Products",
      required: true,
      index: true,
    },
    productGroup: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "productGroup",
      default: null,
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
    },
    status: {
      type: String,
      enum: ["active", "released", "expired", "consumed"],
      default: "active",
      index: true,
    },
    releaseReason: {
      type: String,
      default: "",
    },
    releasedAt: {
      type: Date,
      default: null,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
    source: {
      type: String,
      enum: ["partner_order", "buyer_cart"],
      default: "partner_order",
      index: true,
    },
    buyerSession: String, // optional: session ID for unauthenticated holds or buyer cart holds
  },
  {
    timestamps: true,
  },
);

inventoryHoldSchema.index({ order: 1, lineId: 1 }, { unique: true });
inventoryHoldSchema.index({ business: 1, product: 1, status: 1 });

const InventoryHold = mongoose.model("InventoryHold", inventoryHoldSchema);

module.exports = InventoryHold;
