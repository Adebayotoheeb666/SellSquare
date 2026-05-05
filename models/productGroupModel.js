const mongoose = require("mongoose");
const { Schema } = mongoose;

const productGroupSchema = mongoose.Schema(
  {
    business: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "Business",
    },
    groupName: {
      type: String,
      default: "",
    },
    category: {
      type: String,
      default: "",
    },
    description: {
      type: String,
      default: "",
    },
    isProductUnique: {
      type: Boolean,
      default: false,
    },
    cost: {
      type: [Number],
      default: [],
    },
    price: {
      type: [Number],
      default: [],
    },
    sku: {
      type: [String],
      default: [],
    },
    warehouse: {
      type: [String],
      default: [],
    },
    quantity: {
      type: [String],
      default: [],
    },
    attributes: {
      type: [String],
      default: [],
    },
    options: {
      type: Object,
      default: {},
    },
    listingOptions: {
      type: [
        {
          attribute: {
            type: String,
            default: "",
          },
          attributeIndex: {
            type: Number,
            default: 0,
          },
          options: {
            type: [String],
            default: [],
          },
        },
      ],
      default: [],
    },
    combinations: {
      type: [String],
      default: [],
    },
    variantMap: {
      type: [
        {
          variantKey: {
            type: String,
            default: "",
            trim: true,
          },
          combination: {
            type: String,
            default: "",
            trim: true,
          },
          sku: {
            type: String,
            default: "",
            trim: true,
          },
          indexHint: {
            type: Number,
            default: -1,
          },
          lastKnownProductId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Products",
            default: null,
          },
        },
      ],
      default: [],
    },
    combinationImages: {
      type: [Schema.Types.Mixed],
      default: [],
    },
    image: {
      type: Object,
      default: {},
    },
    images: {
      type: [Object],
      default: [],
    },
    listGroup: {
      type: Boolean,
      default: false,
      description: "Whether product group is listed/visible (true = on, false = off)",
    },
    totalStocked: {
      type: Number,
      default: 0,
      description: "Accumulated total quantity stocked in for the group",
    },
    totalSold: {
      type: Number,
      default: 0,
      description:
        "Total quantity sold from this group (calculated from checkouts)",
    },
    totalRevenue: {
      type: Number,
      default: 0,
      description: "Total revenue from this group sales",
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
        itemName: {
          type: String,
          description:
            "For group items, the product name in format: 'Iwatch Nino updated - 7765456786'",
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

productGroupSchema.index({ business: 1, "variantMap.variantKey": 1 });
productGroupSchema.index({ business: 1 }, { background: true, name: "idx_group_business" });
productGroupSchema.index(
  { business: 1, listGroup: 1, updatedAt: -1 },
  { background: true, name: "idx_group_listed_by_business" },
);

const ProductGroup = mongoose.model("productGroup", productGroupSchema);
module.exports = ProductGroup;
