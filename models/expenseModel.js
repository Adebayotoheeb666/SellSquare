const mongoose = require("mongoose");

const expenseSchema = mongoose.Schema(
  {
    business: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "Business",
    },
    amount: {
      type: Number,
      required: [true, "Please add an amount"],
    },
    description: {
      type: String,
      required: [true, "Please add a description"],
      trim: true,
    },
    category: {
      type: String,
      default: "General",
      trim: true,
    },
    date: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

const Expense = mongoose.model("Expense", expenseSchema);
module.exports = Expense;
