const InternalMarketplaceOrder = require("../../models/internalMarketplaceOrderModel");
const EscrowEntry = require("../../models/escrowEntryModel");
const BusinessWallet = require("../../models/businessWalletModel");
const BuyerWallet = require("../../models/buyerWalletModel");
const { eventBus } = require("../../events/EventEmitter");

/**
 * Release funds for an internal marketplace order from escrow to the business wallet.
 * @param {string} orderId - The ID of the order to release funds for.
 * @param {string} releasedBy - ID of the admin or system that triggered the release.
 * @returns {Promise<object>} - Result of the release operation.
 */
const releaseFundsToBusiness = async (orderId, releasedBy = "system") => {
  const order = await InternalMarketplaceOrder.findById(orderId)
    .populate("business")
    .populate("escrowEntryId");

  if (!order) {
    throw new Error("Order not found");
  }

  const escrowEntry = order.escrowEntryId;
  if (!escrowEntry) {
    throw new Error("Escrow entry not found for this order");
  }

  if (escrowEntry.status !== "held") {
    throw new Error(`Escrow is already in status: ${escrowEntry.status}`);
  }

  // 1. Update Escrow Status
  escrowEntry.status = "released_to_business";
  escrowEntry.settledAt = new Date();
  await escrowEntry.save();

  // 2. Credit Business Wallet
  let wallet = await BusinessWallet.findOne({ business: order.business._id });
  if (!wallet) {
    wallet = await BusinessWallet.create({
      business: order.business._id,
      balance: 0,
      escrowBalance: 0,
      currency: "NGN",
    });
  }

  wallet.balance += escrowEntry.amount;
  wallet.escrowBalance = Math.max(0, (wallet.escrowBalance || 0) - escrowEntry.amount);
  wallet.transactions.push({
    type: "credit",
    amount: escrowEntry.amount,
    reason: `Managed Release: Order ${order.orderNumber}`,
    reference: order._id.toString(),
    relatedOrder: order._id,
    createdAt: new Date(),
  });
  await wallet.save();

  // 3. Update Buyer Wallet Escrow Balance
  await BuyerWallet.findOneAndUpdate(
    { buyer: order.buyer },
    { $inc: { escrowBalance: -escrowEntry.amount } }
  );

  // 3. Update Order Status History (if not already handled)
  order.statusHistory.push({
    from: order.status,
    to: order.status,
    by: releasedBy,
    reason: "Escrow funds released to business wallet",
    at: new Date(),
  });
  await order.save();

  // 4. Emit Events
  eventBus.emitBusinessEvent("wallet.credited", order.business._id.toString(), {
    amount: escrowEntry.amount,
    currency: wallet.currency,
    reason: `Funds released for order ${order.orderNumber}`,
    reference: order._id.toString(),
  });

  return {
    success: true,
    orderId: order._id,
    amount: escrowEntry.amount,
    businessId: order.business._id,
  };
};

module.exports = {
  releaseFundsToBusiness,
};
