const fs = require("fs");
const path = require("path");
const { EventTypes: backendEventTypes } = require("../../events/EventEmitter");

const frontendRealtimeSlicePath = path.join(
  __dirname,
  "..",
  "..",
  "client",
  "src",
  "redux",
  "features",
  "realtime",
  "realtimeSlice.js",
);

const extractFrontendEventTypes = () => {
  const source = fs.readFileSync(frontendRealtimeSlicePath, "utf8");
  const match = source.match(/export const EventTypes\s*=\s*\{([\s\S]*?)\n\};/);

  if (!match) {
    throw new Error("Could not locate EventTypes object in frontend realtimeSlice.js");
  }

  const body = match[1];
  const result = {};

  const pairRegex = /\s*([A-Z0-9_]+):\s*"([^"]+)"\s*,?/g;
  let pair;
  while ((pair = pairRegex.exec(body)) !== null) {
    result[pair[1]] = pair[2];
  }

  return result;
};

describe("EventTypes contract parity", () => {
  test("critical frontend event constants match backend EventEmitter constants", () => {
    const frontendEventTypes = extractFrontendEventTypes();

    const criticalKeys = [
      // Cart/Sale flows
      "CART_UPDATED",
      "CART_ITEM_ADDED",
      "CART_ITEM_REMOVED",
      "CART_CLEARED",
      "SALE_COMPLETED",
      "CHECKOUT_COMPLETED",
      "SALE_REFUNDED",

      // Auth/session lifecycle
      "SESSION_EXPIRED",
      "USER_LOGGED_OUT",
      "ROLE_CHANGED",
      "ACCOUNT_SUSPENDED",
      "PERMISSIONS_UPDATED",

      // Inventory mutation flows
      "PRODUCT_CREATED",
      "PRODUCT_UPDATED",
      "PRODUCT_DELETED",
      "PRODUCT_GROUP_CREATED",
      "PRODUCT_GROUP_UPDATED",
      "PRODUCT_GROUP_DELETED",
      "PRODUCT_GROUP_BULK_DELETED",

      // Marketplace flows
      "MARKETPLACE_LISTING_UPDATED",
      "MARKETPLACE_ORDER_PLACED",
      "MARKETPLACE_ORDER_PAYMENT_CONFIRMED",
      "MARKETPLACE_ORDER_ACCEPTED",
      "MARKETPLACE_ORDER_REJECTED",
      "MARKETPLACE_ORDER_PROCESSING",
      "MARKETPLACE_ORDER_SHIPPED",
      "MARKETPLACE_ORDER_DELIVERED",
      "MARKETPLACE_ORDER_LINE_UPDATED",
      "MARKETPLACE_WEBHOOK_DELIVERY_SUCCEEDED",
      "MARKETPLACE_WEBHOOK_DELIVERY_FAILED",

      // Secondary cache flows
      "BUSINESS_UPDATED",
      "STATS_UPDATED",
      "ACTIVITY_LOGGED",
      "EXPENSE_CREATED",
      "EXPENSE_UPDATED",
      "EXPENSE_DELETED",
      "DISCOUNT_CREATED",
      "DISCOUNT_UPDATED",
      "DISCOUNT_DELETED",
    ];

    criticalKeys.forEach((key) => {
      expect(frontendEventTypes[key]).toBeDefined();
      expect(backendEventTypes[key]).toBeDefined();
      expect(frontendEventTypes[key]).toBe(backendEventTypes[key]);
    });
  });
});
