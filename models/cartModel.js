const mongoose = require("mongoose");

const cartSchema = mongoose.Schema(
  {
    business: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "BusinessRegistration",
      index: true,
    },
    user: {
      email: {
        type: String,
        required: true,
        lowercase: true,
        trim: true,
      },
      name: {
        type: String,
        required: true,
      },
    },
    checkoutInProgress: {
      type: Boolean,
      default: false,
    },
    checkoutStartedAt: {
      type: Date,
      default: null,
    },
    lastCheckoutAt: {
      type: Date,
      default: null,
    },
    lastCheckoutId: {
      type: String,
      default: "",
    },
    items: [
      {
        id: String,
        name: String,
        cost: String,
        quantity: String,
        price: String,
        description: String,
        sku: String,
        productIsaGroup: Boolean,
        isProductUnique: Boolean,
        itemGroup: String,
        category: String,
        warehouse: String,
      },
    ],
  },
  {
    timestamps: true,
  },
);

// Enforce unique constraint on (business, user.email)
// Email is automatically lowercase/trimmed by the schema
cartSchema.index({ business: 1, "user.email": 1 }, { unique: true });

// Pre-save middleware to ensure email normalization
cartSchema.pre("save", function (next) {
  if (this.user && this.user.email) {
    this.user.email = this.user.email.trim().toLowerCase();
  }
  next();
});

// Pre-findOneAndUpdate middleware to ensure email normalization
cartSchema.pre("findOneAndUpdate", function (next) {
  const update = this.getUpdate();
  if (update["user.email"]) {
    update["user.email"] = update["user.email"].trim().toLowerCase();
  }
  next();
});

const Cart = mongoose.model("Cart", cartSchema);
module.exports = Cart;
