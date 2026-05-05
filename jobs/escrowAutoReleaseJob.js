const cron = require("node-cron");
const InternalMarketplaceOrder = require("../models/internalMarketplaceOrderModel");
const { releaseFundsToBusiness } = require("../services/marketplace/escrowReleaseService");

/**
 * Escrow Auto-Release Job
 * Runs every hour to check for delivered orders that haven't been confirmed by the buyer within 24 hours.
 */
const scheduleEscrowAutoRelease = () => {
  // Run every hour
  cron.schedule("0 * * * *", async () => {
    console.log(`[${new Date().toISOString()}] Starting Escrow Auto-Release Job...`);
    
    try {
      const twentyFourHoursAgo = new Date();
      twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

      // Find orders that are 'delivered' and were delivered more than 24 hours ago
      const pendingOrders = await InternalMarketplaceOrder.find({
        status: "delivered",
        deliveredAt: { $lte: twentyFourHoursAgo },
      });

      console.log(`Found ${pendingOrders.length} orders eligible for auto-release.`);

      for (const order of pendingOrders) {
        try {
          console.log(`Auto-releasing funds for Order: ${order.orderNumber} (${order._id})`);
          await releaseFundsToBusiness(order._id.toString(), "system_auto_release");
        } catch (releaseError) {
          console.error(`Failed to auto-release order ${order._id}:`, releaseError.message);
        }
      }

      if (pendingOrders.length > 0) {
        console.log(`[${new Date().toISOString()}] Escrow Auto-Release Job completed.`);
      }
    } catch (error) {
      console.error(`[${new Date().toISOString()}] Error in Escrow Auto-Release Job:`, error.message);
    }
  });

  console.log("✅ Escrow Auto-Release background job scheduled (runs hourly)");
};

module.exports = {
  scheduleEscrowAutoRelease,
};
