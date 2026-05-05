/**
 * MongoDB Change Stream Manager
 *
 * Manages MongoDB Change Streams for real-time database monitoring.
 * When documents are inserted, updated, or deleted, changes are immediately
 * captured and broadcast to connected clients via WebSocket/SSE.
 *
 * Features:
 * - Per-collection change stream initialization
 * - Business-scoped event broadcasting
 * - Automatic reconnection on stream disconnect
 * - Memory-efficient stream management
 * - Error handling and logging
 */

const { eventBus, EventTypes } = require("./EventEmitter");
const { logChangeStream } = require("../utils/serverLogger");

class ChangeStreamManager {
  constructor() {
    this.streams = new Map(); // collectionName -> changeStream
    this.watchers = new Map(); // collectionName -> { resumeToken, isActive }
  }

  /**
   * Initialize change stream for a specific collection
   * @param {String} collectionName - Name of the collection to watch
   * @param {Object} collection - Mongoose model.collection reference
   * @param {Function} onChangeCallback - Optional callback for document changes
   */
  initializeStream(collectionName, collection, onChangeCallback = null) {
    if (!collection) {
      console.error(
        `[ChangeStreamManager] Collection ${collectionName} not available`,
      );
      return;
    }

    if (this.streams.has(collectionName)) {
      logChangeStream(
        `[ChangeStreamManager] Stream already initialized for ${collectionName}`,
      );
      return;
    }

    try {
      // Create change stream with pipeline to filter operations
      const pipeline = [
        {
          $match: {
            // Monitor all change types
            operationType: {
              $in: ["insert", "update", "delete", "replace"],
            },
          },
        },
      ];

      const changeStream = collection.watch(pipeline, {
        fullDocument: "updateLookup", // Include full document for updates
        resumeAfter:
          this.watchers.get(collectionName)?.resumeToken || undefined,
      });

      // Handle stream data
      changeStream.on("change", (change) => {
        try {
          this.handleChange(collectionName, change, onChangeCallback);
        } catch (error) {
          console.error(
            `[ChangeStreamManager] Error handling change for ${collectionName}:`,
            error,
          );
        }
      });

      // Handle stream errors
      changeStream.on("error", (error) => {
        console.error(
          `[ChangeStreamManager] Error on stream for ${collectionName}:`,
          error,
        );
        this.streams.delete(collectionName);
        this.watchers.delete(collectionName);

        // Attempt to reinitialize after delay
        setTimeout(() => {
          logChangeStream(
            `[ChangeStreamManager] Attempting to reinitialize stream for ${collectionName}`,
          );
          this.initializeStream(collectionName, collection, onChangeCallback);
        }, 5000);
      });

      // Handle stream close
      changeStream.on("close", () => {
        logChangeStream(
          `[ChangeStreamManager] Stream closed for ${collectionName}`,
        );
        this.streams.delete(collectionName);
      });

      // Store stream info
      this.streams.set(collectionName, changeStream);
      this.watchers.set(collectionName, {
        resumeToken: undefined,
        isActive: true,
      });

      logChangeStream(
        `[ChangeStreamManager] Successfully initialized stream for ${collectionName}`,
      );
    } catch (error) {
      console.error(
        `[ChangeStreamManager] Failed to initialize stream for ${collectionName}:`,
        error,
      );
    }
  }

  /**
   * Handle change events and broadcast to connected clients
   * @param {String} collectionName - Name of the collection
   * @param {Object} change - Change stream document
   * @param {Function} onChangeCallback - Optional custom callback
   */
  handleChange(collectionName, change, onChangeCallback = null) {
    const { operationType, fullDocument, documentKey, updateDescription } =
      change;

    logChangeStream(
      `[ChangeStreamManager] Change detected in ${collectionName}: ${JSON.stringify(
        {
          operationType,
          documentId: documentKey._id,
          hasFullDocument: !!fullDocument,
        },
      )}`,
    );

    // Extract business ID from document
    let businessId = null;

    if (fullDocument?.business) {
      businessId =
        fullDocument.business._id || fullDocument.business.toString();
    } else if (change.operationDescription?.documentKey?.business) {
      businessId =
        change.operationDescription.documentKey.business._id ||
        change.operationDescription.documentKey.business.toString();
    }

    // For businesses collection, the document's _id IS the businessId
    if (!businessId && collectionName.toLowerCase() === "businesses") {
      businessId = documentKey._id || fullDocument?._id;
    }

    // Normalize businessId to string for consistent Map lookups
    if (businessId) {
      businessId = businessId.toString
        ? businessId.toString()
        : String(businessId);
    }

    // For delete operations, fullDocument is null
    // We rely on event middleware to emit delete events with proper business context
    if (!businessId && operationType === "delete") {
      logChangeStream(
        `[ChangeStreamManager] Delete operation in ${collectionName} - skipping (event middleware will handle)`,
      );
      return;
    }

    if (!businessId) {
      console.warn(
        `[ChangeStreamManager] Could not extract businessId from change in ${collectionName}`,
        { operationType, documentKey },
      );
      return;
    }

    logChangeStream(
      `[ChangeStreamManager] Extracted businessId: ${businessId}`,
    );

    // Determine event type based on operation and collection
    let eventType = null;
    let eventData = null;

    switch (collectionName.toLowerCase()) {
      case "expenses":
        eventType = getExpenseEventType(operationType);
        eventData = {
          _id: documentKey._id,
          ...fullDocument,
        };
        break;

      case "products":
        eventType = getProductEventType(operationType);
        eventData = {
          _id: documentKey._id,
          ...fullDocument,
        };
        break;

      case "productgroups":
        eventType = getProductGroupEventType(operationType);
        eventData = {
          _id: documentKey._id,
          ...fullDocument,
        };
        break;

      case "discounts":
        eventType = getDiscountEventType(operationType);
        eventData = {
          _id: documentKey._id,
          ...fullDocument,
        };
        break;

      case "checkouts":
      case "sales":
        eventType = getSaleEventType(operationType);
        eventData = {
          _id: documentKey._id,
          ...fullDocument,
        };
        break;

      case "carts":
        eventType = getCartEventType(operationType);
        eventData = {
          _id: documentKey._id,
          ...fullDocument,
        };
        break;

      case "activities":
        eventType = EventTypes.ACTIVITY_LOGGED;
        eventData = {
          _id: documentKey._id,
          ...fullDocument,
        };
        break;

      case "businesses":
        eventType = EventTypes.BUSINESS_UPDATED;
        eventData = {
          _id: documentKey._id,
          ...fullDocument,
        };
        break;

      default:
        // Generic collection change - emit as data_changed
        eventType = `${collectionName}.changed`;
        eventData = {
          _id: documentKey._id,
          ...fullDocument,
        };
    }

    if (!eventType) return;

    // Broadcast to business clients
    const metadata = {
      source: "change_stream",
      collectionName,
      operationType,
      changeStreamId: change._id?.toString(),
      dedupeKey: eventData?._id ? `${eventType}:${String(eventData._id)}` : "",
    };

    logChangeStream(
      `[ChangeStreamManager] Broadcasting event: ${JSON.stringify({
        eventType,
        businessId: businessId,
        businessIdType: typeof businessId,
        documentId: eventData?._id,
      })}`,
    );

    eventBus.emitBusinessEvent(eventType, businessId, eventData, metadata);

    // Call optional custom callback
    if (typeof onChangeCallback === "function") {
      try {
        onChangeCallback({
          collectionName,
          operationType,
          documentKey,
          fullDocument,
          updateDescription,
          eventType,
          businessId,
        });
      } catch (error) {
        console.error(
          "[ChangeStreamManager] Error in callback for",
          collectionName,
          error,
        );
      }
    }
  }

  /**
   * Close all change streams and cleanup
   */
  closeAll() {
    for (const [collectionName, stream] of this.streams.entries()) {
      try {
        stream.close();
        logChangeStream(
          `[ChangeStreamManager] Closed stream for ${collectionName}`,
        );
      } catch (error) {
        console.error(
          `[ChangeStreamManager] Error closing stream for ${collectionName}:`,
          error,
        );
      }
    }
    this.streams.clear();
    this.watchers.clear();
  }

  /**
   * Close stream for specific collection
   */
  closeStream(collectionName) {
    const stream = this.streams.get(collectionName);
    if (stream) {
      try {
        stream.close();
        this.streams.delete(collectionName);
        this.watchers.delete(collectionName);
        logChangeStream(
          `[ChangeStreamManager] Closed stream for ${collectionName}`,
        );
      } catch (error) {
        console.error(
          `[ChangeStreamManager] Error closing stream for ${collectionName}:`,
          error,
        );
      }
    }
  }

  /**
   * Get stream status for monitoring
   */
  getStatus() {
    const status = {};
    for (const [collectionName, watcher] of this.watchers.entries()) {
      status[collectionName] = {
        isActive: watcher.isActive,
        hasStream: this.streams.has(collectionName),
      };
    }
    return status;
  }
}

/**
 * Helper functions to determine event types
 */
function getExpenseEventType(operationType) {
  switch (operationType) {
    case "insert":
      return EventTypes.EXPENSE_CREATED;
    case "update":
    case "replace":
      return EventTypes.EXPENSE_UPDATED;
    case "delete":
      return EventTypes.EXPENSE_DELETED;
    default:
      return null;
  }
}

function getProductEventType(operationType) {
  switch (operationType) {
    case "insert":
      return EventTypes.PRODUCT_CREATED;
    case "update":
    case "replace":
      return EventTypes.PRODUCT_UPDATED;
    case "delete":
      return EventTypes.PRODUCT_DELETED;
    default:
      return null;
  }
}

function getProductGroupEventType(operationType) {
  switch (operationType) {
    case "insert":
      return EventTypes.PRODUCT_GROUP_CREATED;
    case "update":
    case "replace":
      return EventTypes.PRODUCT_GROUP_UPDATED;
    case "delete":
      return EventTypes.PRODUCT_GROUP_DELETED;
    default:
      return null;
  }
}

function getSaleEventType(operationType) {
  switch (operationType) {
    case "insert":
      return EventTypes.CHECKOUT_COMPLETED;
    case "update":
    case "replace":
      return EventTypes.SALE_COMPLETED;
    case "delete":
      return EventTypes.SALE_REFUNDED;
    default:
      return null;
  }
}

function getCartEventType(operationType) {
  switch (operationType) {
    case "insert":
      return EventTypes.CART_UPDATED;
    case "update":
    case "replace":
      return EventTypes.CART_UPDATED;
    case "delete":
      return EventTypes.CART_CLEARED;
    default:
      return null;
  }
}

function getDiscountEventType(operationType) {
  switch (operationType) {
    case "insert":
      return EventTypes.DISCOUNT_CREATED;
    case "update":
    case "replace":
      return EventTypes.DISCOUNT_UPDATED;
    case "delete":
      return EventTypes.DISCOUNT_DELETED;
    default:
      return null;
  }
}

// Create singleton instance
const changeStreamManager = new ChangeStreamManager();

module.exports = {
  changeStreamManager,
  ChangeStreamManager,
};
