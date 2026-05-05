/**
 * Events Module Index
 *
 * Exports all event-related functionality for the application.
 */

const {
  eventBus,
  EventTypes,
  createEventPayload,
  generateSignature,
  verifySignature,
  SCHEMA_VERSION,
} = require("./EventEmitter");
const { wsManager, WebSocketManager } = require("./WebSocketManager");
const { sseManager, SSEManager } = require("./SSEManager");
const {
  changeStreamManager,
  ChangeStreamManager,
} = require("./ChangeStreamManager");
const {
  createEventMiddleware,
  productEventMiddleware,
  productGroupEventMiddleware,
  cartEventMiddleware,
  saleEventMiddleware,
  expenseEventMiddleware,
  authEventMiddleware,
  businessEventMiddleware,
  applicationEventMiddleware,
  kycEventMiddleware,
} = require("./eventMiddleware");

module.exports = {
  // Core event system
  eventBus,
  EventTypes,
  createEventPayload,
  generateSignature,
  verifySignature,
  SCHEMA_VERSION,

  // WebSocket manager
  wsManager,
  WebSocketManager,

  // SSE manager
  sseManager,
  SSEManager,

  // Change Stream Manager - MongoDB real-time monitoring
  changeStreamManager,
  ChangeStreamManager,

  // Middleware
  createEventMiddleware,
  productEventMiddleware,
  productGroupEventMiddleware,
  cartEventMiddleware,
  saleEventMiddleware,
  expenseEventMiddleware,
  authEventMiddleware,
  businessEventMiddleware,
  applicationEventMiddleware,
  kycEventMiddleware,
};
