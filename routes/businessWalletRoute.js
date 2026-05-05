const express = require("express");
const router = express.Router();
const protect = require("../middleWare/authMiddleware");
const {
  getBalance,
  getTransactions,
  requestWithdrawal,
} = require("../controllers/businessWalletController");

/**
 * Get Business Wallet Balance
 * GET /api/marketplace/wallet/balance
 */
router.get("/balance", protect, getBalance);

/**
 * Get Business Wallet Transactions
 * GET /api/marketplace/wallet/transactions?page=1&limit=20
 */
router.get("/transactions", protect, getTransactions);

/**
 * Request Withdrawal
 * POST /api/marketplace/wallet/withdraw
 * Body: { amount, bankName, accountNumber, accountName }
 */
router.post("/withdraw", protect, requestWithdrawal);

module.exports = router;
