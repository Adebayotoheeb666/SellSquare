const { expireStaleHolds } = require("../services/marketplace/inventoryHoldService");
const { HOLD_SWEEP_INTERVAL_MINUTES } = require("../services/marketplace/constants");

let intervalRef = null;

const runHoldExpirySweep = async () => {
  try {
    const result = await expireStaleHolds();
    return {
      matched: result.matchedCount || 0,
      modified: result.modifiedCount || 0,
    };
  } catch (error) {
    return {
      matched: 0,
      modified: 0,
      error: error.message,
    };
  }
};

const startMarketplaceHoldExpiryJob = () => {
  if (intervalRef) return intervalRef;

  const intervalMs = HOLD_SWEEP_INTERVAL_MINUTES * 60 * 1000;
  intervalRef = setInterval(runHoldExpirySweep, intervalMs);

  if (intervalRef.unref) {
    intervalRef.unref();
  }

  return intervalRef;
};

module.exports = {
  startMarketplaceHoldExpiryJob,
  runHoldExpirySweep,
};
