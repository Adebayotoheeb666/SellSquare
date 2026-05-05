const mongoose = require("mongoose");
const { Schema } = mongoose;

const businessTransactionSchema = new Schema({
  type: {
    type: String,
    enum: ["credit", "debit", "withdrawal"],
    required: true,
  },
  amount: {
    type: Number,
    required: true,
  },
  reason: {
    type: String,
    required: true,
  },
  reference: String,
  relatedOrder: {
    type: Schema.Types.ObjectId,
    ref: "InternalMarketplaceOrder",
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const businessWalletSchema = new Schema(
  {
    business: {
      type: Schema.Types.ObjectId,
      ref: "Business",
      required: true,
      unique: true,
      index: true,
    },
    balance: {
      type: Number,
      default: 0,
      min: 0,
    },
    escrowBalance: {
      type: Number,
      default: 0,
      min: 0,
    },
    currency: {
      type: String,
      default: "NGN",
    },
    transactions: [businessTransactionSchema],
  },
  { timestamps: true }
);

module.exports = mongoose.model("BusinessWallet", businessWalletSchema);
