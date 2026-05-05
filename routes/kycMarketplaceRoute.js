const express = require("express");
const router = express.Router();
const protect = require("../middleWare/authMiddleware");
const adminMiddleware = require("../middleWare/adminMiddleware");
const { kycEventMiddleware } = require("../events");
const { upload } = require("../utils/fileUpload");
const {
  submitKYC,
  getKYCStatus,
  listKYCs,
  getKYCForBusiness,
  approveKYC,
  rejectKYC,
  generateStoreToken,
} = require("../controllers/kycMarketplaceController");

/**
 * Business KYC Routes
 * These routes handle marketplace KYC submission and admin approval
 */

// Business-scoped routes (no admin required)
router.post(
  "/submit",
  protect,
  upload.fields([
    { name: "ownerIdDocument", maxCount: 1 },
    { name: "businessRegDocument", maxCount: 1 },
  ]),
  kycEventMiddleware,
  submitKYC,
);
router.get("/status", protect, getKYCStatus);
router.post("/generate-store-token", protect, generateStoreToken);

// Admin-scoped routes (requires admin middleware)
router.get("/admin/list", protect, adminMiddleware, listKYCs);
router.get("/admin/business/:businessId", protect, adminMiddleware, getKYCForBusiness);
router.post("/admin/business/:businessId/approve", protect, adminMiddleware, kycEventMiddleware, approveKYC);
router.post("/admin/business/:businessId/reject", protect, adminMiddleware, kycEventMiddleware, rejectKYC);

module.exports = router;
