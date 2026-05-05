const Cart = require("../../models/cartModel");
const Product = require("../../models/productModel");
const ProductGroup = require("../../models/productGroupModel");
const CheckOut = require("../../models/checkOutSalesModel");

const SYSTEM_MARKETPLACE_USER = {
  name: "Marketplace System",
  email: "system+marketplace@internal.sellsquare",
};

const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const generateCheckoutOrderId = (businessName = "MKP") => {
  const randomFourDigits = Math.floor(1000 + Math.random() * 9000);
  return `${String(businessName).substring(0, 4)}${randomFourDigits}`.toUpperCase();
};

const removeUniqueVariantFromGroup = async ({ product, productGroup }) => {
  const productIndex = productGroup.combinations.findIndex((comb) => comb === product.name);
  if (productIndex < 0) return;

  productGroup.sku = (productGroup.sku || []).filter((_, idx) => idx !== productIndex);
  productGroup.cost = (productGroup.cost || []).filter((_, idx) => idx !== productIndex);
  productGroup.price = (productGroup.price || []).filter((_, idx) => idx !== productIndex);
  productGroup.warehouse = (productGroup.warehouse || []).filter((_, idx) => idx !== productIndex);
  productGroup.quantity = (productGroup.quantity || []).filter((_, idx) => idx !== productIndex);
  productGroup.combinations = (productGroup.combinations || []).filter((_, idx) => idx !== productIndex);
  productGroup.combinationImages = (productGroup.combinationImages || []).filter(
    (_, idx) => idx !== productIndex,
  );

  if (Array.isArray(productGroup.options)) {
    productGroup.options = productGroup.options.map((optionGroup) => {
      if (!Array.isArray(optionGroup.attr)) return optionGroup;
      const nextAttr = optionGroup.attr.filter((_, idx) => idx !== productIndex + 1);
      return {
        ...optionGroup,
        attr: nextAttr,
      };
    });
  }
};

const applyAcceptedLineToInventory = async ({ line, actorName }) => {
  const quantitySold = toNumber(line.acceptedQty);
  if (quantitySold <= 0) return;

  const product = await Product.findById(line.product);
  if (!product) return;

  const oldQuantity = toNumber(product.quantity);
  if (oldQuantity < quantitySold) {
    throw new Error(`Insufficient stock during acceptance for product ${product._id}`);
  }

  product.quantity = oldQuantity - quantitySold;
  product.history = Array.isArray(product.history) ? product.history : [];
  product.history.push({
    date: new Date(),
    type: "sale",
    quantityChange: -quantitySold,
    balance: product.quantity,
    performedBy: actorName,
    note: "Marketplace accepted line fulfilled",
    amount: toNumber(line.effectiveUnitPrice),
  });

  if (!product.productIsaGroup) {
    await product.save();
    return;
  }

  const productGroup = product.itemGroup
    ? await ProductGroup.findById(product.itemGroup)
    : null;

  if (!productGroup) {
    await product.save();
    return;
  }

  productGroup.history = Array.isArray(productGroup.history) ? productGroup.history : [];
  productGroup.history.push({
    date: new Date(),
    type: "sale",
    itemName: product.name,
    quantityChange: -quantitySold,
    balance: product.quantity,
    performedBy: actorName,
    note: "Marketplace accepted line fulfilled",
    amount: toNumber(line.effectiveUnitPrice),
  });

  if (product.isProductUnique) {
    if (toNumber(product.quantity) <= 0) {
      await removeUniqueVariantFromGroup({ product, productGroup });
      await productGroup.save();
      await product.deleteOne();
      return;
    }

    await productGroup.save();
    await product.save();
    return;
  }

  const productIndex = (productGroup.combinations || []).findIndex((comb) => comb === product.name);
  if (productIndex > -1) {
    const currentQty = toNumber(productGroup.quantity?.[productIndex]);
    productGroup.quantity[productIndex] = Math.max(0, currentQty - quantitySold);
  }

  await productGroup.save();
  await product.save();
};

const fulfillMarketplaceOrderToCheckout = async ({
  business,
  order,
  acceptedLines,
  customer,
  actor = SYSTEM_MARKETPLACE_USER,
}) => {
  if (!Array.isArray(acceptedLines) || acceptedLines.length === 0) {
    throw new Error("No accepted lines to fulfill");
  }

  const actorName = actor.name || SYSTEM_MARKETPLACE_USER.name;
  const actorEmail = actor.email || SYSTEM_MARKETPLACE_USER.email;

  const checkoutItems = acceptedLines.map((line) => ({
    id: String(line.product),
    name: line.name,
    quantity: toNumber(line.acceptedQty),
    cost: 0,
    price: toNumber(line.effectiveUnitPrice),
    description: "",
    sku: line.sku || "",
    productIsaGroup: Boolean(line.isGroupVariant),
    isProductUnique: false,
    itemGroup: line.productGroup ? String(line.productGroup) : "",
    category: "",
    warehouse: "",
    subTotal: String(toNumber(line.effectiveUnitPrice) * toNumber(line.acceptedQty)),
  }));

  for (const line of acceptedLines) {
    await applyAcceptedLineToInventory({ line, actorName });
  }

  const cart = await Cart.findOneAndUpdate(
    {
      business: business._id,
      "user.email": actorEmail,
    },
    {
      $set: {
        business: business._id,
        user: {
          name: actorName,
          email: actorEmail,
        },
        items: checkoutItems.map((item) => ({
          ...item,
          quantity: String(item.quantity),
          price: String(item.price),
          cost: String(item.cost),
        })),
      },
    },
    {
      upsert: true,
      new: true,
    },
  );

  const totalOrderCost = checkoutItems.reduce(
    (sum, item) => sum + toNumber(item.price) * toNumber(item.quantity),
    0,
  );

  const checkOut = await CheckOut.create({
    business: business._id,
    items: checkoutItems,
    customer: {
      name: customer?.name || "Marketplace Customer",
      phone: customer?.phone || "",
      email: customer?.email || "",
    },
    user: {
      name: actorName,
      email: actorEmail,
    },
    payment: {
      paymentType: "marketplace",
      paymentTypes: ["marketplace"],
      paymentAmounts: {
        cash: 0,
        transfer: 0,
        pos: 0,
      },
      paymentStatus: "pending",
      paymentDetails: {
        amountPaid: 0,
        balance: totalOrderCost,
        paymentParts: [],
      },
    },
    deliveryStatus: {
      status: "pending",
      date: new Date(),
    },
    orderId: generateCheckoutOrderId(business.businessName),
    totalOrderCost,
  });

  cart.items = [];
  cart.lastCheckoutAt = new Date();
  cart.lastCheckoutId = checkOut._id.toString();
  await cart.save();

  return {
    checkOut,
    cart,
  };
};

module.exports = {
  SYSTEM_MARKETPLACE_USER,
  fulfillMarketplaceOrderToCheckout,
};
