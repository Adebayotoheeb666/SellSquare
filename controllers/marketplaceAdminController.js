const asyncHandler = require("express-async-handler");
const InternalMarketplaceOrder = require("../models/internalMarketplaceOrderModel");
const { releaseFundsToBusiness } = require("../services/marketplace/escrowReleaseService");

/**
 * List Pending Escrow Releases
 * [requires `protect` + admin check]
 * Returns orders that are ready for manual or automatic fund release.
 */
const listPendingEscrowReleases = asyncHandler(async (req, res) => {
  const { status = "received", page = 1, limit = 20 } = req.query;
  const skip = (parseInt(page) - 1) * parseInt(limit);

  // Ready for release if status is 'received' or 'delivered'
  const query = {
    status: { $in: ["received", "delivered"] },
  };

  if (status && status !== "all") {
    query.status = status;
  }

  const total = await InternalMarketplaceOrder.countDocuments(query);
  const orders = await InternalMarketplaceOrder.find(query)
    .populate("business", "businessName email")
    .populate("buyer", "firstName lastName email")
    .populate("escrowEntryId")
    .skip(skip)
    .limit(parseInt(limit))
    .sort({ deliveredAt: -1, receivedAt: -1 });

  res.status(200).json({
    message: "Pending escrow releases retrieved successfully",
    data: orders,
    pagination: {
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      pages: Math.ceil(total / parseInt(limit)),
    },
  });
});

/**
 * Manually Release Escrow Funds
 * [requires `protect` + admin check]
 */
const manualReleaseEscrow = asyncHandler(async (req, res) => {
  const { orderId } = req.params;
  const adminId = req.user._id;

  try {
    const result = await releaseFundsToBusiness(orderId, adminId.toString());
    res.status(200).json({
      message: "Funds released to business successfully",
      data: result,
    });
  } catch (error) {
    res.status(400);
    throw new Error(error.message);
  }
});

module.exports = {
  listPendingEscrowReleases,
  manualReleaseEscrow,
};
