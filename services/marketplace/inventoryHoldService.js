const InventoryHold = require("../../models/inventoryHoldModel");
const Product = require("../../models/productModel");
const mongoose = require("mongoose");
const { HOLD_DURATION_MINUTES } = require("./constants");
const { eventBus } = require("../../events/EventEmitter");

const toIdString = (value) => {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (value._id) return value._id.toString();
  if (value.toString) return value.toString();
  return "";
};

const buildHoldExpiry = (minutes = HOLD_DURATION_MINUTES) => {
  const expiry = new Date();
  expiry.setMinutes(expiry.getMinutes() + minutes);
  return expiry;
};

const reserveHoldCapacity = async ({ businessId, productId, quantity, session = null }) => {
  const reserveQty = Number(quantity || 0);
  if (reserveQty <= 0) return;

  const match = {
    _id: productId,
    business: businessId,
    $expr: {
      $gte: [
        "$quantity",
        {
          $add: [
            { $ifNull: ["$activeMarketplaceHoldQty", 0] },
            reserveQty,
          ],
        },
      ],
    },
  };

  const options = session ? { session } : {};

  const reserved = await Product.findOneAndUpdate(
    match,
    {
      $inc: {
        activeMarketplaceHoldQty: reserveQty,
      },
    },
    {
      ...options,
      new: true,
    },
  );

  if (!reserved) {
    const error = new Error("Insufficient stock to reserve inventory hold");
    error.code = "INSUFFICIENT_STOCK_HOLD_CAPACITY";
    error.statusCode = 409;
    throw error;
  }

  // Emit event for real-time updates
  const availableQty = Math.max(0, reserved.quantity - (reserved.activeMarketplaceHoldQty || 0));
  eventBus.emitBusinessEvent("inventory.hold_updated", businessId.toString(), {
    productId: productId.toString(),
    holdType: "marketplace_hold",
    availableQty,
  });
};

const releaseHoldCapacity = async ({ businessId, productId, quantity, session = null }) => {
  const releaseQty = Number(quantity || 0);
  if (releaseQty <= 0) return;

  const options = session ? { session } : {};

  await Product.updateOne(
    {
      _id: productId,
      business: businessId,
    },
    [
      {
        $set: {
          activeMarketplaceHoldQty: {
            $max: [
              0,
              {
                $subtract: [{ $ifNull: ["$activeMarketplaceHoldQty", 0] }, releaseQty],
              },
            ],
          },
        },
      },
    ],
    options,
  );

  // Emit event for real-time updates
  const product = await Product.findById(productId).select("quantity activeMarketplaceHoldQty");
  if (product) {
    const availableQty = Math.max(0, product.quantity - (product.activeMarketplaceHoldQty || 0));
    eventBus.emitBusinessEvent("inventory.hold_updated", businessId.toString(), {
      productId: productId.toString(),
      holdType: "marketplace_hold",
      action: "released",
      availableQty,
    });
  }
};

const getActiveHeldQuantity = async ({ businessId, productId }) => {
  const toObjectId = (value) => {
    if (!value) return value;
    if (value instanceof mongoose.Types.ObjectId) return value;
    if (typeof value === "string" && mongoose.Types.ObjectId.isValid(value)) {
      return new mongoose.Types.ObjectId(value);
    }
    return value;
  };

  const normalizedBusinessId = toObjectId(businessId);
  const normalizedProductId = toObjectId(productId);

  const product = await Product.findOne(
    {
      _id: normalizedProductId,
      business: normalizedBusinessId,
    },
    { activeMarketplaceHoldQty: 1 },
  ).lean();

  if (Number.isFinite(Number(product?.activeMarketplaceHoldQty))) {
    return Number(product.activeMarketplaceHoldQty || 0);
  }

  const rows = await InventoryHold.aggregate([
    {
      $match: {
        business: normalizedBusinessId,
        product: normalizedProductId,
        status: "active",
      },
    },
    {
      $group: {
        _id: null,
        total: { $sum: "$quantity" },
      },
    },
  ]);

  return Number(rows?.[0]?.total || 0);
};

const createLineHold = async ({
  businessId,
  orderId,
  lineId,
  productId,
  productGroupId = null,
  quantity,
  holdMinutes = HOLD_DURATION_MINUTES,
  session = null,
}) => {
  const options = session ? { session } : {};
  const nextQuantity = Number(quantity || 0);

  const existing = await InventoryHold.findOne(
    {
      order: orderId,
      lineId,
    },
    null,
    options,
  );

  const currentActiveQty = existing?.status === "active" ? Number(existing.quantity || 0) : 0;
  const deltaQty = nextQuantity - currentActiveQty;

  if (deltaQty > 0) {
    await reserveHoldCapacity({
      businessId,
      productId,
      quantity: deltaQty,
      session,
    });
  } else if (deltaQty < 0) {
    await releaseHoldCapacity({
      businessId,
      productId,
      quantity: Math.abs(deltaQty),
      session,
    });
  }

  try {
    return await InventoryHold.findOneAndUpdate(
    {
      order: orderId,
      lineId,
    },
    {
      $set: {
        business: businessId,
        order: orderId,
        lineId,
        product: productId,
        productGroup: productGroupId,
        quantity: Number(quantity),
        status: "active",
        releaseReason: "",
        releasedAt: null,
        expiresAt: buildHoldExpiry(holdMinutes),
      },
    },
    {
      upsert: true,
      new: true,
      ...options,
    },
  );
  } catch (error) {
    if (deltaQty > 0) {
      await releaseHoldCapacity({
        businessId,
        productId,
        quantity: deltaQty,
        session,
      });
    }
    throw error;
  }
};

const releaseOrderHolds = async ({ orderId, reason = "order_rejected", session = null }) => {
  const now = new Date();
  const options = session ? { session } : {};

  const activeHolds = await InventoryHold.find(
    {
      order: orderId,
      status: { $in: ["active", "consumed"] },
    },
    null,
    options,
  ).lean();

  const result = await InventoryHold.updateMany(
    {
      order: orderId,
      status: { $in: ["active", "consumed"] },
    },
    {
      $set: {
        status: "released",
        releaseReason: reason,
        releasedAt: now,
      },
    },
    options,
  );

  for (const hold of activeHolds) {
    await releaseHoldCapacity({
      businessId: hold.business,
      productId: hold.product,
      quantity: hold.quantity,
      session,
    });
  }

  return result;
};

const releaseLineHold = async ({ orderId, lineId, reason = "line_rejected", session = null }) => {
  const now = new Date();
  const options = session ? { session } : {};

  const activeHold = await InventoryHold.findOne(
    {
      order: orderId,
      lineId,
      status: { $in: ["active", "consumed"] },
    },
    null,
    options,
  ).lean();

  const result = await InventoryHold.updateOne(
    {
      order: orderId,
      lineId,
      status: { $in: ["active", "consumed"] },
    },
    {
      $set: {
        status: "released",
        releaseReason: reason,
        releasedAt: now,
      },
    },
    options,
  );

  if (activeHold) {
    await releaseHoldCapacity({
      businessId: activeHold.business,
      productId: activeHold.product,
      quantity: activeHold.quantity,
      session,
    });
  }

  return result;
};

const consumeOrderHolds = async ({ orderId, reason = "accepted_to_checkout", session = null }) => {
  const now = new Date();
  const options = session ? { session } : {};

  const activeHolds = await InventoryHold.find(
    {
      order: orderId,
      status: "active",
    },
    null,
    options,
  ).lean();

  const result = await InventoryHold.updateMany(
    {
      order: orderId,
      status: "active",
    },
    {
      $set: {
        status: "consumed",
        releaseReason: reason,
        releasedAt: now,
      },
    },
    options,
  );

  return result;
};

const finalizeAcceptedOrderHolds = async ({
  orderId,
  reason = "order_accepted",
  session = null,
}) => {
  const now = new Date();
  const options = session ? { session } : {};

  const holds = await InventoryHold.find(
    {
      order: orderId,
      status: { $in: ["active", "consumed"] },
    },
    null,
    options,
  ).lean();

  for (const hold of holds) {
    await Product.updateOne(
      {
        _id: hold.product,
        business: hold.business,
      },
      [
        {
          $set: {
            quantity: {
              $max: [
                0,
                { $subtract: [{ $ifNull: ["$quantity", 0] }, Number(hold.quantity || 0)] },
              ],
            },
            activeMarketplaceHoldQty: {
              $max: [
                0,
                {
                  $subtract: [
                    { $ifNull: ["$activeMarketplaceHoldQty", 0] },
                    Number(hold.quantity || 0),
                  ],
                },
              ],
            },
          },
        },
      ],
      options,
    );

    // Emit event for real-time updates
    const updatedProduct = await Product.findById(hold.product).select("quantity activeMarketplaceHoldQty");
    if (updatedProduct) {
      const availableQty = Math.max(0, updatedProduct.quantity - (updatedProduct.activeMarketplaceHoldQty || 0));
      eventBus.emitBusinessEvent("inventory.hold_updated", hold.business.toString(), {
        productId: hold.product.toString(),
        holdType: "marketplace_hold",
        action: "finalized",
        availableQty,
      });
    }
  }

  await InventoryHold.updateMany(
    {
      order: orderId,
      status: { $in: ["active", "consumed"] },
    },
    {
      $set: {
        status: "released",
        releaseReason: reason,
        releasedAt: now,
      },
    },
    options,
  );
};

const expireStaleHolds = async ({ now = new Date(), session = null } = {}) => {
  const options = session ? { session } : {};

  const activeHolds = await InventoryHold.find(
    {
      status: "active",
      expiresAt: { $lte: now },
    },
    null,
    options,
  ).lean();

  const result = await InventoryHold.updateMany(
    {
      status: "active",
      expiresAt: { $lte: now },
    },
    {
      $set: {
        status: "expired",
        releaseReason: "hold_timeout",
        releasedAt: now,
      },
    },
    options,
  );

  for (const hold of activeHolds) {
    await releaseHoldCapacity({
      businessId: hold.business,
      productId: hold.product,
      quantity: hold.quantity,
      session,
    });
  }

  return result;
};

module.exports = {
  toIdString,
  buildHoldExpiry,
  getActiveHeldQuantity,
  createLineHold,
  releaseOrderHolds,
  releaseLineHold,
  consumeOrderHolds,
  finalizeAcceptedOrderHolds,
  expireStaleHolds,
};
