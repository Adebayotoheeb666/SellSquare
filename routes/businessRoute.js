const express = require("express");
const router = express.Router();
const protect = require("../middleWare/authMiddleware");
const { businessEventMiddleware, kycEventMiddleware } = require("../events");

const { upload } = require("../utils/fileUpload");
const {
  registerBusiness,
  loginToBusiness,
  logout,
  getBusiness,
  loginStatus,
  updateBusiness,
  changePassword,
  forgotPassword,
  resetPassword,
  addNewSales,
  deleteSalesRep,
  updateSalesRep,
  subscribe,
  getAllBusiness,
  verifySendGrid,
  sendReceiptEmail,
  shareReceipt,
  activateActivityStatus,
  getAllBusinessActivities,
  updateSubscriptionPlan,
  sendAdminBusinessMessage,
  cleanupActivities,
  getConnectedStores,
  connectStore,
  registerAndConnectStore,
  switchBusiness,
  disconnectStore,
} = require("../controllers/businessController");
const {
  submitKYC,
  getKYCStatus,
  getAllKYCsForVerification,
  verifyKYC,
} = require("../controllers/kycController");


router.post("/register", upload.single("image"), registerBusiness);
router.post("/login", loginToBusiness);
router.post("/add-sales", protect, businessEventMiddleware, addNewSales);
router.post("/delete-sales", protect, businessEventMiddleware, deleteSalesRep);
router.get("/logout", logout);
router.get("/getbusiness", protect, getBusiness);
router.get("/loggedin", loginStatus);
router.patch(
  "/updatebusiness",
  protect,
  businessEventMiddleware,
  updateBusiness,
);
router.patch(
  "/update-sales-rep",
  protect,
  businessEventMiddleware,
  updateSalesRep,
);
router.patch("/changepassword", protect, changePassword);
router.post("/forgotpassword", forgotPassword);
router.put("/resetpassword/:resetToken", resetPassword);
router.patch("/subscribe", protect, businessEventMiddleware, subscribe);
router.get("/get-all-business", protect, getAllBusiness);
router.post("/verify-send-grid", protect, verifySendGrid);
router.post("/send-receipt-email", protect, sendReceiptEmail);
router.get("/share-receipt", protect, shareReceipt);
// Removed: activities now auto-activate for Standard/Professional plans
router.get("/get-all-activities", protect, getAllBusinessActivities);
router.post(
  "/update-subscription-plan/:businessId",
  protect,
  businessEventMiddleware,
  updateSubscriptionPlan,
);
router.post(
  "/admin/send-business-message",
  protect,
  businessEventMiddleware,
  sendAdminBusinessMessage,
);
router.post("/cleanup-activities", protect, cleanupActivities); // Manual cleanup endpoint

// Store management routes
// NOTE: No businessEventMiddleware here — store management responses
// are not business-shaped, so the event middleware would emit corrupted
// BUSINESS_UPDATED events that overwrite Redux state.
router.get("/stores", protect, getConnectedStores);
router.post("/stores/connect", protect, connectStore);
router.post("/stores/register", protect, registerAndConnectStore);
router.post("/stores/switch", protect, switchBusiness);
router.post("/stores/disconnect", protect, disconnectStore);

module.exports = router;
