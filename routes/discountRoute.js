const express = require("express");
const router = express.Router();
const {
  createDiscount,
  getDiscounts,
  getDiscount,
  updateDiscount,
  deleteDiscount,
  getProductsForDiscount,
  getGroupsForDiscount,
} = require("../controllers/discountController");
const protect = require("../middleWare/authMiddleware");

// Apply authentication middleware to all routes
router.use(protect);

// Main discount routes
router.post("/", createDiscount);
router.get("/", getDiscounts);
router.get("/products/list", getProductsForDiscount);
router.get("/groups/list", getGroupsForDiscount);
router.get("/:id", getDiscount);
router.put("/:id", updateDiscount);
router.delete("/:id", deleteDiscount);

module.exports = router;
