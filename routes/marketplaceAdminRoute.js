const express = require("express");
const router = express.Router();
const protect = require("../middleWare/authMiddleware");
const adminCheck = require("../middleWare/adminMiddleware");
const {
  listPendingEscrowReleases,
  manualReleaseEscrow,
} = require("../controllers/marketplaceAdminController");

/**
 * All routes here require super-admin privileges
 */
router.use(protect);
router.use(adminCheck);

/**
 * Escrow Management Routes
 */
router.get("/escrow/pending", listPendingEscrowReleases);
router.post("/escrow/:orderId/release", manualReleaseEscrow);

module.exports = router;
