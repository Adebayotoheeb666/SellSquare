const express = require("express");
const router = express.Router();
const protect = require("../middleWare/authMiddleware"); 
const {
  listInternalOrders,
  getInternalOrder,
  decideInternalOrder,
  updateOrderStatus,
} = require("../controllers/internalMarketplaceOrderController");

/**
 * List Internal Orders
 * GET /api/marketplace/internal-orders?status=payment_confirmed&page=1&limit=20
 */
router.get("/internal-orders", protect, listInternalOrders);

/**
 * Get Single Internal Order
 * GET /api/marketplace/internal-orders/:orderId
 */
router.get("/internal-orders/:orderId", protect, getInternalOrder);

/**
 * Accept or Reject Order
 * POST /api/marketplace/internal-orders/:orderId/decide
 * Body: { decision: "accepted" | "rejected", reason?: "reason if rejected" }
 */
router.post("/internal-orders/:orderId/decide", protect, decideInternalOrder);

/**
 * Update Order Status
 * POST /api/marketplace/internal-orders/:orderId/status
 * Body: { newStatus: "processing" | "shipped" | "delivered" }
 */
router.post("/internal-orders/:orderId/status", protect, updateOrderStatus);

module.exports = router;

