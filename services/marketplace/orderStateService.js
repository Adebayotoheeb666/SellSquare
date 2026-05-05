const { ORDER_STATUS_FLOW } = require("./constants");

const canTransitionOrderStatus = ({ from, to }) => {
  const nextAllowed = ORDER_STATUS_FLOW[from] || [];
  return nextAllowed.includes(to);
};

const assertValidOrderTransition = ({ from, to }) => {
  if (!canTransitionOrderStatus({ from, to })) {
    const error = new Error(`Invalid marketplace order transition: ${from} -> ${to}`);
    error.code = "INVALID_ORDER_STATUS_TRANSITION";
    error.statusCode = 409;
    throw error;
  }
};

const normalizeLineDecision = ({ requestedQty, acceptedQty, rejectedQty }) => {
  const requested = Number(requestedQty) || 0;
  const accepted = Math.max(0, Number(acceptedQty) || 0);
  const rejected = Math.max(0, Number(rejectedQty) || 0);
  const totalDecision = accepted + rejected;

  if (requested <= 0) {
    return {
      acceptedQty: 0,
      rejectedQty: 0,
      lineStatus: "rejected",
    };
  }

  if (totalDecision > requested) {
    const error = new Error("Accepted + rejected quantity cannot exceed requested quantity");
    error.code = "INVALID_LINE_DECISION_QUANTITY";
    error.statusCode = 400;
    throw error;
  }

  if (accepted === requested) {
    return {
      acceptedQty: accepted,
      rejectedQty: 0,
      lineStatus: "accepted",
    };
  }

  if (accepted === 0 && rejected === requested) {
    return {
      acceptedQty: 0,
      rejectedQty: rejected,
      lineStatus: "rejected",
    };
  }

  if (accepted > 0 || rejected > 0) {
    return {
      acceptedQty: accepted,
      rejectedQty: rejected,
      lineStatus: "partially_accepted",
    };
  }

  return {
    acceptedQty: 0,
    rejectedQty: 0,
    lineStatus: "pending",
  };
};

module.exports = {
  canTransitionOrderStatus,
  assertValidOrderTransition,
  normalizeLineDecision,
};
