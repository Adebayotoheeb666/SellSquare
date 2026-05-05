const mongoose = require("mongoose");

const MonthlyReportSchema = new mongoose.Schema(
  {
    business: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BusinessRegistration",
      required: true,
    },
    month: {
      type: Number,
      required: true,
    },
    year: {
      type: Number,
      required: true,
    },
    totalSales: {
      type: Number,
      required: true,
      default: 0,
    },
    netProfit: {
      type: Number,
      required: true,
      default: 0,
    },
    stockWorthPrice: {
      type: Number,
      required: true,
      default: 0,
    },
    stockWorthCost: {
        type: Number,
        required: true,
        default: 0,
    },
    pendingPayments: {
      count: {
        type: Number,
        required: true,
        default: 0,
      },
      amount: {
        type: Number,
        required: true,
        default: 0,
      },
    },
    newCustomers: {
      type: Number,
      required: true,
      default: 0,
    },
  },
  { timestamps: true }
);

const MonthlyReport = mongoose.model("MonthlyReport", MonthlyReportSchema);

module.exports = MonthlyReport;