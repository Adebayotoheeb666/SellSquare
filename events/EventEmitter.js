/**
 * Central Event Emitter System
 *
 * This module provides a centralized event system for the application.
 * It emits events when data changes occur (products, inventory, pricing, auth, etc.)
 * and handles event delivery via WebSocket/SSE to connected clients.
 *
 * Features:
 * - Event payload schemas with versioning
 * - Idempotency handling via event IDs
 * - Retry logic with exponential backoff
 * - Event ordering guarantees
 * - HMAC signature for security
 */

const EventEmitter = require("events");
const crypto = require("crypto");

// Event types enumeration
const EventTypes = {
  // Product events
  PRODUCT_CREATED: "product.created",
  PRODUCT_UPDATED: "product.updated",
  PRODUCT_DELETED: "product.deleted",
  PRODUCT_SOLD: "product.sold",
  PRODUCT_STOCK_CHANGED: "product.stock_changed",

  // Product Group events
  PRODUCT_GROUP_CREATED: "product_group.created",
  PRODUCT_GROUP_UPDATED: "product_group.updated",
  PRODUCT_GROUP_DELETED: "product_group.deleted",
  PRODUCT_GROUP_BULK_DELETED: "product_group.bulk_deleted",

  // Inventory events
  INVENTORY_LOW_STOCK: "inventory.low_stock",
  INVENTORY_OUT_OF_STOCK: "inventory.out_of_stock",
  INVENTORY_RESTOCKED: "inventory.restocked",

  // Cart events
  CART_UPDATED: "cart.updated",
  CART_ITEM_ADDED: "cart.item_added",
  CART_ITEM_REMOVED: "cart.item_removed",
  CART_CLEARED: "cart.cleared",

  // Sales events
  SALE_COMPLETED: "sale.completed",
  SALE_REFUNDED: "sale.refunded",
  CHECKOUT_COMPLETED: "checkout.completed",

  // Auth events
  SESSION_EXPIRED: "auth.session_expired",
  USER_LOGGED_OUT: "auth.user_logged_out",
  ROLE_CHANGED: "auth.role_changed",
  ACCOUNT_SUSPENDED: "auth.account_suspended",
  PERMISSIONS_UPDATED: "auth.permissions_updated",

  // Business events
  BUSINESS_UPDATED: "business.updated",
  SALES_REP_ADDED: "business.sales_rep_added",
  SALES_REP_REMOVED: "business.sales_rep_removed",

  // KYC/Verification events
  KYC_SUBMITTED: "kyc.submitted",
  KYC_VERIFIED: "kyc.verified",
  KYC_REJECTED: "kyc.rejected",

  // Dashboard events
  STATS_UPDATED: "dashboard.stats_updated",

  // Activity events
  ACTIVITY_LOGGED: "activity.logged",

  // Expense events
  EXPENSE_CREATED: "expense.created",
  EXPENSE_UPDATED: "expense.updated",
  EXPENSE_DELETED: "expense.deleted",
  
  // Discount events
  DISCOUNT_CREATED: "discount.created",
  DISCOUNT_UPDATED: "discount.updated",
  DISCOUNT_DELETED: "discount.deleted",

  // Marketplace listing events
  MARKETPLACE_LISTING_UPDATED: "marketplace.listing.updated",

  // Marketplace order events
  MARKETPLACE_ORDER_PLACED: "marketplace.order.placed",
  MARKETPLACE_ORDER_PAYMENT_CONFIRMED: "marketplace.order.payment_confirmed",
  MARKETPLACE_ORDER_ACCEPTED: "marketplace.order.accepted",
  MARKETPLACE_ORDER_REJECTED: "marketplace.order.rejected",
  MARKETPLACE_ORDER_PROCESSING: "marketplace.order.processing",
  MARKETPLACE_ORDER_SHIPPED: "marketplace.order.shipped",
  MARKETPLACE_ORDER_DELIVERED: "marketplace.order.delivered",
  MARKETPLACE_ORDER_LINE_UPDATED: "marketplace.order.line.updated",

  // Marketplace webhook delivery events
  MARKETPLACE_WEBHOOK_DELIVERY_SUCCEEDED: "marketplace.webhook.delivery_succeeded",
  MARKETPLACE_WEBHOOK_DELIVERY_FAILED: "marketplace.webhook.delivery_failed",

  // Application events
  APPLICATION_SUBMITTED: "application.submitted",
  APPLICATION_STATUS_CHANGED: "application.status_changed",
  APPLICATION_BRIEF_SENT: "application.brief_sent",
  APPLICATION_BRIEF_SUBMITTED: "application.brief_submitted",
  APPLICATION_EMAIL_SENT: "application.email_sent",
};

// Event schema version
const SCHEMA_VERSION = "1.0.0";

// Generate unique event ID for idempotency
const generateEventId = () => {
  return `evt_${Date.now()}_${crypto.randomBytes(8).toString("hex")}`;
};

// Generate HMAC signature for event payload
const generateSignature = (payload, secret) => {
  const hmac = crypto.createHmac(
    "sha256",
    secret || process.env.EVENT_SECRET || "default-secret",
  );
  hmac.update(JSON.stringify(payload));
  return hmac.digest("hex");
};

// Verify event signature
const verifySignature = (payload, signature, secret) => {
  const expectedSignature = generateSignature(payload, secret);
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature),
  );
};

// Event payload factory
const createEventPayload = (eventType, data, metadata = {}) => {
  const timestamp = Date.now();
  const eventId = generateEventId();

  const payload = {
    id: eventId,
    type: eventType,
    version: SCHEMA_VERSION,
    timestamp,
    data,
    metadata: {
      ...metadata,
      source: metadata.source || "inventory-app",
      environment: process.env.NODE_ENV || "development",
    },
  };

  // Add signature for secure delivery
  payload.signature = generateSignature(payload, process.env.EVENT_SECRET);

  return payload;
};

// Main Event Bus class
class EventBus extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(100); // Increase max listeners for many connected clients

    // Event history for replay-attack protection (stores last 1000 event IDs)
    this.processedEvents = new Map();
    this.maxEventHistory = 1000;

    // Pending events for retry logic
    this.pendingRetries = new Map();

    // Event ordering - sequence number per business
    this.sequenceNumbers = new Map();

    // Connected clients tracking
    this.connectedClients = new Map();

    // Event batching
    this.eventBatches = new Map();
    this.batchInterval = 100; // ms
    this.batchSize = 10;

    // Cross-source semantic dedupe (middleware vs change stream)
    this.semanticEvents = new Map();
    this.semanticDedupeWindowMs = 2000;
  }

  shouldSkipSemanticDuplicate(eventType, businessId, data, metadata = {}) {
    const source = String(metadata?.source || "");
    if (!source) return false;

    const supportsCrossSourceDedupe = source === "event_middleware" || source === "change_stream";
    if (!supportsCrossSourceDedupe) return false;

    const primaryId =
      metadata?.dedupeKey
      || (data?._id ? `${eventType}:${String(data._id)}` : "");

    if (!primaryId) return false;

    const semanticKey = `${businessId}:${primaryId}`;
    const now = Date.now();
    const seen = this.semanticEvents.get(semanticKey);

    if (
      seen
      && seen.source !== source
      && now - seen.timestamp <= this.semanticDedupeWindowMs
    ) {
      return true;
    }

    this.semanticEvents.set(semanticKey, {
      source,
      timestamp: now,
    });

    if (this.semanticEvents.size > this.maxEventHistory) {
      const entries = Array.from(this.semanticEvents.entries());
      entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
      const toRemove = entries.slice(0, entries.length - this.maxEventHistory);
      toRemove.forEach(([key]) => this.semanticEvents.delete(key));
    }

    return false;
  }

  // Get next sequence number for a business
  getNextSequence(businessId) {
    const current = this.sequenceNumbers.get(businessId) || 0;
    const next = current + 1;
    this.sequenceNumbers.set(businessId, next);
    return next;
  }

  // Check if event was already processed (idempotency)
  isEventProcessed(eventId) {
    return this.processedEvents.has(eventId);
  }

  // Mark event as processed
  markEventProcessed(eventId) {
    this.processedEvents.set(eventId, Date.now());

    // Cleanup old events if we exceed max history
    if (this.processedEvents.size > this.maxEventHistory) {
      const entries = Array.from(this.processedEvents.entries());
      entries.sort((a, b) => a[1] - b[1]);
      const toRemove = entries.slice(0, entries.length - this.maxEventHistory);
      toRemove.forEach(([id]) => this.processedEvents.delete(id));
    }
  }

  // Emit business event with ordering and signature
  emitBusinessEvent(eventType, businessId, data, metadata = {}) {
    const normalizedBusinessId = businessId?.toString
      ? businessId.toString()
      : String(businessId);

    if (this.shouldSkipSemanticDuplicate(eventType, normalizedBusinessId, data, metadata)) {
      return null;
    }

    const sequence = this.getNextSequence(normalizedBusinessId);

    const enrichedMetadata = {
      ...metadata,
      businessId: normalizedBusinessId,
      sequence,
    };

    const payload = createEventPayload(eventType, data, enrichedMetadata);

    // Check for duplicate event
    if (this.isEventProcessed(payload.id)) {
      console.log(`[EventBus] Duplicate event detected: ${payload.id}`);
      return null;
    }

    this.markEventProcessed(payload.id);

    // Add to batch for coalescing
    this.addToBatch(normalizedBusinessId, payload);

    return payload;
  }

  // Emit buyer event (no batching, directly emit)
  emitBuyerEvent(eventType, buyerId, data, metadata = {}) {
    const normalizedBuyerId = buyerId?.toString
      ? buyerId.toString()
      : String(buyerId);

    const enrichedMetadata = {
      ...metadata,
      buyerId: normalizedBuyerId,
    };

    const payload = createEventPayload(eventType, data, enrichedMetadata);

    // Check for duplicate event
    if (this.isEventProcessed(payload.id)) {
      console.log(`[EventBus] Duplicate buyer event detected: ${payload.id}`);
      return null;
    }

    this.markEventProcessed(payload.id);

    // Emit immediately without batching
    this.emit("buyer_event", normalizedBuyerId, payload);
    this.emit(payload.type, normalizedBuyerId, payload);

    return payload;
  }

  // Batch events for coalescing rapid updates
  addToBatch(businessId, payload) {
    if (!this.eventBatches.has(businessId)) {
      this.eventBatches.set(businessId, []);

      // Schedule batch flush
      setTimeout(() => {
        this.flushBatch(businessId);
      }, this.batchInterval);
    }

    const batch = this.eventBatches.get(businessId);
    batch.push(payload);

    // Flush immediately if batch is full
    if (batch.length >= this.batchSize) {
      this.flushBatch(businessId);
    }
  }

  // Flush batched events
  flushBatch(businessId) {
    const batch = this.eventBatches.get(businessId);
    if (!batch || batch.length === 0) return;

    // Coalesce similar events (e.g., multiple stock updates to same product)
    const coalescedEvents = this.coalesceEvents(batch);

    // Emit all events
    coalescedEvents.forEach((payload) => {
      this.emit("business_event", businessId, payload);
      this.emit(payload.type, businessId, payload);
    });

    // Clear batch
    this.eventBatches.delete(businessId);
  }

  // Coalesce similar events to reduce update frequency
  coalesceEvents(events) {
    const coalesced = new Map();

    events.forEach((event) => {
      // For stock changes, only keep the latest per product
      if (
        event.type === EventTypes.PRODUCT_STOCK_CHANGED ||
        event.type === EventTypes.PRODUCT_UPDATED
      ) {
        const key = `${event.type}:${event.data?.productId || event.data?._id}`;
        coalesced.set(key, event);
      } else if (event.type === EventTypes.CART_UPDATED) {
        // Only keep latest cart update
        const key = `${event.type}:${event.metadata?.userId}`;
        coalesced.set(key, event);
      } else {
        // Keep all other events
        coalesced.set(event.id, event);
      }
    });

    return Array.from(coalesced.values());
  }

  // Register client connection
  registerClient(clientId, businessId, socket) {
    this.connectedClients.set(clientId, {
      businessId,
      socket,
      connectedAt: Date.now(),
      lastHeartbeat: Date.now(),
    });

    console.log(
      `[EventBus] Client registered: ${clientId} for business: ${businessId}`,
    );
  }

  // Unregister client
  unregisterClient(clientId) {
    this.connectedClients.delete(clientId);
    console.log(`[EventBus] Client unregistered: ${clientId}`);
  }

  // Get clients for a business
  getBusinessClients(businessId) {
    return Array.from(this.connectedClients.entries())
      .filter(([, client]) => client.businessId === businessId)
      .map(([id, client]) => ({ id, ...client }));
  }

  // Schedule retry with exponential backoff
  scheduleRetry(eventId, businessId, payload, attempt = 1) {
    const maxAttempts = 5;
    const baseDelay = 1000; // 1 second

    if (attempt > maxAttempts) {
      console.error(`[EventBus] Max retries exceeded for event: ${eventId}`);
      this.pendingRetries.delete(eventId);
      return;
    }

    const delay = baseDelay * Math.pow(2, attempt - 1); // Exponential backoff

    const timeoutId = setTimeout(() => {
      this.emitToClients(businessId, payload);
      this.pendingRetries.delete(eventId);
    }, delay);

    this.pendingRetries.set(eventId, {
      timeoutId,
      attempt,
      businessId,
      payload,
    });
  }

  // Cancel pending retry
  cancelRetry(eventId) {
    const retry = this.pendingRetries.get(eventId);
    if (retry) {
      clearTimeout(retry.timeoutId);
      this.pendingRetries.delete(eventId);
    }
  }

  // Emit to all clients of a business
  emitToClients(businessId, payload) {
    const clients = this.getBusinessClients(businessId);

    clients.forEach((client) => {
      try {
        if (client.socket && typeof client.socket.emit === "function") {
          client.socket.emit("event", payload);
        }
      } catch (error) {
        console.error(
          `[EventBus] Error sending to client ${client.id}:`,
          error,
        );
      }
    });
  }
}

// Create singleton instance
const eventBus = new EventBus();

// Export everything
module.exports = {
  eventBus,
  EventTypes,
  createEventPayload,
  generateSignature,
  verifySignature,
  SCHEMA_VERSION,
};
