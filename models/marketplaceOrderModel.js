const mongoose = require("mongoose");

const ORDER_STATUSES = [
  "placed",
  "payment_confirmed",
  "accepted",
  "rejected",
  "processing",
  "shipped",
  "delivered",
];

const LINE_STATUSES = [
  "pending",
  "accepted",
  "partially_accepted",
  "rejected",
  "out_of_stock",
];

const statusHistorySchema = new mongoose.Schema(
  {
    from: {
      type: String,
      enum: ORDER_STATUSES,
      default: undefined,
    },
    to: {
      type: String,
      enum: ORDER_STATUSES,
      required: true,
    },
    by: {
      type: String,
      default: "system",
    },
    reason: {
      type: String,
      default: "",
    },
    at: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false },
);

const orderWarningSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      trim: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
    },
    severity: {
      type: String,
      enum: ["info", "warning", "critical"],
      default: "warning",
    },
    meta: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    at: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false },
);

const orderLineSchema = new mongoose.Schema(
  {
    lineId: {
      type: String,
      required: true,
      trim: true,
    },
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Products",
      required: true,
    },
    productGroup: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "productGroup",
      default: null,
    },
    isGroupVariant: {
      type: Boolean,
      default: false,
    },
    listingId: {
      type: String,
      default: "",
      trim: true,
    },
    variantId: {
      type: String,
      default: "",
      trim: true,
    },
    sku: {
      type: String,
      default: "",
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    requestedQty: {
      type: Number,
      required: true,
      min: 1,
    },
    acceptedQty: {
      type: Number,
      default: 0,
      min: 0,
    },
    rejectedQty: {
      type: Number,
      default: 0,
      min: 0,
    },
    lineStatus: {
      type: String,
      enum: LINE_STATUSES,
      default: "pending",
    },
    baseUnitPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    effectiveUnitPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    discountMeta: {
      discountId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Discount",
        default: null,
      },
      discountName: {
        type: String,
        default: "",
      },
      discountType: {
        type: String,
        enum: ["amount", "percentage", "none"],
        default: "none",
      },
      discountAmount: {
        type: Number,
        default: 0,
      },
    },
    decisionReason: {
      type: String,
      default: "",
    },
    variantImage: {
      type: String,
      default: "",
      trim: true,
    },
    groupImage: {
      type: String,
      default: "",
      trim: true,
    },
    selectedImage: {
      type: String,
      default: "",
      trim: true,
    },
    lineMeta: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { _id: false },
);

const marketplaceOrderSchema = new mongoose.Schema(
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
    orderNumber: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },
    partnerOrderRef: {
      type: String,
      default: "",
      trim: true,
      index: true,
    },
    idempotencyKey: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    status: {
      type: String,
      enum: ORDER_STATUSES,
      default: "placed",
      index: true,
    },
    lines: {
      type: [orderLineSchema],
      default: [],
    },
    customer: {
      name: {
        type: String,
        default: "",
      },
      phone: {
        type: String,
        default: "",
      },
      email: {
        type: String,
        default: "",
        lowercase: true,
        trim: true,
      },
      address: {
        type: String,
        default: "",
      },
    },
    shippingAddress: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    fulfillment: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    payment: {
      paymentId: {
        type: String,
        default: "",
        trim: true,
      },
      isPaid: {
        type: Boolean,
        default: false,
      },
      paidAt: {
        type: Date,
        default: null,
      },
      trustedPaidFlag: {
        type: Boolean,
        default: false,
      },
      partnerPaymentMeta: {
        type: mongoose.Schema.Types.Mixed,
        default: {},
      },
    },
    totals: {
      requestedSubtotal: {
        type: Number,
        default: 0,
      },
      acceptedSubtotal: {
        type: Number,
        default: 0,
      },
      rejectedSubtotal: {
        type: Number,
        default: 0,
      },
    },
    statusHistory: {
      type: [statusHistorySchema],
      default: [],
    },
    warnings: {
      type: [orderWarningSchema],
      default: [],
    },
    auditTrail: {
      type: [mongoose.Schema.Types.Mixed],
      default: [],
    },
    checkoutSession: {
      checkoutId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "check-out-sessions",
        default: null,
      },
      orderId: {
        type: String,
        default: "",
      },
      actor: {
        type: String,
        default: "system:marketplace",
      },
    },
  },
  {
    timestamps: true,
  },
);

marketplaceOrderSchema.index(
  { business: 1, credential: 1, idempotencyKey: 1 },
  { unique: true },
);
marketplaceOrderSchema.index({ business: 1, createdAt: -1 });
marketplaceOrderSchema.index({ business: 1, status: 1, createdAt: -1 });

const MarketplaceOrder = mongoose.model("MarketplaceOrder", marketplaceOrderSchema);

module.exports = {
  MarketplaceOrder,
  ORDER_STATUSES,
  LINE_STATUSES,
};
