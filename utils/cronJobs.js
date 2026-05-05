const cron = require("node-cron");
const Activities = require("../models/Activities");

/**
 * Cron job to delete activities older than 30 days
 * Runs every day at 2:00 AM
 */
const cleanupOldActivities = () => {
  // Run daily at 2:00 AM
  cron.schedule("0 2 * * *", async () => {
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const result = await Activities.deleteMany({
        createdAt: { $lt: thirtyDaysAgo },
      });

      console.log(
        `[${new Date().toISOString()}] Cleanup completed: Deleted ${
          result.deletedCount
        } activities older than 30 days`
      );
    } catch (error) {
      console.error(
        `[${new Date().toISOString()}] Error cleaning up old activities:`,
        error.message
      );
    }
  });

  console.log("✅ Activity cleanup cron job scheduled (runs daily at 2:00 AM)");
};

/**
 * Manual cleanup function for testing or immediate execution
 * Can be called from an API endpoint if needed
 */
const manualCleanupOldActivities = async () => {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const result = await Activities.deleteMany({
      createdAt: { $lt: thirtyDaysAgo },
    });

    return {
      success: true,
      deletedCount: result.deletedCount,
      message: `Deleted ${result.deletedCount} activities older than 30 days`,
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      message: "Failed to cleanup old activities",
    };
  }
};

module.exports = {
  cleanupOldActivities,
  manualCleanupOldActivities,
};
