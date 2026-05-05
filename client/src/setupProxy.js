/**
 * Create React App proxy configuration for development
 *
 * This proxies both HTTP and WebSocket requests to the backend server,
 * allowing cookies to work properly in development (same-origin requests).
 *
 * Without this, WebSocket connections from localhost:3000 (React dev server)
 * to localhost:4000 (backend) are cross-origin and won't send httpOnly cookies.
 */

const { createProxyMiddleware } = require("http-proxy-middleware");

module.exports = function (app) {
  // Proxy API requests
  app.use(
    "/api",
    createProxyMiddleware({
      target: "http://localhost:4000",
      changeOrigin: true,
    }),
  );

  // Proxy WebSocket connections - CRITICAL for real-time updates
  app.use(
    "/ws",
    createProxyMiddleware({
      target: "http://localhost:4000",
      ws: true, // Enable WebSocket proxying
      changeOrigin: true,
      logLevel: "debug", // Log proxy activity
    }),
  );
};
