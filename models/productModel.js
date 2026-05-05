const mongoose = require("mongoose");

const productSchema = mongoose.Schema(
  {
    business: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "Business",
    },
    productIsaGroup: {
      type: Boolean,
      required: true,
      default: false,
    },
    isProductUnique: {
      type: Boolean,
      required: true,
      default: false,
    },
    itemGroup: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
    },
    variantKey: {
      type: String,
      default: "",
      trim: true,
    },
    variantLabel: {
      type: String,
      default: "",
      trim: true,
    },
    name: {
      type: String,
      required: [true, "Please add a name"],
      trim: true,
    },
    sku: {
      type: String,
      required: true,
      default: "SKU",
      trim: true,
    },
    category: {
      type: String,
      required: [true, "Please add a category"],
      trim: true,
    },
    quantity: {
      type: Number,
      required: [true, "Please add a quantity"],
      trim: true,
    },
    activeMarketplaceHoldQty: {
      type: Number,
      default: 0,
      min: 0,
    },
    warehouse: {
      type: String,
      required: false,
      trim: true,
    },
    cost: {
      type: Number,
      required: false,
      trim: true,
    },
    price: {
      type: Number,
      required: [true, "Please add a price"],
      trim: true,
    },
    description: {
      type: String,
      required: [true, "Please add a description"],
      trim: true,
    },
    image: {
      type: Object,
      default: {},
    },
    images: {
      type: [Object],
      default: [],
    },
    listProduct: {
      type: Boolean,
      default: false,
      description: "Whether product is listed/visible (true = on, false = off)",
    },
    totalStocked: {
      type: Number,
      default: 0,
      description:
        "Accumulated total quantity stocked in (for history tracking)",
    },
    totalSold: {
      type: Number,
      default: 0,
      description: "Total quantity sold (calculated from checkouts)",
    },
    totalRevenue: {
      type: Number,
      default: 0,
      description: "Total revenue from sales (calculated from checkouts)",
    },
    history: [
      {
        date: {
          type: Date,
          default: Date.now,
        },
        type: {
          type: String,
          enum: ["stock-in", "sale", "adjustment"],
          required: true,
        },
        quantityChange: {
          type: Number,
          required: true,
        },
        balance: {
          type: Number,
          required: true,
        },
        performedBy: {
          type: String,
          default: "",
        },
        note: {
          type: String,
          default: "",
        },
        amount: {
          type: Number,
          default: 0,
          description: "Selling price per unit at time of sale",
        },
      },
    ],
  },
  {
    timestamps: true,
  }
);

productSchema.index(
  { business: 1, itemGroup: 1, variantKey: 1 },
  {
    unique: true,
    sparse: true,
    partialFilterExpression: {
      itemGroup: { $exists: true, $ne: null },
      variantKey: { $exists: true, $ne: "" },
    },
  },
);

productSchema.index(
  { business: 1, listProduct: 1, productIsaGroup: 1, updatedAt: -1 },
  { background: true, name: "idx_product_listed_single_business" },
);

productSchema.index(
  { business: 1, quantity: 1 },
  { background: true, name: "idx_product_business_quantity" },
);

productSchema.index(
  { business: 1, category: 1 },
  { background: true, name: "idx_product_business_category" },
);

productSchema.index(
  { business: 1, productIsaGroup: 1, itemGroup: 1, listProduct: 1, updatedAt: -1 },
  { background: true, name: "idx_product_listed_variants_by_group" },
);

const Product = mongoose.model("Products", productSchema);
module.exports = Product;
