const ORDER_STATUS_FLOW = {
  placed: ["payment_confirmed"],
  payment_confirmed: ["accepted", "rejected"],
  accepted: ["processing"],
  rejected: [],
  processing: ["shipped"],
  shipped: ["delivered"],
  delivered: [],
};

const HOLD_DURATION_MINUTES = 45; // Partner order holds
const CART_HOLD_DURATION_MINUTES = 5; // Buyer cart holds
const HOLD_SWEEP_INTERVAL_MINUTES = 15;

module.exports = {
  ORDER_STATUS_FLOW,
  HOLD_DURATION_MINUTES,
  CART_HOLD_DURATION_MINUTES,
  HOLD_SWEEP_INTERVAL_MINUTES,
};
