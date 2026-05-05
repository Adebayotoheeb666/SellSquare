/**
 * WebSocket Manager
 *
 * Handles WebSocket connections for realtime event delivery.
 * Uses ws library for WebSocket support in Node.js.
 *
 * Features:
 * - Authenticated connections using JWT tokens
 * - Automatic reconnection handling
 * - Heartbeat/ping-pong for connection health
 * - Business-scoped event delivery
 * - Rate limiting per client
 */

const WebSocket = require("ws");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { eventBus, EventTypes, verifySignature } = require("./EventEmitter");

class WebSocketManager {
  constructor() {
    this.wss = null;
    this.clients = new Map(); // clientId -> { ws, businessId, userId, metadata }
    this.businessClients = new Map(); // businessId -> Set of clientIds
    this.buyerClients = new Map(); // buyerId -> clientId (one connection per buyer)

    // Rate limiting
    this.clientMessageCounts = new Map();
    this.maxMessagesPerMinute = 100;

    // Heartbeat interval (30 seconds)
    this.heartbeatInterval = 30000;
    this.heartbeatTimer = null;

    // Reconnection tracking
    this.reconnectionAttempts = new Map();
    this.maxReconnectionAttempts = 5;

    // Stable listener references for lifecycle-safe register/unregister
    this.businessEventListener = this.handleBusinessEvent.bind(this);
    this.buyerEventListener = this.handleBuyerEvent.bind(this);
  }

  isPartnerClient(tokenData = {}) {
    return Boolean(tokenData?.typ === "access" && tokenData?.credentialId);
  }

  canDeliverEventToPartner(payload = {}) {
    const eventType = String(payload?.type || "");

    if (!eventType) return false;

    return (
      eventType.startsWith("marketplace.")
      || eventType.startsWith("product.")
      || eventType.startsWith("product_group.")
      || eventType.startsWith("inventory.")
      || eventType.startsWith("discount.")
    );
  }

  getEventUserId(payload = {}) {
    return (
      payload?.data?.userId
      || payload?.data?.user?.email
      || payload?.userId
      || payload?.metadata?.userId
      || null
    );
  }

  /**
   * Initialize WebSocket server
   */
  initialize(server) {
    this.wss = new WebSocket.Server({
      server,
      path: "/ws",
      verifyClient: this.verifyClient.bind(this),
    });

    this.wss.on("connection", this.handleConnection.bind(this));

    // Start heartbeat
    this.startHeartbeat();

    // Listen to event bus for business events (idempotent registration)
    eventBus.off("business_event", this.businessEventListener);
    eventBus.on("business_event", this.businessEventListener);

    // Listen to event bus for buyer events
    eventBus.off("buyer_event", this.buyerEventListener);
    eventBus.on("buyer_event", this.buyerEventListener);

    console.log("[WebSocketManager] WebSocket server initialized");

    return this;
  }

  /**
   * Verify client connection (authentication)
   * Extracts JWT token and loggedInUser from cookies for user identification
   * Supports both business and buyer tokens
   */
  verifyClient(info, callback) {
    try {
      console.log("[WebSocketManager] Verifying client connection...");
      console.log("[WebSocketManager] Headers:", {
        hasCookie: !!info.req.headers.cookie,
        hasAuth: !!info.req.headers["authorization"],
      });

      // Extract tokens from cookies
      const cookieHeader = info.req.headers.cookie || "";
      const cookies = this.parseCookies(cookieHeader);
      const token = cookies.token;
      const buyerToken = cookies.buyer_token;

      console.log("[WebSocketManager] Parsed token from cookies:", !!token, "buyer_token:", !!buyerToken);

      // Try buyer token first
      if (buyerToken) {
        try {
          const decoded = jwt.verify(buyerToken, process.env.BUYER_JWT_SECRET);
          info.req.buyerId = decoded.buyerId;
          info.req.tokenData = decoded;
          info.req.isBuyerConnection = true;
          console.log(`[WebSocketManager] Buyer authenticated: ${decoded.buyerId}`);
          callback(true);
          return;
        } catch (error) {
          console.warn("[WebSocketManager] Buyer token verification failed:", error.message);
        }
      }

      // Fallback to query string or Authorization header for compatibility
      if (!token && !buyerToken) {
        const url = new URL(info.req.url, "http://localhost");
        const queryToken =
          url.searchParams.get("token") ||
          url.searchParams.get("buyer_token") ||
          info.req.headers["authorization"]?.replace("Bearer ", "");

        if (!queryToken) {
          console.log(
            "[WebSocketManager] Auth failed: No token in cookies or headers",
          );
          callback(false, 401, "Unauthorized: No token provided");
          return;
        }

        // Try as buyer token first
        try {
          const decoded = jwt.verify(queryToken, process.env.BUYER_JWT_SECRET);
          info.req.buyerId = decoded.buyerId;
          info.req.tokenData = decoded;
          info.req.isBuyerConnection = true;
          console.log(`[WebSocketManager] Buyer authenticated via query: ${decoded.buyerId}`);
          callback(true);
          return;
        } catch (e) {
          // Fall through to business token verification
        }

        // Use query token as business token fallback
        const decoded = jwt.verify(
          queryToken,
          process.env.PUBLIC_PARTNER_JWT_SECRET || process.env.JWT_SECRET,
        );
        info.req.businessId = decoded.id || decoded.businessId;
        info.req.tokenData = decoded;
        callback(true);
        return;
      }

      // Verify JWT token from cookie (business token)
      if (token) {
        const decoded = jwt.verify(
          token,
          process.env.PUBLIC_PARTNER_JWT_SECRET || process.env.JWT_SECRET,
        );

        // Attach decoded info to request for later use
        info.req.businessId = decoded.id || decoded.businessId;
        info.req.tokenData = decoded;

        // CRITICAL: Extract loggedInUser cookie to get user email for cart filtering
        const loggedInUserCookie = cookies.loggedInUser;
        if (loggedInUserCookie) {
          try {
            const loggedInUser = JSON.parse(loggedInUserCookie);
            info.req.userEmail = loggedInUser.email;
            console.log(
              `[WebSocketManager] User email extracted: ${loggedInUser.email}`,
            );
          } catch (parseError) {
            console.warn(
              "[WebSocketManager] Failed to parse loggedInUser cookie:",
              parseError.message,
            );
          }
        }

        console.log(
          `[WebSocketManager] Client authenticated for business: ${decoded.id || decoded.businessId}`,
        );
        callback(true);
      }
    } catch (error) {
      console.error("[WebSocketManager] Auth error:", error.message);
      callback(false, 401, "Unauthorized: Invalid token");
    }
  }

  /**
   * Parse cookies from cookie header string
   */
  parseCookies(cookieHeader) {
    const cookies = {};
    if (!cookieHeader) return cookies;

    cookieHeader.split(";").forEach((cookie) => {
      const parts = cookie.split("=");
      const name = parts[0]?.trim();
      const value = parts.slice(1).join("=").trim();
      if (name) {
        cookies[name] = decodeURIComponent(value);
      }
    });

    return cookies;
  }

  /**
   * Handle new WebSocket connection
   */
  handleConnection(ws, req) {
    const clientId = this.generateClientId();

    // Handle buyer connection
    if (req.isBuyerConnection) {
      this.handleBuyerConnection(ws, req, clientId);
      return;
    }

    // Handle business connection
    // Normalize businessId to string to ensure consistency with JWT decoding
    const businessId = req.businessId?.toString
      ? req.businessId.toString()
      : String(req.businessId);
    // CRITICAL: Use user email from loggedInUser cookie for cart event filtering
    const userId = req.userEmail || req.tokenData?.userId || req.tokenData?.email;

    console.log(
      `[WebSocketManager] handleConnection: clientId=${clientId}, businessId=${businessId}, userId=${userId}`,
    );

    // Store client info
    this.clients.set(clientId, {
      ws,
      businessId,
      userId,
      tokenData: req.tokenData || {},
      isPartnerClient: this.isPartnerClient(req.tokenData),
      connectedAt: Date.now(),
      lastPing: Date.now(),
      metadata: {
        ip: req.socket.remoteAddress,
        userAgent: req.headers["user-agent"],
      },
    });

    // Add to business clients set
    if (!this.businessClients.has(businessId)) {
      console.log(
        `[WebSocketManager] Creating new businessClients set for ${businessId}`,
      );
      this.businessClients.set(businessId, new Set());
    }
    this.businessClients.get(businessId).add(clientId);

    console.log(
      `[WebSocketManager] Client registered: ${clientId} for business: ${businessId}, userId: ${userId}, total clients for this business: ${this.businessClients.get(businessId).size}`,
    );

    // Register with event bus
    eventBus.registerClient(clientId, businessId, {
      emit: (event, data) => this.sendToClient(clientId, event, data),
    });

    console.log(
      `[WebSocketManager] Client connected: ${clientId} (Business: ${businessId}, User: ${userId})`,
    );

    // Send welcome message
    this.sendToClient(clientId, "connected", {
      clientId,
      message: "Connected to realtime updates",
      timestamp: Date.now(),
    });

    // Handle incoming messages
    ws.on("message", (data) => this.handleMessage(clientId, data));

    // Handle disconnect
    ws.on("close", (code, reason) =>
      this.handleDisconnect(clientId, code, reason),
    );

    // Handle errors
    ws.on("error", (error) => this.handleError(clientId, error));

    // Handle pong (heartbeat response)
    ws.on("pong", () => this.handlePong(clientId));
  }

  /**
   * Handle new buyer WebSocket connection
   */
  handleBuyerConnection(ws, req, clientId) {
    const buyerId = req.buyerId?.toString
      ? req.buyerId.toString()
      : String(req.buyerId);

    console.log(`[WebSocketManager] handleBuyerConnection: clientId=${clientId}, buyerId=${buyerId}`);

    // Store buyer client info
    this.clients.set(clientId, {
      ws,
      buyerId,
      isBuyer: true,
      tokenData: req.tokenData || {},
      connectedAt: Date.now(),
      lastPing: Date.now(),
      metadata: {
        ip: req.socket.remoteAddress,
        userAgent: req.headers["user-agent"],
      },
    });

    // Register buyer client (one per buyer)
    const oldClientId = this.buyerClients.get(buyerId);
    if (oldClientId) {
      console.log(`[WebSocketManager] Closing old connection for buyer ${buyerId}`);
      const oldClient = this.clients.get(oldClientId);
      if (oldClient) {
        oldClient.ws.close(1000, "New connection established");
      }
    }
    this.buyerClients.set(buyerId, clientId);

    console.log(
      `[WebSocketManager] Buyer connected: ${clientId} (Buyer: ${buyerId})`,
    );

    // Send welcome message
    this.sendToClient(clientId, "connected", {
      clientId,
      message: "Connected to buyer realtime updates",
      timestamp: Date.now(),
    });

    // Handle incoming messages
    ws.on("message", (data) => this.handleMessage(clientId, data));

    // Handle disconnect
    ws.on("close", (code, reason) => {
      this.handleBuyerDisconnect(clientId, buyerId, code, reason);
    });

    // Handle errors
    ws.on("error", (error) => this.handleError(clientId, error));

    // Handle pong (heartbeat response)
    ws.on("pong", () => this.handlePong(clientId));
  }

  /**
   * Handle incoming message from client
   */
  handleMessage(clientId, data) {
    // Rate limiting
    if (!this.checkRateLimit(clientId)) {
      this.sendToClient(clientId, "error", {
        code: "RATE_LIMIT_EXCEEDED",
        message: "Too many messages. Please slow down.",
      });
      return;
    }

    try {
      const message = JSON.parse(data.toString());

      switch (message.type) {
        case "ping":
          this.sendToClient(clientId, "pong", { timestamp: Date.now() });
          break;

        case "subscribe":
          this.handleSubscribe(clientId, message.channels);
          break;

        case "unsubscribe":
          this.handleUnsubscribe(clientId, message.channels);
          break;

        case "ack":
          // Acknowledge event receipt (for delivery confirmation)
          this.handleAcknowledge(clientId, message.eventId);
          break;

        default:
          console.log(
            `[WebSocketManager] Unknown message type: ${message.type}`,
          );
      }
    } catch (error) {
      console.error("[WebSocketManager] Error parsing message:", error);
    }
  }

  /**
   * Handle client disconnect
   */
  handleDisconnect(clientId, code, reason) {
    const client = this.clients.get(clientId);
    if (client) {
      // Remove from business clients
      const businessClients = this.businessClients.get(client.businessId);
      if (businessClients) {
        businessClients.delete(clientId);
        if (businessClients.size === 0) {
          this.businessClients.delete(client.businessId);
        }
      }

      // Unregister from event bus
      eventBus.unregisterClient(clientId);

      // Remove client
      this.clients.delete(clientId);
      this.clientMessageCounts.delete(clientId);

      console.log(
        `[WebSocketManager] Client disconnected: ${clientId} (Code: ${code})`,
      );
    }
  }

  /**
   * Handle buyer client disconnect
   */
  handleBuyerDisconnect(clientId, buyerId, code, reason) {
    const client = this.clients.get(clientId);
    if (client && client.isBuyer) {
      // Remove buyer client mapping
      if (this.buyerClients.get(buyerId) === clientId) {
        this.buyerClients.delete(buyerId);
      }

      // Remove client
      this.clients.delete(clientId);
      this.clientMessageCounts.delete(clientId);

      console.log(
        `[WebSocketManager] Buyer disconnected: ${clientId} (Buyer: ${buyerId}, Code: ${code})`,
      );
    }
  }

  /**
   * Handle client error
   */
  handleError(clientId, error) {
    console.error(
      `[WebSocketManager] Client ${clientId} error:`,
      error.message,
    );
  }

  /**
   * Handle pong response (heartbeat)
   */
  handlePong(clientId) {
    const client = this.clients.get(clientId);
    if (client) {
      client.lastPing = Date.now();
    }
  }

  /**
   * Handle subscribe to channels
   */
  handleSubscribe(clientId, channels) {
    const client = this.clients.get(clientId);
    if (client) {
      client.subscribedChannels = client.subscribedChannels || new Set();
      channels.forEach((channel) => client.subscribedChannels.add(channel));

      this.sendToClient(clientId, "subscribed", { channels });
    }
  }

  /**
   * Handle unsubscribe from channels
   */
  handleUnsubscribe(clientId, channels) {
    const client = this.clients.get(clientId);
    if (client && client.subscribedChannels) {
      channels.forEach((channel) => client.subscribedChannels.delete(channel));

      this.sendToClient(clientId, "unsubscribed", { channels });
    }
  }

  /**
   * Handle event acknowledgment
   */
  handleAcknowledge(clientId, eventId) {
    // Cancel any pending retries for this event
    eventBus.cancelRetry(eventId);
  }

  /**
   * Handle business event from EventBus
   * CRITICAL: For user-scoped events like CART, only send to the specific user
   */
  handleBusinessEvent(businessId, payload) {
    // Normalize businessId to string
    const normalizedBusinessId = businessId?.toString
      ? businessId.toString()
      : String(businessId);
    const clientIds = this.businessClients.get(normalizedBusinessId);

    console.log(
      `[WebSocketManager] Business event received: businessId=${normalizedBusinessId}, type=${payload.type}, clientCount=${clientIds?.size || 0}`,
    );

    if (!clientIds || clientIds.size === 0) {
      console.log(
        `[WebSocketManager] No clients for business ${normalizedBusinessId}, event dropped`,
      );
      return;
    }

    // CRITICAL: Filter cart events to specific user only
    const isUserScopedEvent = payload.type &&
      (payload.type.startsWith("cart.") || payload.type.includes("CART"));
    // Handle both formatted event data and metadata fallback
    const eventUserId = this.getEventUserId(payload);

    // Send to relevant clients
    clientIds.forEach((clientId) => {
      const client = this.clients.get(clientId);
      if (client) {
        // For user-scoped events, only send to the user who owns the resource
        if (isUserScopedEvent && eventUserId && client.userId !== eventUserId) {
          console.log(
            `[WebSocketManager] Filtering user-scoped event: userId=${client.userId}, eventUserId=${eventUserId}`,
          );
          return; // Skip this client - event is not for them
        }

        if (client.isPartnerClient && !this.canDeliverEventToPartner(payload)) {
          return;
        }

        // Check if client is subscribed to this event type (if channels are used)
        const shouldSend =
          !client.subscribedChannels ||
          client.subscribedChannels.size === 0 ||
          client.subscribedChannels.has(payload.type) ||
          client.subscribedChannels.has("*");

        if (shouldSend) {
          this.sendToClient(clientId, "event", payload);
        }
      }
    });
  }

  /**
   * Handle buyer event from EventBus
   * Sends events to a specific buyer
   */
  handleBuyerEvent(buyerId, payload) {
    const normalizedBuyerId = buyerId?.toString
      ? buyerId.toString()
      : String(buyerId);

    const clientId = this.buyerClients.get(normalizedBuyerId);

    console.log(
      `[WebSocketManager] Buyer event received: buyerId=${normalizedBuyerId}, type=${payload.type}, clientId=${clientId || "not_connected"}`,
    );

    if (!clientId) {
      console.log(
        `[WebSocketManager] No connected client for buyer ${normalizedBuyerId}, event dropped`,
      );
      return;
    }

    this.sendToClient(clientId, "event", payload);
  }

  /**
   * Notify a specific buyer
   * Used by backend services to push notifications to buyers
   */
  notifyBuyer(buyerId, eventType, data) {
    const clientId = this.buyerClients.get(buyerId?.toString ? buyerId.toString() : String(buyerId));
    if (!clientId) {
      console.log(`[WebSocketManager] Buyer ${buyerId} not connected`);
      return false;
    }

    return this.sendToClient(clientId, eventType, data);
  }

  /**
   * Send message to specific client
   */
  sendToClient(clientId, type, data) {
    const client = this.clients.get(clientId);
    if (!client || client.ws.readyState !== WebSocket.OPEN) {
      return false;
    }

    try {
      const message = JSON.stringify({ type, data, timestamp: Date.now() });
      client.ws.send(message);
      return true;
    } catch (error) {
      console.error(`[WebSocketManager] Error sending to ${clientId}:`, error);
      return false;
    }
  }

  /**
   * Broadcast to all clients of a business
   */
  broadcastToBusiness(businessId, type, data) {
    const clientIds = this.businessClients.get(businessId);
    if (!clientIds) return 0;

    let sentCount = 0;
    clientIds.forEach((clientId) => {
      if (this.sendToClient(clientId, type, data)) {
        sentCount++;
      }
    });

    return sentCount;
  }

  /**
   * Check rate limit for client
   */
  checkRateLimit(clientId) {
    const now = Date.now();
    const windowStart = now - 60000; // 1 minute window

    let messages = this.clientMessageCounts.get(clientId) || [];

    // Remove old messages outside window
    messages = messages.filter((timestamp) => timestamp > windowStart);

    if (messages.length >= this.maxMessagesPerMinute) {
      return false;
    }

    messages.push(now);
    this.clientMessageCounts.set(clientId, messages);

    return true;
  }

  /**
   * Start heartbeat to detect dead connections
   */
  startHeartbeat() {
    this.heartbeatTimer = setInterval(() => {
      const now = Date.now();
      const timeout = this.heartbeatInterval * 2;

      this.clients.forEach((client, clientId) => {
        // Check if client is responsive
        if (now - client.lastPing > timeout) {
          console.log(`[WebSocketManager] Client ${clientId} timed out`);
          client.ws.terminate();
          return;
        }

        // Send ping
        if (client.ws.readyState === WebSocket.OPEN) {
          client.ws.ping();
        }
      });
    }, this.heartbeatInterval);
  }

  /**
   * Stop heartbeat
   */
  stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  /**
   * Generate unique client ID
   */
  generateClientId() {
    return `ws_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
  }

  /**
   * Get connection statistics
   */
  getStats() {
    return {
      totalClients: this.clients.size,
      businessCount: this.businessClients.size,
      buyerCount: this.buyerClients.size,
      clientsByBusiness: Object.fromEntries(
        Array.from(this.businessClients.entries()).map(([id, set]) => [
          id,
          set.size,
        ]),
      ),
      connectedBuyers: Array.from(this.buyerClients.keys()),
    };
  }

  /**
   * Graceful shutdown
   */
  shutdown() {
    this.stopHeartbeat();

    // Detach event bus listeners
    eventBus.off("business_event", this.businessEventListener);
    eventBus.off("buyer_event", this.buyerEventListener);

    // Notify all clients
    this.clients.forEach((client, clientId) => {
      this.sendToClient(clientId, "shutdown", {
        message: "Server shutting down",
        reconnectIn: 5000,
      });
      client.ws.close(1001, "Server shutting down");
    });

    if (this.wss) {
      this.wss.close();
      this.wss = null;
    }

    this.clients.clear();
    this.businessClients.clear();
    this.buyerClients.clear();
    this.clientMessageCounts.clear();

    console.log("[WebSocketManager] Shutdown complete");
  }
}

// Create and export singleton
const wsManager = new WebSocketManager();

module.exports = { WebSocketManager, wsManager };
