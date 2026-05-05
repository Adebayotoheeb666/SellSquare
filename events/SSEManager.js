/**
 * Server-Sent Events (SSE) Manager
 *
 * Provides SSE-based realtime event delivery as an alternative to WebSocket.
 * Useful for environments where WebSocket is not available or blocked.
 *
 * Features:
 * - HTTP-based streaming (works through proxies/firewalls)
 * - Automatic reconnection support via Last-Event-ID
 * - JWT-authenticated connections
 * - Business-scoped event delivery
 */

const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { eventBus } = require("./EventEmitter");

class SSEManager {
  constructor() {
    this.clients = new Map(); // clientId -> { res, businessId, userId, metadata }
    this.businessClients = new Map(); // businessId -> Set of clientIds

    // Event history for reconnection (last 100 events per business)
    this.eventHistory = new Map(); // businessId -> Array of events
    this.maxHistoryPerBusiness = 100;

    // Heartbeat interval (15 seconds)
    this.heartbeatInterval = 15000;
    this.heartbeatTimers = new Map();

    this.allowedOrigins = this.buildAllowedOrigins();

    // Stable listener references for lifecycle-safe register/unregister
    this.businessEventListener = this.handleBusinessEvent.bind(this);
  }

  buildAllowedOrigins() {
    const defaults = [
      "http://localhost:3000",
      "http://localhost:3001",
      "https://inventory-software.onrender.com",
    ];

    const fromEnv = String(process.env.ALLOWED_ORIGINS || process.env.CORS_ALLOWED_ORIGINS || "")
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean);

    return new Set([...defaults, ...fromEnv]);
  }

  isAllowedOrigin(origin = "") {
    const normalized = String(origin || "").trim();
    if (!normalized) return false;
    return this.allowedOrigins.has(normalized);
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

  handleBusinessEvent(businessId, payload) {
    const normalizedBusinessId = businessId?.toString
      ? businessId.toString()
      : String(businessId);
    const clientIds = this.businessClients.get(normalizedBusinessId);

    if (!clientIds || clientIds.size === 0) {
      return;
    }

    const eventId =
      payload?.id || `${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;

    this.storeEvent(normalizedBusinessId, eventId, "event", payload);

    const isUserScopedEvent = payload?.type
      && (payload.type.startsWith("cart.") || payload.type.includes("CART"));
    const eventUserId = this.getEventUserId(payload);

    clientIds.forEach((clientId) => {
      const client = this.clients.get(clientId);
      if (!client) return;

      if (isUserScopedEvent && eventUserId && client.userId !== eventUserId) {
        return;
      }

      if (client.isPartnerClient && !this.canDeliverEventToPartner(payload)) {
        return;
      }

      this.sendEvent(client.res, "event", payload, eventId);
    });
  }

  /**
   * Create Express router for SSE endpoint
   */
  createRouter() {
    const express = require("express");
    const router = express.Router();

    // SSE connection endpoint
    router.get("/events", this.handleConnection.bind(this));

    // Stats endpoint (for monitoring)
    router.get("/stats", (req, res) => {
      res.json(this.getStats());
    });

    return router;
  }

  /**
   * Handle new SSE connection
   * Extracts JWT token from cookies (httpOnly cookie support)
   */
  handleConnection(req, res) {
    // Parse cookies from request
    const cookieHeader = req.headers.cookie || "";
    const cookies = this.parseCookies(cookieHeader);

    // Try to get token from cookie first, then query string, then auth header
    const token =
      cookies.token ||
      req.query.token ||
      req.headers["authorization"]?.replace("Bearer ", "");

    const requestOrigin = req.headers.origin || "";
    if (requestOrigin && !this.isAllowedOrigin(requestOrigin)) {
      return res.status(403).json({ error: "Forbidden origin" });
    }

    if (!token) {
      console.log("[SSEManager] Auth failed: No token in cookies or headers");
      return res.status(401).json({ error: "Unauthorized: No token provided" });
    }

    let decoded;
    try {
      decoded = jwt.verify(
        token,
        process.env.PUBLIC_PARTNER_JWT_SECRET || process.env.JWT_SECRET,
      );
    } catch (error) {
      console.log("[SSEManager] Auth failed:", error.message);
      return res.status(401).json({ error: "Unauthorized: Invalid token" });
    }

    const clientId = this.generateClientId();
    const businessId = decoded.id || decoded.businessId;

    let userId = decoded.userId || decoded.email;
    if (cookies.loggedInUser) {
      try {
        const loggedInUser = JSON.parse(cookies.loggedInUser);
        if (loggedInUser?.email) {
          userId = loggedInUser.email;
        }
      } catch (error) {
        // ignore malformed loggedInUser cookie
      }
    }

    // Normalize businessId to string for Map consistency
    const normalizedBusinessId = businessId?.toString
      ? businessId.toString()
      : String(businessId);

    console.log(
      `[SSEManager] Client authenticated: clientId=${clientId}, businessId=${normalizedBusinessId}, userId=${userId}`,
    );

    // Set SSE headers
    const originHeader = requestOrigin && this.isAllowedOrigin(requestOrigin)
      ? requestOrigin
      : "";

    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      ...(originHeader ? { "Access-Control-Allow-Origin": originHeader } : {}),
      "Access-Control-Allow-Credentials": "true",
      "Access-Control-Allow-Headers": "Cache-Control",
      Vary: "Origin",
      "X-Accel-Buffering": "no", // Disable nginx buffering
    });

    // Store client
    this.clients.set(clientId, {
      res,
      businessId: normalizedBusinessId,
      userId,
      tokenData: decoded,
      isPartnerClient: this.isPartnerClient(decoded),
      connectedAt: Date.now(),
      lastEventId: req.headers["last-event-id"] || null,
      metadata: {
        ip: req.ip,
        userAgent: req.get("User-Agent"),
      },
    });

    // Add to business clients
    if (!this.businessClients.has(normalizedBusinessId)) {
      this.businessClients.set(normalizedBusinessId, new Set());
      console.log(
        `[SSEManager] Created new businessClients set for ${normalizedBusinessId}`,
      );
    }
    this.businessClients.get(normalizedBusinessId).add(clientId);

    // Register with event bus
    eventBus.registerClient(clientId, normalizedBusinessId, {
      emit: (event, data) => this.sendToClient(clientId, event, data),
    });

    console.log(
      `[SSEManager] Client connected: ${clientId} (Business: ${normalizedBusinessId}, Total SSE clients: ${this.businessClients.get(normalizedBusinessId).size})`,
    );

    // Send initial connection event
    this.sendEvent(res, "connected", {
      clientId,
      message: "Connected to realtime updates (SSE)",
      timestamp: Date.now(),
    });

    // Replay missed events if reconnecting
    const lastEventId = req.headers["last-event-id"];
    if (lastEventId) {
      this.replayEvents(clientId, normalizedBusinessId, lastEventId);
    }

    // Start heartbeat for this client
    this.startClientHeartbeat(clientId);

    // Handle client disconnect
    req.on("close", () => this.handleDisconnect(clientId));
    req.on("error", (error) => this.handleError(clientId, error));
  }

  /**
   * Handle client disconnect
   */
  handleDisconnect(clientId) {
    const client = this.clients.get(clientId);
    if (client) {
      // Stop heartbeat
      this.stopClientHeartbeat(clientId);

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

      console.log(`[SSEManager] Client disconnected: ${clientId}`);
    }
  }

  /**
   * Handle client error
   */
  handleError(clientId, error) {
    console.error(`[SSEManager] Client ${clientId} error:`, error.message);
    this.handleDisconnect(clientId);
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
   * Send SSE event to response stream
   */
  sendEvent(res, eventType, data, eventId = null) {
    if (!res.writable) return false;

    try {
      const id =
        eventId || `${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;

      let message = "";
      message += `id: ${id}\n`;
      message += `event: ${eventType}\n`;
      message += `data: ${JSON.stringify(data)}\n\n`;

      res.write(message);
      return true;
    } catch (error) {
      console.error("[SSEManager] Error sending event:", error);
      return false;
    }
  }

  /**
   * Send to specific client
   */
  sendToClient(clientId, eventType, data) {
    const client = this.clients.get(clientId);
    if (!client) return false;

    const eventId =
      data?.id || `${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;

    // Store in history for replay
    this.storeEvent(client.businessId, eventId, eventType, data);

    return this.sendEvent(client.res, eventType, data, eventId);
  }

  /**
   * Broadcast to all clients of a business
   */
  broadcastToBusiness(businessId, eventType, data) {
    const normalizedBusinessId = businessId?.toString
      ? businessId.toString()
      : String(businessId);
    const clientIds = this.businessClients.get(normalizedBusinessId);

    console.log(
      `[SSEManager] Broadcasting to business ${normalizedBusinessId}: eventType=${eventType}, clientCount=${clientIds?.size || 0}`,
    );

    if (!clientIds || clientIds.size === 0) {
      console.log(
        `[SSEManager] No SSE clients for business ${normalizedBusinessId}, event dropped`,
      );
      return 0;
    }

    const eventId =
      data?.id || `${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;

    // Store in history
    this.storeEvent(normalizedBusinessId, eventId, eventType, data);

    let sentCount = 0;
    clientIds.forEach((clientId) => {
      const client = this.clients.get(clientId);
      if (client && this.sendEvent(client.res, eventType, data, eventId)) {
        sentCount++;
      }
    });

    console.log(
      `[SSEManager] Sent ${eventType} event to ${sentCount} SSE clients for business ${normalizedBusinessId}`,
    );
    return sentCount;
  }

  /**
   * Store event in history for replay
   */
  storeEvent(businessId, eventId, eventType, data) {
    if (!this.eventHistory.has(businessId)) {
      this.eventHistory.set(businessId, []);
    }

    const history = this.eventHistory.get(businessId);
    history.push({
      id: eventId,
      type: eventType,
      data,
      timestamp: Date.now(),
    });

    // Trim history if too large
    if (history.length > this.maxHistoryPerBusiness) {
      history.splice(0, history.length - this.maxHistoryPerBusiness);
    }
  }

  /**
   * Replay missed events for reconnecting client
   */
  replayEvents(clientId, businessId, lastEventId) {
    const history = this.eventHistory.get(businessId);
    if (!history || history.length === 0) return;

    const client = this.clients.get(clientId);
    if (!client) return;

    // Find index of last received event
    const lastIndex = history.findIndex((e) => e.id === lastEventId);

    if (lastIndex === -1) {
      // Event not found in history, client is too far behind
      this.sendEvent(client.res, "replay_failed", {
        message: "Too many missed events, full refresh recommended",
        missedCount: history.length,
      });
      return;
    }

    // Replay all events after the last received one
    const missedEvents = history.slice(lastIndex + 1);

    console.log(
      `[SSEManager] Replaying ${missedEvents.length} events for client ${clientId}`,
    );

    missedEvents.forEach((event) => {
      this.sendEvent(client.res, event.type, event.data, event.id);
    });

    this.sendEvent(client.res, "replay_complete", {
      replayedCount: missedEvents.length,
    });
  }

  /**
   * Start heartbeat for client
   */
  startClientHeartbeat(clientId) {
    const timer = setInterval(() => {
      const client = this.clients.get(clientId);
      if (client) {
        // Send heartbeat comment (SSE comment starts with :)
        try {
          if (client.res.writable) {
            client.res.write(`: heartbeat ${Date.now()}\n\n`);
          } else {
            this.handleDisconnect(clientId);
          }
        } catch (error) {
          this.handleDisconnect(clientId);
        }
      } else {
        this.stopClientHeartbeat(clientId);
      }
    }, this.heartbeatInterval);

    this.heartbeatTimers.set(clientId, timer);
  }

  /**
   * Stop heartbeat for client
   */
  stopClientHeartbeat(clientId) {
    const timer = this.heartbeatTimers.get(clientId);
    if (timer) {
      clearInterval(timer);
      this.heartbeatTimers.delete(clientId);
    }
  }

  /**
   * Generate unique client ID
   */
  generateClientId() {
    return `sse_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
  }

  /**
   * Get connection statistics
   */
  getStats() {
    return {
      totalClients: this.clients.size,
      businessCount: this.businessClients.size,
      clientsByBusiness: Object.fromEntries(
        Array.from(this.businessClients.entries()).map(([id, set]) => [
          id,
          set.size,
        ]),
      ),
      eventHistorySize: Object.fromEntries(
        Array.from(this.eventHistory.entries()).map(([id, arr]) => [
          id,
          arr.length,
        ]),
      ),
    };
  }

  /**
   * Initialize SSE manager with event bus listener
   */
  initialize() {
    // Listen to event bus for business events (idempotent registration)
    eventBus.off("business_event", this.businessEventListener);
    eventBus.on("business_event", this.businessEventListener);

    console.log("[SSEManager] SSE manager initialized");
    return this;
  }

  /**
   * Graceful shutdown
   */
  shutdown() {
    // Detach event bus listener
    eventBus.off("business_event", this.businessEventListener);

    // Stop all heartbeats
    this.heartbeatTimers.forEach((timer, clientId) => {
      clearInterval(timer);
    });
    this.heartbeatTimers.clear();

    // Notify and close all clients
    this.clients.forEach((client, clientId) => {
      try {
        this.sendEvent(client.res, "shutdown", {
          message: "Server shutting down",
          reconnectIn: 5000,
        });
        client.res.end();
      } catch (error) {
        // Ignore errors during shutdown
      }
    });

    this.clients.clear();
    this.businessClients.clear();

    console.log("[SSEManager] Shutdown complete");
  }
}

// Create and export singleton
const sseManager = new SSEManager();

module.exports = { SSEManager, sseManager };
