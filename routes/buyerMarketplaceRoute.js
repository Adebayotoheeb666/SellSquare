const express = require("express");
const router = express.Router();
const { protectBuyer } = require("../middleWare/buyerAuthMiddleware");
const {
  createOrUpdateCartHold,
  releaseCartHold,
  getCartHolds,
  refreshCartHolds,
  getListings,
  streamMarketplaceInventory,
  getProductDetail,
  getStoreInfo,
  checkout,
  migrateGuestCartHoldsToBuyer,
} = require("../controllers/buyerMarketplaceController");

/**
 * Cart Hold Routes (public for guest cart holds)
 */
router.post("/cart/hold", createOrUpdateCartHold);
router.delete("/cart/hold/:productId", releaseCartHold);
router.get("/cart/holds", getCartHolds);
router.post("/cart/heartbeat", refreshCartHolds);

/**
 * Checkout Route (requires buyer authentication)
 */
router.post("/checkout", protectBuyer, checkout);
router.post("/orders/checkout", protectBuyer, checkout);

/**
 * Product Listing Routes (public - no auth required)
 */
router.get("/products", getListings);
router.get("/products/stream", streamMarketplaceInventory);
router.get("/products/:productId", getProductDetail);
router.get("/store", getStoreInfo);
router.get("/store/:storeToken", getStoreInfo);

/**
 * Buyer Orders Routes (requires buyer authentication)
 * These routes support buyer order history and order detail viewing
 */
router.get("/orders", protectBuyer, async (req, res) => {
  const { page = 1, limit = 20, status } = req.query;
  const asyncHandler = require("express-async-handler");
  const InternalMarketplaceOrder = require("../models/internalMarketplaceOrderModel");
  const skip = (parseInt(page) - 1) * parseInt(limit);

  const query = { buyer: req.buyer._id };
  if (status) {
    query.status = status;
  }

  const total = await InternalMarketplaceOrder.countDocuments(query);
  const orders = await InternalMarketplaceOrder.find(query)
    .populate("business", "businessName")
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit));

  return res.status(200).json({
    message: "Buyer orders retrieved successfully",
    data: orders,
    pagination: {
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      pages: Math.ceil(total / parseInt(limit)),
    },
  });
});

router.get("/orders/:orderId", protectBuyer, async (req, res) => {
  const asyncHandler = require("express-async-handler");
  const InternalMarketplaceOrder = require("../models/internalMarketplaceOrderModel");
  const { orderId } = req.params;

  const order = await InternalMarketplaceOrder.findOne({
    _id: orderId,
    buyer: req.buyer._id,
  })
    .populate("business", "businessName businessEmail")
    .populate("escrowEntryId");

  if (!order) {
    return res.status(404).json({
      message: "Order not found",
    });
  }

  return res.status(200).json({
    message: "Order detail retrieved successfully",
    data: order,
  });
});

// Add endpoint to migrate guest cart holds to buyer after login
router.post("/cart/migrate-guest-holds", protectBuyer, migrateGuestCartHoldsToBuyer);

/**
 * Confirm Order Receipt
 */
const { confirmReceipt } = require("../controllers/internalMarketplaceOrderController");
router.post("/orders/:orderId/received", protectBuyer, confirmReceipt);

module.exports = router;
