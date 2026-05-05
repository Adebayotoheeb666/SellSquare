const asyncHandler = require("express-async-handler");
const axios = require("axios");
const BusinessWallet = require("../models/businessWalletModel");
const { eventBus } = require("../events/EventEmitter");
const { validateBankDetails } = require("../utils/flutterwaveHelpers");



/**
 * Get Business Wallet Balance
 * [requires `protect`]
 * Returns the current balance and currency
 */
const getBalance = asyncHandler(async (req, res) => {
  const business = req.business;

  let wallet = await BusinessWallet.findOne({ business: business._id });

  // Create wallet if it doesn't exist
  if (!wallet) {
    wallet = await BusinessWallet.create({
      business: business._id,
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
 * Get Business Wallet Transactions
 * [requires `protect`]
 * Returns paginated transaction history
 */
const getTransactions = asyncHandler(async (req, res) => {
  const business = req.business;
  const { page = 1, limit = 20 } = req.query;

  const skip = (parseInt(page) - 1) * parseInt(limit);

  let wallet = await BusinessWallet.findOne({ business: business._id });

  // Create wallet if it doesn't exist
  if (!wallet) {
    wallet = await BusinessWallet.create({
      business: business._id,
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
 * [requires `protect`]
 * Business requests a withdrawal to their bank account
 * Initiates actual bank transfer via Flutterwave
 */
const requestWithdrawal = asyncHandler(async (req, res) => {
  const business = req.business;
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

  let wallet = await BusinessWallet.findOne({ business: business._id });

  // Create wallet if it doesn't exist
  if (!wallet) {
    wallet = await BusinessWallet.create({
      business: business._id,
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
    businessId: business._id.toString(),
    amount,
    bankCode,
    accountNumber,
    accountName,
    currency: wallet.currency,
  }).catch((error) => {
    console.error("Flutterwave transfer failed for withdrawal:", error);
    // In production, should notify business via email of failed withdrawal
    // and potentially rollback the wallet deduction with an admin process
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
 * Attempts to transfer funds to the business's bank account
 * Called asynchronously after wallet deduction
 */
async function initiateFlutterwaveTransfer({
  businessId,
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
        reference: `WITHDRAWAL-BUSINESS-${businessId}-${Date.now()}`,
        debit_currency: currency || "NGN",
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.FLUTTERWAVE_SECRET_KEY}`,
        },
      }
    );

    if (transferResponse.data.status === "success") {
      console.log(`Transfer initiated successfully for business ${businessId}`, {
        transferId: transferResponse.data.data.id,
        reference: transferResponse.data.data.reference,
      });
      // TODO: Webhook handler will update transaction status when transfer completes
      // TODO: Emit event to business
    }
  } catch (error) {
    console.error(`Withdrawal transfer failed for business ${businessId}:`, error.message);
    // In production, this should:
    // 1. Log the error with business and amount details
    // 2. Send email to business notifying of failed transfer
    // 3. Create an admin task to manually investigate
  }
}

module.exports = {
  getBalance,
  getTransactions,
  requestWithdrawal,
};
