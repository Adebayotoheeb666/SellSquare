const mongoose = require("mongoose");

const discountSchema = mongoose.Schema(
  {
    business: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Business",
      required: true,
    },
    discountName: {
      type: String,
      required: true,
      trim: true,
    },
    discountType: {
      type: String,
      enum: ["marketplace_sales", "recorded_sales"],
      required: true,
    },
    discountAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    discountValueType: {
      type: String,
      enum: ["amount", "percentage"],
      required: true,
    },
    startDate: {
      type: Date,
      required: true,
    },
    expirationDate: {
      type: Date,
      required: true,
    },
    applyTo: {
      type: String,
      enum: ["single_product", "group_product", "both"],
      required: true,
    },
    appliedProducts: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product",
      },
    ],
    appliedProductGroups: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "ProductGroup",
      },
    ],
    groupSelection: {
      type: String,
      enum: ["all_items", "selected_items"],
      default: "all_items",
    },
    appliedGroupItems: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product",
      },
    ],
    isActive: {
      type: Boolean,
      default: true,
    },
    status: {
      type: String,
      enum: ["active", "expired", "draft"],
      default: "draft",
    },
    description: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

// Index for faster queries
discountSchema.index({ business: 1, discountName: 1 });
discountSchema.index({ business: 1, status: 1 });
discountSchema.index({ appliedProducts: 1 });
discountSchema.index({ appliedProductGroups: 1 });
discountSchema.index(
  { business: 1, isActive: 1, status: 1, startDate: 1, expirationDate: 1, createdAt: -1 },
  { background: true, name: "idx_discount_active_window" },
);

// Middleware to auto-update status based on dates
discountSchema.pre("save", function (next) {
  const now = new Date();
  if (now >= this.expirationDate) {
    this.status = "expired";
    this.isActive = false;
  } else if (now >= this.startDate) {
    this.status = "active";
    this.isActive = true;
  } else {
    this.status = "draft";
    this.isActive = false;
  }
  next();
});

const Discount = mongoose.model("Discount", discountSchema);
module.exports = Discount;
