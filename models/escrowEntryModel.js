const mongoose = require("mongoose");
const { Schema } = mongoose;

const escrowEntrySchema = new Schema(
  {
    buyer: {
      type: Schema.Types.ObjectId,
      ref: "Buyer",
      required: true,
      index: true,
    },
    business: {
      type: Schema.Types.ObjectId,
      ref: "Business",
      required: true,
      index: true,
    },
    order: {
      type: Schema.Types.ObjectId,
      ref: "InternalMarketplaceOrder",
      required: true,
      unique: true,
    },
    checkoutSessionRef: {
      type: String,
      index: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    currency: {
      type: String,
      default: "NGN",
    },
    status: {
      type: String,
      enum: ["held", "released_to_business", "refunded_to_buyer"],
      default: "held",
      index: true,
    },
    paymentReference: String,
    paidAt: Date,
    settledAt: Date,
  },
  { timestamps: true }
);

// Compound index for fast queries during accept/reject operations
escrowEntrySchema.index({ buyer: 1, business: 1, status: 1 });

module.exports = mongoose.model("EscrowEntry", escrowEntrySchema);
