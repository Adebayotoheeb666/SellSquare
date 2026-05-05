const express = require("express");
const router = express.Router();
const {
  registerBuyer,
  loginBuyer,
  logoutBuyer,
  getBuyerMe,
  startGoogleAuth,
  handleGoogleAuthCallback,
} = require("../controllers/buyerAuthController");
const { protectBuyer } = require("../middleWare/buyerAuthMiddleware");

// Public routes
router.post("/register", registerBuyer);
router.post("/login", loginBuyer);
router.get("/google/start", startGoogleAuth);
router.get("/google/callback", handleGoogleAuthCallback);

// Protected routes
router.post("/logout", protectBuyer, logoutBuyer);
router.get("/me", protectBuyer, getBuyerMe);

module.exports = router;
