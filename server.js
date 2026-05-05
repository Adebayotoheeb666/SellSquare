const dotenv = require("dotenv");
dotenv.config();
dotenv.config({ path: ".env.automation" });
const express = require("express");
const http = require("http");
const mongoose = require("mongoose");
require("./models/businessRegistration");
const bodyParser = require("body-parser");
const cors = require("cors");
const businessRoute = require("./routes/businessRoute");
const productRoute = require("./routes/productRoute");
const cartRoute = require("./routes/cartRoute");
const contactRoute = require("./routes/contactRoute");
const templateRoute = require("./routes/templateRoute");
const campaignRoute = require("./routes/campaignRoute");
const buyerAuthRoute = require("./routes/buyerAuthRoute");
const kycMarketplaceRoute = require("./routes/kycMarketplaceRoute");
const buyerMarketplaceRoute = require("./routes/buyerMarketplaceRoute");
const internalMarketplaceOrderRoute = require("./routes/internalMarketplaceOrderRoute");
const businessWalletRoute = require("./routes/businessWalletRoute");
const buyerWalletRoute = require("./routes/buyerWalletRoute");
const blogRoute = require("./routes/blogRoute");
const applicationRoute = require("./routes/applicationRoute");
const expenseRoute = require("./routes/expenseRoute");
const discountRoute = require("./routes/discountRoute");
const integrationRoute = require("./routes/integrationRoute");
const automationRoute = require("./routes/automationRoute");
const publicMarketplaceRoute = require("./routes/publicMarketplaceRoute");
const marketplaceAdminRoute = require("./routes/marketplaceAdminRoute");
const errorHandler = require("./middleWare/errorMiddleware");
const routeLogger = require("./middleWare/routeLoggerMiddleware");
const cookieParser = require("cookie-parser");
const path = require("path");
const { cleanupOldActivities } = require("./utils/cronJobs");
const { suppressConsoleLogs } = require("./utils/serverLogger");
const {
  startMarketplaceHoldExpiryJob,
} = require("./jobs/marketplaceHoldExpiryJob");
const {
  startVariantIdentityRepairJob,
} = require("./jobs/variantIdentityRepairJob");
const {
  initializeMarketplaceWebhookFanout,
} = require("./services/marketplace/webhookFanoutService");
const {
  initializeMarketplaceListingEventBridge,
} = require("./services/marketplace/listingEventBridgeService");
const {
  initializeKYCNotifications,
} = require("./services/kycNotificationService");


// Automation scheduler for background jobs
const automationScheduler = require("./jobs/automationScheduler");

// Event-driven realtime system
const { wsManager, sseManager, changeStreamManager } = require("./events");

const app = express();

const DEFAULT_ALLOWED_ORIGINS = [
  "http://localhost:3000",
  "http://localhost:3001",
  "http://localhost:4000",
  "https://inventory-software.onrender.com",
  "https://www.sellsquarehub.com",
  "https://sellsquarehub.com",
  "https://updates-main-inventory.onrender.com",
  "https://blubber-laurel-tile.ngrok-free.dev", // Added ngrok domain for CORS
];

const envAllowedOrigins = (process.env.CORS_ORIGINS || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const allowedOrigins = Array.from(
  new Set([...DEFAULT_ALLOWED_ORIGINS, ...envAllowedOrigins]),
);

// Reduce server logs to route and change stream logs only
suppressConsoleLogs();

// Middlewares
app.use(express.json());
app.use(cookieParser());
app.use(express.urlencoded({ extended: false }));
app.use(bodyParser.json());

// CORS configuration - MUST enable credentials for cookies to work cross-origin
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error(`Not allowed by CORS: ${origin}`));
    },
    credentials: true, // Allow cookies to be sent cross-origin
  }),
);

// Route Logger - logs all API requests
app.use(routeLogger);

app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// SSE endpoint for realtime events
app.use("/api/realtime", sseManager.createRouter());

// Proxy endpoint to forward requests to external server
const axios = require("axios");

app.use("/api/proxy/ngrok", async (req, res) => {
  try {
    const ngrokUrl = "https://blubber-laurel-tile.ngrok-free.dev/";
    // Forward the request method, headers, and body
    const response = await axios({
      method: req.method,
      url: ngrokUrl + req.originalUrl.replace("/api/proxy/ngrok", ""),
      headers: { ...req.headers, host: undefined }, // Remove host header for ngrok
      data: req.body,
      params: req.query,
      withCredentials: true,
    });
    res.status(response.status).send(response.data);
  } catch (error) {
    if (error.response) {
      res.status(error.response.status).send(error.response.data);
    } else {
      res.status(500).send({ error: error.message });
    }
  }
});

// Generic proxy handler for /business/* to /api/business/*
app.all("/business/*", (req, res, next) => {
  req.url = req.originalUrl.replace(/^\/business/, ""); // Remove /business prefix
  return businessRoute(req, res, next); // Forward to businessRoute
});

// Routes Middleware
app.use("/api/business", businessRoute);
app.use("/api/products", productRoute);
app.use("/api/cart", cartRoute);
app.use("/api/contactus", contactRoute);
app.use("/api/templates", templateRoute);
app.use("/api/campaigns", campaignRoute);
app.use("/api/blog", blogRoute);
app.use("/api/apply", applicationRoute);
app.use("/api/expenses", expenseRoute);
app.use("/api/discounts", discountRoute);
app.use("/api/integrations", integrationRoute);
app.use("/api/automation", automationRoute);
app.use("/api/public/v1/marketplace", publicMarketplaceRoute);
app.use("/api/buyer/auth", buyerAuthRoute);
app.use("/api/kyc", kycMarketplaceRoute);
app.use("/api/buyer/marketplace", buyerMarketplaceRoute);
app.use("/api/marketplace", internalMarketplaceOrderRoute);
app.use("/api/marketplace/wallet", businessWalletRoute);
app.use("/api/buyer/wallet", buyerWalletRoute);
app.use("/api/admin/marketplace", marketplaceAdminRoute);

// Handle 404s for API routes with JSON
app.use('/api', (req, res, next) => {
  res.status(404).json({ message: 'API route not found' });
});


// --------------------------deployment on heroku------------------------------

if (
  process.env.NODE_ENV === "production" ||
  process.env.NODE_ENV === "staging"
) {
  app.use(express.static(path.join(__dirname, "/client/build")));

  app.get("/*", function (req, res) {
    res.sendFile(path.join(__dirname, "/client/build", "index.html"));
  });
} else {
  app.get("/", (req, res) => {
    res.send("API is running..");
  });
}

// --------------------------deployment------------------------------

// Routes
app.get("/", (req, res) => {
  res.send("Home Page");
});

// Global JSON error handler for API routes
app.use((err, req, res, next) => {
  if (req.originalUrl.startsWith('/api/')) {
    const statusCode = res.statusCode && res.statusCode !== 200 ? res.statusCode : 500;
    res.status(statusCode).json({
      message: err.message || 'An error occurred',
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    });
  } else {
    next(err);
  }
});

// Error Middleware
app.use(errorHandler);

module.exports = app;

// { "$or": [ { "cost": { "$regex": "[^0-9]" } }, { "price": { "$regex": "[^0-9]" } } ] }

// pkill -f "SellSquare.*server" && npm run dev
