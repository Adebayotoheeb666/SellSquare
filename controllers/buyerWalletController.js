const asyncHandler = require("express-async-handler");
const axios = require("axios");
const BuyerWallet = require("../models/buyerWalletModel");
const { eventBus } = require("../events/EventEmitter");
const { validateBankDetails } = require("../utils/flutterwaveHelpers");

/**
 * Get Buyer Wallet Balance
 * [requires `protectBuyer`]
 * Returns the current balance and currency
 */
const getBalance = asyncHandler(async (req, res) => {
  const buyer = req.buyer;

  let wallet = await BuyerWallet.findOne({ buyer: buyer._id });

  // Create wallet if it doesn't exist
  if (!wallet) {
    wallet = await BuyerWallet.create({
      buyer: buyer._id,
      balance: 0,
      currency: "NGN",
      transactions: [],
    });
  }

  res.status(200).json({
    message: "Wallet balance retrieved successfully",
    data: {
      balance: wallet.balance,
      currency: wallet.currency,
    },
  });
});

/**
 * Get Buyer Wallet Transactions
 * [requires `protectBuyer`]
 * Returns paginated transaction history
 */
const getTransactions = asyncHandler(async (req, res) => {
  const buyer = req.buyer;
  const { page = 1, limit = 20 } = req.query;

  const skip = (parseInt(page) - 1) * parseInt(limit);

  let wallet = await BuyerWallet.findOne({ buyer: buyer._id });

  // Create wallet if it doesn't exist
  if (!wallet) {
    wallet = await BuyerWallet.create({
      buyer: buyer._id,
      balance: 0,
      currency: "NGN",
      transactions: [],
    });
  }

  // Paginate transactions
  const totalTransactions = wallet.transactions.length;
  const transactions = wallet.transactions
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(skip, skip + parseInt(limit));

  res.status(200).json({
    message: "Transactions retrieved successfully",
    data: transactions,
    pagination: {
      total: totalTransactions,
      page: parseInt(page),
      limit: parseInt(limit),
      pages: Math.ceil(totalTransactions / parseInt(limit)),
    },
  });
});

/**
 * Request Withdrawal
 * [requires `protectBuyer`]
 * Buyer requests a withdrawal to their bank account
 */
const requestWithdrawal = asyncHandler(async (req, res) => {
  const buyer = req.buyer;
  const { amount, bankCode, accountNumber, accountName } = req.body;

  // Validation
  if (!amount || amount <= 0) {
    res.status(400);
    throw new Error("Amount must be greater than 0");
  }

  // Validate bank details
  const validation = validateBankDetails(bankCode, accountNumber, accountName);
  if (!validation.isValid) {
    res.status(400);
    throw new Error(validation.error);
  }

  let wallet = await BuyerWallet.findOne({ buyer: buyer._id });

  // Create wallet if it doesn't exist
  if (!wallet) {
    wallet = await BuyerWallet.create({
      buyer: buyer._id,
      balance: 0,
      currency: "NGN",
      transactions: [],
    });
  }

  // Check balance
  if (amount > wallet.balance) {
    res.status(400);
    throw new Error(`Insufficient balance. Available: ${wallet.currency} ${wallet.balance}`);
  }

  // Deduct from wallet
  wallet.balance -= amount;

  // Add withdrawal transaction
  wallet.transactions.push({
    type: "debit",
    amount,
    reason: "Withdrawal request",
    reference: `${accountNumber}`,
    status: "pending",
    createdAt: new Date(),
  });

  await wallet.save();

  // Initiate Flutterwave transfer
  initiateFlutterwaveTransfer({
    buyerId: buyer._id.toString(),
    amount,
    bankCode,
    accountNumber,
    accountName,
    currency: wallet.currency,
  }).catch((error) => {
    console.error("Flutterwave transfer failed for withdrawal:", error);
    // In production, should notify buyer via email and potentially rollback
  });

  res.status(200).json({
    message: "Withdrawal request submitted successfully",
    data: {
      newBalance: wallet.balance,
      currency: wallet.currency,
      amount,
      status: "processing",
    },
  });
});

/**
 * Initiate Flutterwave Transfer (async helper)
 */
async function initiateFlutterwaveTransfer({
  buyerId,
  amount,
  bankCode,
  accountNumber,
  accountName,
  currency,
}) {
  try {
    // Initiate Flutterwave transfer
    const transferResponse = await axios.post(
      "https://api.flutterwave.com/v3/transfers",
      {
        account_bank: bankCode,
        account_number: accountNumber.trim(),
        amount: amount,
        currency: currency || "NGN",
        beneficiary_name: accountName,
        reference: `WITHDRAWAL-BUYER-${buyerId}-${Date.now()}`,
        debit_currency: currency || "NGN",
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.FLUTTERWAVE_SECRET_KEY}`,
        },
      }
    );

    if (transferResponse.data.status === "success") {
      console.log(`Transfer initiated successfully for buyer ${buyerId}`, {
        transferId: transferResponse.data.data.id,
        reference: transferResponse.data.data.reference,
      });
      // TODO: Webhook handler will update transaction status when transfer completes
    }
  } catch (error) {
    console.error(`Withdrawal transfer failed for buyer ${buyerId}:`, error.message);
    // In production, this should:
    // 1. Log the error with buyer and amount details
    // 2. Send email to buyer notifying of failed transfer
    // 3. Consider automatic rollback of wallet deduction
  }
}

module.exports = {
  getBalance,
  getTransactions,
  requestWithdrawal,
};
