const mongoose = require("mongoose");
const { Schema } = mongoose;

const lineSchema = new Schema({
  product: {
    type: Schema.Types.ObjectId,
    ref: "Products",
    required: true,
  },
  productGroup: {
    type: Schema.Types.ObjectId,
    ref: "productGroup",
  },
  isGroupVariant: {
    type: Boolean,
    default: false,
  },
  sku: String,
  name: String,
  variantLabel: String,
  image: {
    type: Schema.Types.Mixed,
    default: "",
  },
  requestedQty: {
    type: Number,
    required: true,
    min: 1,
  },
  acceptedQty: {
    type: Number,
    default: 0,
  },
  rejectedQty: {
    type: Number,
    default: 0,
  },
  lineStatus: {
    type: String,
    enum: ["pending", "accepted", "partially_accepted", "rejected"],
    default: "pending",
  },
  decisionReason: {
    type: String,
    default: "",
  },
  unitPrice: {
    type: Number,
    required: true,
  },
  lineTotal: {
    type: Number,
    required: true,
  },
  holdId: {
    type: Schema.Types.ObjectId,
    ref: "InventoryHold",
  },
});

const internalMarketplaceOrderSchema = new Schema(
  {
    business: {
      type: Schema.Types.ObjectId,
      ref: "Business",
      required: true,
      index: true,
    },
    buyer: {
      type: Schema.Types.ObjectId,
      ref: "Buyer",
      required: true,
      index: true,
    },
    checkoutSessionRef: {
      type: String,
      index: true,
    }, // ties together all orders from one cart checkout
    orderNumber: {
      type: String,
      unique: true,
    }, // IMO-{random}

    status: {
      type: String,
      enum: ["placed", "payment_confirmed", "accepted", "rejected", "processing", "shipped", "delivered", "received"],
      default: "placed",
      index: true,
    },

    lines: [lineSchema],

    subtotal: {
      type: Number,
      required: true,
    },

    shippingAddress: {
      type: String,
      required: true,
    },

    escrowEntryId: {
      type: Schema.Types.ObjectId,
      ref: "EscrowEntry",
      index: true,
    },

    rejectionReason: String,

    deliveredAt: Date,
    receivedAt: Date,

    buyer_notified_at: Date,

    statusHistory: [
      {
        from: String,
        to: String,
        by: String,
        reason: String,
        at: {
          type: Date,
          default: Date.now,
        },
      },
    ],
  },
  { timestamps: true }
);

// Auto-generate orderNumber before save
internalMarketplaceOrderSchema.pre("save", async function (next) {
  if (!this.orderNumber) {
    const rand = Math.random().toString(36).substring(2, 8).toUpperCase();
    this.orderNumber = `IMO-${rand}`;
  }
  next();
});

module.exports = mongoose.model("InternalMarketplaceOrder", internalMarketplaceOrderSchema);
