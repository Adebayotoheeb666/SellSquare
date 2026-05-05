/**
 * Route Logger Middleware
 * Logs all API requests with timestamp, method, route, and business information
 * Only logs routes that are manually defined (API routes, not static files or undefined routes)
 */

// ANSI color codes for console output
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  dim: "\x1b[2m",
  blue: "\x1b[34m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  red: "\x1b[31m",
  magenta: "\x1b[35m",
};

const { logRoute } = require("../utils/serverLogger");

const routeLogger = (req, res, next) => {
  // Only log API routes (routes that start with /api)
  if (!req.path.startsWith("/api")) {
    return next();
  }

  const timestamp = new Date().toISOString();
  const method = req.method;
  const route = req.originalUrl || req.url;

  // Extract business information if available
  let businessInfo = "Anonymous";
  let userInfo = "Not authenticated";

  try {
    // Try to get user and business info from cookies
    if (req.cookies && req.cookies.loggedInUser) {
      try {
        const user = JSON.parse(req.cookies.loggedInUser);

        // Get business name from user object
        if (user && user.businessName) {
          businessInfo = user.businessName;
        }

        // Get user info
        if (user) {
          userInfo = user.name || user.email || "User";
        }
      } catch (e) {
        userInfo = "User (parse error)";
      }
    }
  } catch (error) {
    // Silently fail if business/user info is not available
  }

  // Get IP address
  const ip = req.ip || req.connection.remoteAddress || "Unknown IP";

  // Capture response status when request completes
  const startTime = Date.now();
  const originalSend = res.send;

  res.send = function (data) {
    const duration = Date.now() - startTime + "ms";
    const statusCode = res.statusCode;
    const statusColor = statusCode >= 400 ? colors.red : colors.green;
    // duration color
    const durationColor =
      duration > 1000
        ? colors.red
        : duration > 500
          ? colors.yellow
          : colors.green;

    // Log the complete request info with response status
    const logMessage = `${colors.reset} ${colors.blue}${method}${colors.reset} ${colors.green}${route}${colors.reset} | Business: ${colors.yellow}${businessInfo}${colors.reset} | User: ${colors.cyan}${userInfo}${colors.reset} | Status: ${statusColor}${statusCode}${colors.reset} | Duration: ${durationColor}${duration}${colors.reset}`;
    logRoute(logMessage);

    originalSend.apply(res, arguments);
  };

  next();
};

module.exports = routeLogger;
