const mongoose = require("mongoose");

const checkOutSchema = mongoose.Schema(
  {
    business: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "User",
    },
    items: [
      {
        id: String,
        name: String,
        quantity: Number,
        cost: Number,
        price: Number,
        description: String,
        sku: String,
        productIsaGroup: Boolean,
        isProductUnique: Boolean,
        itemGroup: String,
        category: String,
        warehouse: String,
        subTotal: String,
      },
    ],
    customer: {
      name: String,
      phone: String,
      email: String,
    },
    user: {
      name: String,
      email: String,
    },
    receipt: {
      type: String,
    },
    payment: {
      paymentType: {
        type: String,
        required: true,
      },
      // Array of methods selected (e.g. ["cash", "transfer", "pos"])
      paymentTypes: [String],
      // Amount collected per payment method
      paymentAmounts: {
        cash: { type: Number, default: 0 },
        transfer: { type: Number, default: 0 },
        pos: { type: Number, default: 0 },
      },
      paymentStatus: {
        type: String,
        required: true,
      },
      paymentDetails: {
        amountPaid: Number,
        balance: Number,
        paymentParts: [
          {
            amountPaid: Number,
            method: String,
            datePaid: {
              type: Date,
              default: Date.now,
            },
          },
        ],
      },
    },
    deliveryStatus: {
      status: {
        type: String,
        required: true,
        default: "pending",
      },
      date: {
        type: Date,
        default: Date.now,
      },
    },
    orderId: {
      type: String,
      required: true,
    },
    totalOrderCost: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

const CheckOut = mongoose.model("check-out-sessions", checkOutSchema);
module.exports = CheckOut;
