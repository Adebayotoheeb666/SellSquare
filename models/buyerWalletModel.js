const mongoose = require("mongoose");
const { Schema } = mongoose;

const transactionSchema = new Schema({
  type: {
    type: String,
    enum: ["credit", "debit"],
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

const buyerWalletSchema = new Schema(
  {
    buyer: {
      type: Schema.Types.ObjectId,
      ref: "Buyer",
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
    transactions: [transactionSchema],
  },
  { timestamps: true }
);

module.exports = mongoose.model("BuyerWallet", buyerWalletSchema);
