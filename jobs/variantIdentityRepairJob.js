const {
  runVariantIdentityRepairSweep,
} = require("../services/variantIdentityRepairService");

let intervalRef = null;
let isRunning = false;

const runVariantIdentityRepairJob = async () => {
  if (isRunning) {
    console.info(
      JSON.stringify({
        service: "variant_identity_repair",
        metric: "discountRepair.skipped",
        reason: "already_running",
      }),
    );

    return {
      skipped: true,
      reason: "already_running",
    };
  }

  isRunning = true;
  try {
    const summary = await runVariantIdentityRepairSweep();

    console.info(
      JSON.stringify({
        service: "variant_identity_repair",
        metric: "discountRepair.summary",
        ...summary,
      }),
    );

    return {
      skipped: false,
      ...summary,
    };
  } catch (error) {
    console.error(
      JSON.stringify({
        service: "variant_identity_repair",
        metric: "discountRepair.failed",
        error: String(error?.message || "variant_identity_repair_failed"),
      }),
    );

    return {
      skipped: false,
      error: String(error?.message || "variant_identity_repair_failed"),
    };
  } finally {
    isRunning = false;
  }
};

const startVariantIdentityRepairJob = () => {
  if (intervalRef) return intervalRef;

  setImmediate(() => {
    runVariantIdentityRepairJob();
  });

  const intervalMinutes = Math.max(
    5,
    Number(process.env.VARIANT_REPAIR_SWEEP_INTERVAL_MINUTES || 30),
  );
  intervalRef = setInterval(
    runVariantIdentityRepairJob,
    intervalMinutes * 60 * 1000,
  );

  if (intervalRef.unref) {
    intervalRef.unref();
  }

  return intervalRef;
};

module.exports = {
  startVariantIdentityRepairJob,
  runVariantIdentityRepairJob,
};
