const express = require("express");
const router = express.Router();
const { protectBuyer } = require("../middleWare/buyerAuthMiddleware");
const {
  getBalance,
  getTransactions,
  requestWithdrawal,
} = require("../controllers/buyerWalletController");

/**
 * Get Buyer Wallet Balance
 * GET /api/buyer/wallet/balance
 */
router.get("/balance", protectBuyer, getBalance);

/**
 * Get Buyer Wallet Transactions
 * GET /api/buyer/wallet/transactions?page=1&limit=20
 */
router.get("/transactions", protectBuyer, getTransactions);

/**
 * Request Withdrawal
 * POST /api/buyer/wallet/withdraw
 * Body: { amount, bankName, accountNumber, accountName }
 */
router.post("/withdraw", protectBuyer, requestWithdrawal);

module.exports = router;
