const asyncHandler = require("express-async-handler");
const InternalMarketplaceOrder = require("../models/internalMarketplaceOrderModel");
const EscrowEntry = require("../models/escrowEntryModel");
const BusinessWallet = require("../models/businessWalletModel");
const BuyerWallet = require("../models/buyerWalletModel");
const Business = require("../models/businessRegistration");
const { eventBus } = require("../events/EventEmitter");
const {
  releaseOrderHolds,
  finalizeAcceptedOrderHolds,
} = require("../services/marketplace/inventoryHoldService");
const {
  normalizeLineDecision,
  assertValidOrderTransition,
} = require("../services/marketplace/orderStateService");



/**
 * List Internal Orders for Business
 * [requires `protect`]
 * Returns all marketplace orders received by this business
 */
const listInternalOrders = asyncHandler(async (req, res) => {
  const business = req.business;
  const { status, page = 1, limit = 20 } = req.query;

  const skip = (parseInt(page) - 1) * parseInt(limit);

  const query = { business: business._id };

  // Optional status filter
  if (status && status.trim()) {
    query.status = status.trim();
  }

  // Get total count
  const total = await InternalMarketplaceOrder.countDocuments(query);

  // Get orders with pagination
  const orders = await InternalMarketplaceOrder.find(query)
    .populate("buyer", "firstName lastName email")
    .populate("escrowEntryId", "amount status")
    .skip(skip)
    .limit(parseInt(limit))
    .sort({ createdAt: -1 });

  res.status(200).json({
    message: "Orders retrieved successfully",
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
 * Get Single Internal Order
 * [requires `protect`]
 * Returns detailed information about a specific order
 */
const getInternalOrder = asyncHandler(async (req, res) => {
  const business = req.business;
  const { orderId } = req.params;

  const order = await InternalMarketplaceOrder.findOne({
    _id: orderId,
    business: business._id,
  })
    .populate("buyer", "firstName lastName email phone")
    .populate("escrowEntryId");

  if (!order) {
    res.status(404);
    throw new Error("Order not found");
  }

  res.status(200).json({
    message: "Order detail retrieved successfully",
    data: order,
  });
});

/**
 * Decide on Internal Order (Accept/Reject with per-line support)
 * [requires `protect`]
 * Business accepts or rejects the order with per-line granularity
 *
 * Supports two modes:
 * 1. Full-order decision (legacy): { decision: "accepted"|"rejected", reason?: string }
 * 2. Per-line decisions (new): { decisions: [{ lineId, acceptedQty, rejectedQty, reason }] }
 */
const decideInternalOrder = asyncHandler(async (req, res) => {
  const business = req.business;
  const { orderId } = req.params;
  const { decision, reason, decisions } = req.body;

  // Find order
  const order = await InternalMarketplaceOrder.findOne({
    _id: orderId,
    business: business._id,
  })
    .populate("buyer")
    .populate("escrowEntryId");

  if (!order) {
    res.status(404);
    throw new Error("Order not found");
  }

  // Verify order status is payment_confirmed
  if (order.status !== "payment_confirmed") {
    res.status(400);
    throw new Error(`Cannot decide on order with status: ${order.status}`);
  }

  const escrowEntry = order.escrowEntryId;
  if (!escrowEntry) {
    res.status(400);
    throw new Error("Escrow entry not found for this order");
  }

  // Determine if using per-line or full-order mode
  const isPerLineMode = Array.isArray(decisions) && decisions.length > 0;

  if (isPerLineMode) {
    // PER-LINE MODE: Process individual line decisions
    for (const lineDecision of decisions) {
      const line = order.lines.find((entry) => entry._id.toString() === lineDecision.lineId);
      if (!line) continue;

      const normalized = normalizeLineDecision({
        requestedQty: line.requestedQty,
        acceptedQty: lineDecision.acceptedQty,
        rejectedQty: lineDecision.rejectedQty,
      });

      line.acceptedQty = normalized.acceptedQty;
      line.rejectedQty = normalized.rejectedQty;
      line.lineStatus = normalized.lineStatus;
      line.decisionReason = lineDecision.reason || line.decisionReason || "";
    }

    // Calculate accepted and rejected lines
    const acceptedLines = order.lines.filter(
      (line) => line.lineStatus === "accepted" || line.lineStatus === "partially_accepted"
    );
    const rejectedLines = order.lines.filter((line) => line.lineStatus === "rejected");

    // Determine overall order status based on line decisions
    if (acceptedLines.length > 0) {
      // At least one line accepted: process as partial/full acceptance
      assertValidOrderTransition({ from: order.status, to: "accepted" });
      order.status = "accepted";
      order.statusHistory.push({
        from: "payment_confirmed",
        to: "accepted",
        by: business._id.toString(),
        reason: "Per-line decisions: some lines accepted",
        at: new Date(),
      });

      // Process payment for accepted lines
      await processAcceptedOrder(order, escrowEntry, business);
    } else {
      // All lines rejected: reject order and refund
      assertValidOrderTransition({ from: order.status, to: "rejected" });
      order.status = "rejected";
      order.rejectionReason = "All lines rejected";
      order.statusHistory.push({
        from: "payment_confirmed",
        to: "rejected",
        by: business._id.toString(),
        reason: "All lines rejected",
        at: new Date(),
      });

      // Process refund for rejected order
      await processRejectedOrder(order, escrowEntry);
    }

    order.buyer_notified_at = new Date();
    await order.save();

    // Emit events
    if (order.status === "accepted") {
      eventBus.emitBuyerEvent("marketplace.internal_order.accepted", order.buyer._id.toString(), {
        orderId: order._id.toString(),
        orderNumber: order.orderNumber,
        businessName: business.businessName,
        amount: escrowEntry.amount,
        acceptedLines: acceptedLines.length,
        rejectedLines: rejectedLines.length,
      });
    } else {
      eventBus.emitBuyerEvent("marketplace.internal_order.rejected", order.buyer._id.toString(), {
        orderId: order._id.toString(),
        orderNumber: order.orderNumber,
        businessName: business.businessName,
        amount: escrowEntry.amount,
        reason: "All lines rejected",
      });
    }

    res.status(200).json({
      message: "Per-line decisions processed successfully",
      data: order,
    });
  } else {
    // FULL-ORDER MODE (LEGACY): Accept or reject entire order
    if (!decision || !["accepted", "rejected"].includes(decision)) {
      res.status(400);
      throw new Error("Decision must be 'accepted' or 'rejected'");
    }

    if (decision === "rejected" && !reason) {
      res.status(400);
      throw new Error("Rejection reason is required");
    }

    if (decision === "accepted") {
      // ACCEPT: Release escrow to business, credit business wallet
      order.status = "accepted";

      // Mark all lines as accepted
      order.lines.forEach((line) => {
        line.acceptedQty = line.requestedQty;
        line.rejectedQty = 0;
        line.lineStatus = "accepted";
        line.decisionReason = "";
      });

      order.statusHistory.push({
        from: "payment_confirmed",
        to: "accepted",
        by: business._id.toString(),
        at: new Date(),
      });

      await processAcceptedOrder(order, escrowEntry, business);
      order.buyer_notified_at = new Date();
      await order.save();

      eventBus.emitBuyerEvent("marketplace.internal_order.accepted", order.buyer._id.toString(), {
        orderId: order._id.toString(),
        orderNumber: order.orderNumber,
        businessName: business.businessName,
        amount: escrowEntry.amount,
      });

      res.status(200).json({
        message: "Order accepted successfully",
        data: order,
      });
    } else if (decision === "rejected") {
      // REJECT: Refund escrow to buyer
      order.status = "rejected";
      order.rejectionReason = reason;

      // Mark all lines as rejected
      order.lines.forEach((line) => {
        line.acceptedQty = 0;
        line.rejectedQty = line.requestedQty;
        line.lineStatus = "rejected";
        line.decisionReason = reason;
      });

      order.statusHistory.push({
        from: "payment_confirmed",
        to: "rejected",
        by: business._id.toString(),
        reason,
        at: new Date(),
      });

      await processRejectedOrder(order, escrowEntry);
      order.buyer_notified_at = new Date();
      await order.save();

      eventBus.emitBuyerEvent("marketplace.internal_order.rejected", order.buyer._id.toString(), {
        orderId: order._id.toString(),
        orderNumber: order.orderNumber,
        businessName: business.businessName,
        amount: escrowEntry.amount,
        reason,
      });

      res.status(200).json({
        message: "Order rejected successfully",
        data: order,
      });
    }
  }
});

/**
 * Process accepted order: release escrow and credit business wallet
 */
const processAcceptedOrder = async (order, escrowEntry, business) => {
  // NOTE: Funds are no longer released to the business immediately upon acceptance.
  // Funds are now held until the buyer confirms receipt or a 24-hour auto-release period passes.
  
  // Finalize inventory after business acceptance:
  // convert reserved holds into actual stock deductions and release hold qty.
  await finalizeAcceptedOrderHolds({
    orderId: order._id,
    reason: "order_accepted",
  });
};

/**
 * Process rejected order: refund escrow to buyer
 */
const processRejectedOrder = async (order, escrowEntry) => {
  // Update escrow
  escrowEntry.status = "refunded_to_buyer";
  escrowEntry.settledAt = new Date();
  await escrowEntry.save();

  // Create or find buyer wallet
  let buyerWallet = await BuyerWallet.findOne({ buyer: order.buyer._id });
  if (!buyerWallet) {
    buyerWallet = await BuyerWallet.create({
      buyer: order.buyer._id,
      balance: 0,
      currency: "NGN",
    });
  }

  // Credit buyer wallet with refund
  buyerWallet.balance += escrowEntry.amount;
  buyerWallet.transactions.push({
    type: "credit",
    amount: escrowEntry.amount,
    reason: `Order rejected: ${order.rejectionReason || "Rejected by seller"}`,
    reference: order._id.toString(),
    relatedOrder: order._id,
    createdAt: new Date(),
  });
  await buyerWallet.save();

  // Emit wallet credited event to buyer
  eventBus.emitBuyerEvent("wallet.credited", order.buyer._id.toString(), {
    amount: escrowEntry.amount,
    currency: buyerWallet.currency,
    reason: `Order rejected: ${order.rejectionReason || "Rejected by seller"}`,
    reference: order._id.toString(),
  });

  // Release any remaining holds (fallback safety measure)
  try {
    await releaseOrderHolds({ orderId: order._id, reason: "order_rejected" });
  } catch (error) {
    console.error("Error releasing holds for rejected order:", error);
  }
};

/**
 * Update Order Status
 * [requires `protect`]
 * Advances order status: accepted → processing → shipped → delivered
 */
const updateOrderStatus = asyncHandler(async (req, res) => {
  const business = req.business;
  const { orderId } = req.params;
  const { newStatus } = req.body;

  // Validation
  const validStatuses = ["processing", "shipped", "delivered"];
  if (!newStatus || !validStatuses.includes(newStatus)) {
    res.status(400);
    throw new Error(`New status must be one of: ${validStatuses.join(", ")}`);
  }

  const order = await InternalMarketplaceOrder.findOne({
    _id: orderId,
    business: business._id,
  });

  if (!order) {
    res.status(404);
    throw new Error("Order not found");
  }

  // Verify order is already in the fulfillment progression
  const statusProgression = ["accepted", "processing", "shipped", "delivered"];
  const currentIndex = statusProgression.indexOf(order.status);
  const newIndex = statusProgression.indexOf(newStatus);

  if (currentIndex === -1) {
    res.status(400);
    throw new Error("Order must be accepted before updating fulfillment status");
  }

  if (newIndex <= currentIndex) {
    res.status(400);
    throw new Error(`Cannot move status backwards. Current: ${order.status}, Requested: ${newStatus}`);
  }

  // Update status
  const previousStatus = order.status;
  order.status = newStatus;

  // Push to status history
  order.statusHistory.push({
    from: previousStatus,
    to: newStatus,
    by: business._id.toString(),
    at: new Date(),
  });

  await order.save();

  // Finalize inventory when order is delivered
  if (newStatus === "delivered") {
    order.deliveredAt = new Date();
    await finalizeAcceptedOrderHolds({
      orderId: order._id,
      reason: "order_delivered",
    });
  }

  // Emit event
  eventBus.emitBusinessEvent("marketplace.internal_order.status_updated", business._id.toString(), {
    orderId: order._id.toString(),
    orderNumber: order.orderNumber,
    oldStatus: previousStatus,
    newStatus: newStatus,
    buyerId: order.buyer._id.toString(),
  });

  res.status(200).json({
    message: `Order status updated to ${newStatus}`,
    data: order,
  });
});

/**
 * Confirm Order Receipt (Buyer only)
 * [requires `protectBuyer`]
 * Buyer confirms they have received the order.
 */
const confirmReceipt = asyncHandler(async (req, res) => {
  const buyer = req.buyer;
  const { orderId } = req.params;

  const order = await InternalMarketplaceOrder.findOne({
    _id: orderId,
    buyer: buyer._id,
  });

  if (!order) {
    res.status(404);
    throw new Error("Order not found");
  }

  if (order.status !== "delivered") {
    res.status(400);
    throw new Error(`Order must be 'delivered' before it can be confirmed. Current status: ${order.status}`);
  }

  const previousStatus = order.status;
  order.status = "received";
  order.receivedAt = new Date();

  order.statusHistory.push({
    from: previousStatus,
    to: "received",
    by: buyer._id.toString(),
    at: new Date(),
  });

  await order.save();

  // Emit event for business and admin to see
  eventBus.emitBusinessEvent("marketplace.internal_order.received", order.business.toString(), {
    orderId: order._id.toString(),
    orderNumber: order.orderNumber,
    buyerId: buyer._id.toString(),
  });

  res.status(200).json({
    message: "Order receipt confirmed successfully",
    data: order,
  });
});

module.exports = {
  listInternalOrders,
  getInternalOrder,
  decideInternalOrder,
  updateOrderStatus,
  confirmReceipt,
};
