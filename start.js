const http = require('http');
const mongoose = require('mongoose');
const app = require('./server');
const { cleanupOldActivities } = require('./utils/cronJobs');
const { suppressConsoleLogs } = require('./utils/serverLogger');
const { wsManager, sseManager, changeStreamManager } = require('./events');
const {
  startMarketplaceHoldExpiryJob,
} = require('./jobs/marketplaceHoldExpiryJob');
const {
  startVariantIdentityRepairJob,
} = require('./jobs/variantIdentityRepairJob');
const {
  scheduleEscrowAutoRelease,
} = require('./jobs/escrowAutoReleaseJob');
const {
  initializeMarketplaceWebhookFanout,
} = require('./services/marketplace/webhookFanoutService');
const {
  initializeMarketplaceListingEventBridge,
} = require('./services/marketplace/listingEventBridgeService');
const {
  initializeKYCNotifications,
} = require('./services/kycNotificationService');
const automationScheduler = require('./jobs/automationScheduler');

const PORT = process.env.PORT || 4000;

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    const server = http.createServer(app);
    wsManager.initialize(server);
    sseManager.initialize();

    // Initialize MongoDB Change Streams for real-time data monitoring
    const Expense = require('./models/expenseModel');
    const Product = require('./models/productModel');
    const ProductGroup = require('./models/productGroupModel');
    const Discount = require('./models/discountModel');
    const CheckOut = require('./models/checkOutSalesModel');
    const Cart = require('./models/cartModel');
    const Activity = require('./models/Activities');
    const Business = require('./models/businessRegistration');

    changeStreamManager.initializeStream('expenses', Expense.collection);
    changeStreamManager.initializeStream('products', Product.collection);
    changeStreamManager.initializeStream('productgroups', ProductGroup.collection);
    changeStreamManager.initializeStream('discounts', Discount.collection);
    changeStreamManager.initializeStream('checkouts', CheckOut.collection);
    changeStreamManager.initializeStream('carts', Cart.collection);
    changeStreamManager.initializeStream('activities', Activity.collection);
    changeStreamManager.initializeStream('businesses', Business.collection);

    initializeMarketplaceWebhookFanout();
    initializeMarketplaceListingEventBridge();
    initializeKYCNotifications();

    server.listen(PORT, () => {
      cleanupOldActivities();
      startMarketplaceHoldExpiryJob();
      startVariantIdentityRepairJob();
      scheduleEscrowAutoRelease();
      try {
        automationScheduler.initializeJobs();
        console.log('[Server] Automation scheduler initialized successfully');
      } catch (error) {
        console.error('[Server] Failed to initialize automation scheduler:', error.message);
      }
      console.log(`Server running on port ${PORT}`);
    });

    // Graceful shutdown handling
    const gracefulShutdown = (signal) => {
      changeStreamManager.closeAll();
      wsManager.shutdown();
      sseManager.shutdown();
      server.close(() => {
        mongoose.connection.close(false, () => {
          process.exit(0);
        });
      });
      setTimeout(() => {
        console.error('Forced shutdown after timeout');
        process.exit(1);
      }, 10000);
    };
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  })
  .catch((err) => console.log(err));
