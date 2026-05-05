const express = require("express");
const router = express.Router();
const protect = require("../middleWare/authMiddleware");
const {
  productEventMiddleware,
  productGroupEventMiddleware,
} = require("../events");
const {
  createProduct,
  getProducts,
  getProductsBulk,
  getProductsCursor,
  getFilterOptions,
  getProduct,
  deleteProduct,
  updateProduct,
  sellProduct,
  getTopSellingProducts,
  getSales,
  getSale,
  getOutOfStock,
  getLowProducts,
  getSalesByYear,
  createMultipleProducts,
  updateProductGroup,
  getProductGroups,
  deleteProductGroup,
  getDashboardStats,
  batchDeleteProducts,
  batchToggleProducts,
  batchDeleteGroups,
  updateGroupListingOptions,
  // getDraft,
  // saveDraft,
} = require("../controllers/productController");
const { upload } = require("../utils/fileUpload");

// Apply event middleware to mutation routes for realtime updates
router.post("/", protect, upload.any(), productEventMiddleware, createProduct);
router.post(
  "/multiple",
  protect,
  upload.any(),
  productGroupEventMiddleware,
  createMultipleProducts,
);
router.post("/sellproduct/:id", protect, productEventMiddleware, sellProduct);
router.patch(
  "/:id",
  protect,
  upload.any(),
  productEventMiddleware,
  updateProduct,
);
router.patch(
  "/update-product-group/:id",
  protect,
  upload.any(),
  productGroupEventMiddleware,
  updateProductGroup,
);
router.patch(
  "/group-listing-options/:id",
  protect,
  productGroupEventMiddleware,
  updateGroupListingOptions,
);
router.get("/", protect, getProducts);
router.get("/bulk", protect, getProductsBulk); // Bulk fetch for client-side pagination
router.get("/cursor", protect, getProductsCursor); // Cursor-based pagination endpoint
router.get("/filter-options", protect, getFilterOptions);
router.get("/dashboard-stats", protect, getDashboardStats);
router.get("/product-group", protect, getProductGroups);
router.get("/getsales", protect, getSales);
router.get("/outofstock", protect, getOutOfStock);
router.get("/getsale/:id", protect, getSale);
router.get("/getsale/:id", protect, getSale);
router.get("/top-products", protect, getTopSellingProducts);
router.get("/low-products", protect, getLowProducts);
router.get("/sales-by-year/:id", protect, getSalesByYear);
router.get("/:id", protect, getProduct);
router.post("/batch-delete", protect, productEventMiddleware, batchDeleteProducts);
router.post("/batch-delete-groups", protect, productGroupEventMiddleware, batchDeleteGroups);
router.post("/batch-toggle", protect, productEventMiddleware, batchToggleProducts);
router.delete("/:id", protect, productEventMiddleware, deleteProduct);
router.delete(
  "/group/:id",
  protect,
  productGroupEventMiddleware,
  deleteProductGroup,
);
// router.post("/save-draft", protect, saveDraft);
// router.get("/get-draft", protect, getDraft);

module.exports = router;
