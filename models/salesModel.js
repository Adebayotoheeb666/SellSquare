const mongoose = require("mongoose");

const salesSchema = mongoose.Schema(
  {
    business: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "Business",
    },
    productId: {
      type: String,
      required: true,
    },
    name: {
      type: String,
      required: true,
    },
    quantity: {
      type: String,
      required: [true, "Please add quantity"],
    },
    cost: {
      type: String,
    },
    price: {
      type: String,
    },
    category: {
      type: String,
    },
    createdAt: {
      type: Date,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

const Sales = mongoose.model("Sales", salesSchema);
module.exports = Sales;
