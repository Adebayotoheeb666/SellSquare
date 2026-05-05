const express = require("express");
const router = express.Router();
const protect = require("../middleWare/authMiddleware");
const { cartEventMiddleware, saleEventMiddleware } = require("../events");
const {
  addToCart,
  getCart,
  getCheckOuts,
  getAllCheckOuts,
  getCheckoutYears,
  increaseCartItems,
  checkoutCart,
  decreaseCartitems,
  deleteCartItem,
  generateReceipt,
  sendReceipt,
  sendReceiptToPrinter,
  setCartQuantity,
  setPrice,
  returnItemSold,
  getCustomers,
  getIncompletePayments,
  updateIncompletePayment,
  updateDeliveryStatus,
  // updateOrderIds,
} = require("../controllers/cartController");

// Remove 'protect' middleware from add-to-cart to allow guests
router.post("/add-to-cart/:id", cartEventMiddleware, addToCart);
router.get("/getcart/:email", protect, getCart);
router.get("/getcheckouts", protect, getCheckOuts);
router.get("/getallcheckouts", protect, getAllCheckOuts);
router.get("/checkout-years", protect, getCheckoutYears);
router.get("/download-receipt/:id", protect, generateReceipt);
router.post("/increase", protect, cartEventMiddleware, increaseCartItems);
router.post("/set-quantity", protect, cartEventMiddleware, setCartQuantity);
router.post("/set-price", protect, cartEventMiddleware, setPrice);
router.post("/decrease", protect, cartEventMiddleware, decreaseCartitems);
router.post("/checkout", protect, saleEventMiddleware, checkoutCart);
router.delete(
  "/delete-cart-item/:id",
  protect,
  cartEventMiddleware,
  deleteCartItem,
);
router.post("/send-receipt/:id", protect, sendReceipt);
router.get("/print-receipt/:id", protect, sendReceiptToPrinter);
router.post(
  "/returned-goods/:id",
  protect,
  saleEventMiddleware,
  returnItemSold,
);
router.get("/get-customers", protect, getCustomers);
router.get("/get-incomplete-payments", protect, getIncompletePayments);
router.post("/update-incomplete-payment", protect, updateIncompletePayment);
router.post("/update-delivery-status", protect, updateDeliveryStatus);
// router.post("/update-order-ids", protect, updateOrderIds);

module.exports = router;
