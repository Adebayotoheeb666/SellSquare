/**
 * Realtime Redux Slice
 *
 * Manages realtime connection state and handles incoming events
 * to update the Redux store. This is the central hub for all
 * server-pushed updates.
 */

import { createSlice } from "@reduxjs/toolkit";
import {
  addBulkCacheItem,
  updateBulkCacheItem,
  removeBulkCacheItem,
  invalidateBulkCache,
  addOutOfStockProduct,
  removeOutOfStockProduct,
  addOutOfStockGroup,
  removeOutOfStockGroup,
} from "../dataCache/bulkDataCacheSlice";
import { setDashboardStats } from "../product/productSlice";
import { BOOTSTRAP_DATA } from "../dataCache/dataCacheSlice";
import {
  invalidateProductCache,
} from "../product/productCacheSlice";
import {
  addApplicationToCache,
  updateApplicationInCache,
} from "../admin/adminSlice";

// Event type constants (must match backend EventTypes)
export const EventTypes = {
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

  // Marketplace listing/order events
  MARKETPLACE_LISTING_UPDATED: "marketplace.listing.updated",
  MARKETPLACE_ORDER_PLACED: "marketplace.order.placed",
  MARKETPLACE_ORDER_PAYMENT_CONFIRMED: "marketplace.order.payment_confirmed",
  MARKETPLACE_ORDER_ACCEPTED: "marketplace.order.accepted",
  MARKETPLACE_ORDER_REJECTED: "marketplace.order.rejected",
  MARKETPLACE_ORDER_PROCESSING: "marketplace.order.processing",
  MARKETPLACE_ORDER_SHIPPED: "marketplace.order.shipped",
  MARKETPLACE_ORDER_DELIVERED: "marketplace.order.delivered",
  MARKETPLACE_ORDER_LINE_UPDATED: "marketplace.order.line.updated",
  MARKETPLACE_WEBHOOK_DELIVERY_SUCCEEDED:
    "marketplace.webhook.delivery_succeeded",
  MARKETPLACE_WEBHOOK_DELIVERY_FAILED: "marketplace.webhook.delivery_failed",

  // Application events
  APPLICATION_SUBMITTED: "application.submitted",
  APPLICATION_STATUS_CHANGED: "application.status_changed",
  APPLICATION_BRIEF_SENT: "application.brief_sent",
  APPLICATION_BRIEF_SUBMITTED: "application.brief_submitted",
  APPLICATION_EMAIL_SENT: "application.email_sent",
};

// Connection states
export const ConnectionStatus = {
  DISCONNECTED: "disconnected",
  CONNECTING: "connecting",
  CONNECTED: "connected",
  RECONNECTING: "reconnecting",
  ERROR: "error",
};

const initialState = {
  connectionStatus: ConnectionStatus.DISCONNECTED,
  lastConnectedAt: null,
  lastEventTimestamp: null,
  reconnectAttempts: 0,

  lastEventId: null,
  processedEventIds: [], // For idempotency (keep last 100)

  // Cache invalidation flags
  cacheInvalidation: {
    products: false,
    productGroups: false,
    sales: false,
    cart: false,
    dashboard: false,
    expenses: false,
    activities: false,
    marketplaceOrders: false,
  },

  // Pending optimistic updates to reconcile
  pendingUpdates: [],

  // Error tracking
  lastError: null,
};

const realtimeSlice = createSlice({
  name: "realtime",
  initialState,
  reducers: {
    setConnectionStatus: (state, action) => {
      state.connectionStatus = action.payload;
      if (action.payload === ConnectionStatus.CONNECTED) {
        state.lastConnectedAt = Date.now();
        state.reconnectAttempts = 0;
      } else if (action.payload === ConnectionStatus.RECONNECTING) {
        state.reconnectAttempts += 1;
      }
    },

    setLastEventTimestamp: (state, action) => {
      state.lastEventTimestamp = action.payload;
    },

    markEventProcessed: (state, action) => {
      const eventId = action.payload;
      state.lastEventId = eventId;
      state.processedEventIds.push(eventId);

      // Keep only last 100 event IDs
      if (state.processedEventIds.length > 100) {
        state.processedEventIds = state.processedEventIds.slice(-100);
      }
    },

    invalidateCache: (state, action) => {
      const cacheKey = action.payload;
      if (state.cacheInvalidation.hasOwnProperty(cacheKey)) {
        state.cacheInvalidation[cacheKey] = true;
      }
    },

    clearCacheInvalidation: (state, action) => {
      const cacheKey = action.payload;
      if (state.cacheInvalidation.hasOwnProperty(cacheKey)) {
        state.cacheInvalidation[cacheKey] = false;
      }
    },

    addPendingUpdate: (state, action) => {
      state.pendingUpdates.push(action.payload);
    },

    removePendingUpdate: (state, action) => {
      const updateId = action.payload;
      state.pendingUpdates = state.pendingUpdates.filter(
        (u) => u.id !== updateId,
      );
    },

    setLastError: (state, action) => {
      state.lastError = action.payload;
    },

    clearError: (state) => {
      state.lastError = null;
    },

    resetRetryCount: (state) => {
      state.reconnectAttempts = 0;
    },

    resetRealtimeState: () => initialState,
  },
});

export const {
  setConnectionStatus,
  setLastEventTimestamp,
  markEventProcessed,
  invalidateCache,
  clearCacheInvalidation,
  addPendingUpdate,
  removePendingUpdate,
  setLastError,
  clearError,
  resetRetryCount,
  resetRealtimeState,
} = realtimeSlice.actions;

// Thunk action to handle incoming realtime events
export const handleRealtimeEvent = (eventPayload) => (dispatch, getState) => {
  const { id, type, data, metadata } = eventPayload;

  // Check for duplicate event (idempotency)
  const { processedEventIds } = getState().realtime;
  if (processedEventIds.includes(id)) {
    console.log("[Realtime] Duplicate event ignored:", id);
    return;
  }

  // Mark event as processed
  dispatch(markEventProcessed(id));

  // Route event to appropriate handler
  switch (type) {
    // Product events
    case EventTypes.PRODUCT_CREATED:
    case EventTypes.PRODUCT_UPDATED:
    case EventTypes.PRODUCT_DELETED:
    case EventTypes.PRODUCT_SOLD:
    case EventTypes.PRODUCT_STOCK_CHANGED:
      dispatch(handleProductEvent(type, data, metadata));
      break;

    // Product Group events
    case EventTypes.PRODUCT_GROUP_CREATED:
    case EventTypes.PRODUCT_GROUP_UPDATED:
    case EventTypes.PRODUCT_GROUP_DELETED:
    case EventTypes.PRODUCT_GROUP_BULK_DELETED:
      dispatch(handleProductGroupEvent(type, data, metadata));
      break;

    // Cart events
    case EventTypes.CART_UPDATED:
    case EventTypes.CART_ITEM_ADDED:
    case EventTypes.CART_ITEM_REMOVED:
    case EventTypes.CART_CLEARED:
      dispatch(handleCartEvent(type, data, metadata));
      break;

    // Sales events
    case EventTypes.SALE_COMPLETED:
    case EventTypes.CHECKOUT_COMPLETED:
    case EventTypes.SALE_REFUNDED:
      dispatch(handleSaleEvent(type, data, metadata));
      break;

    // Auth events
    case EventTypes.SESSION_EXPIRED:
    case EventTypes.USER_LOGGED_OUT:
    case EventTypes.ROLE_CHANGED:
    case EventTypes.ACCOUNT_SUSPENDED:
    case EventTypes.PERMISSIONS_UPDATED:
      dispatch(handleAuthEvent(type, data, metadata));
      break;

    // Business events
    case EventTypes.BUSINESS_UPDATED:
      dispatch(handleBusinessEvent(type, data, metadata));
      break;

    // Dashboard events
    case EventTypes.STATS_UPDATED:
      updateDashboardStatsIfLoaded(dispatch, getState);
      break;

    // Expense events
    case EventTypes.EXPENSE_CREATED:
    case EventTypes.EXPENSE_UPDATED:
    case EventTypes.EXPENSE_DELETED:
      dispatch(handleExpenseEvent(type, data, metadata));
      break;

    // Discount events
    case EventTypes.DISCOUNT_CREATED:
    case EventTypes.DISCOUNT_UPDATED:
    case EventTypes.DISCOUNT_DELETED:
      dispatch(handleDiscountEvent(type, data, metadata));
      break;

    // Activity events
    case EventTypes.ACTIVITY_LOGGED:
      dispatch(handleActivityEvent(type, data, metadata));
      break;

    // Marketplace events
    case EventTypes.MARKETPLACE_LISTING_UPDATED:
    case EventTypes.MARKETPLACE_ORDER_PLACED:
    case EventTypes.MARKETPLACE_ORDER_PAYMENT_CONFIRMED:
    case EventTypes.MARKETPLACE_ORDER_ACCEPTED:
    case EventTypes.MARKETPLACE_ORDER_REJECTED:
    case EventTypes.MARKETPLACE_ORDER_PROCESSING:
    case EventTypes.MARKETPLACE_ORDER_SHIPPED:
    case EventTypes.MARKETPLACE_ORDER_DELIVERED:
    case EventTypes.MARKETPLACE_ORDER_LINE_UPDATED:
    case EventTypes.MARKETPLACE_WEBHOOK_DELIVERY_SUCCEEDED:
    case EventTypes.MARKETPLACE_WEBHOOK_DELIVERY_FAILED:
      dispatch(handleMarketplaceEvent(type, data, metadata));
      break;

    // Application events
    case EventTypes.APPLICATION_SUBMITTED:
    case EventTypes.APPLICATION_STATUS_CHANGED:
    case EventTypes.APPLICATION_BRIEF_SENT:
    case EventTypes.APPLICATION_BRIEF_SUBMITTED:
    case EventTypes.APPLICATION_EMAIL_SENT:
      dispatch(handleApplicationEvent(type, data, metadata));
      break;

    default:
      console.log("[Realtime] Unknown event type:", type);
  }
};

// Product event handler
const handleProductEvent = (type, data, metadata) => (dispatch, getState) => {
  const state = getState();
  const { product, productCache } = state;

  const normalizeProduct = (payload) => {
    if (!payload) return null;
    const source = payload.product || payload;
    const id = source._id || payload.productId || payload._id;
    const cached = id ? productCache.productsById[id] : null;
    return {
      ...(cached || {}),
      ...source,
      _id: id || source._id,
    };
  };

  const syncOutOfStock = (payload) => {
    const normalized = normalizeProduct(payload);
    if (!normalized || !normalized._id) return;
    const quantity =
      normalized.quantity ?? normalized.remainingQuantity ?? normalized.qty;
    if (quantity != null && Number(quantity) <= 0) {
      dispatch(addOutOfStockProduct(normalized));
    } else {
      dispatch(removeOutOfStockProduct(normalized._id));
    }
  };

  const refreshDashboardIfLoaded = () => {
    updateDashboardStatsIfLoaded(dispatch, getState);
  };

  const handleSingleProduct = (payload) => {
    if (!payload) return;
    const source = payload.product || payload;
    const productId = source._id || payload.productId || payload._id;
    if (!productId) return;

    switch (type) {
      case EventTypes.PRODUCT_CREATED:
        // Add to cache only, no need to invalidate
        const normalizedProduct = normalizeProduct(payload) || source;
        dispatch({
          type: "productCache/addProduct",
          payload: normalizedProduct,
        });
        // Ensure we update fields if product already existed (e.g., createdAt)
        dispatch({
          type: "productCache/updateProduct",
          payload: normalizedProduct,
        });
        syncOutOfStock(payload);
        // Only refresh dashboard if it was loaded - don't invalidate to avoid GET
        refreshDashboardIfLoaded();
        break;

      case EventTypes.PRODUCT_UPDATED:
      case EventTypes.PRODUCT_STOCK_CHANGED:
        // Update cached product directly, no invalidation
        dispatch({
          type: "productCache/updateProduct",
          payload: normalizeProduct(payload) || source,
        });
        syncOutOfStock(payload);
        // Only refresh dashboard if it was loaded
        refreshDashboardIfLoaded();
        break;

      case EventTypes.PRODUCT_DELETED:
        // Remove from cache directly, no invalidation
        dispatch({
          type: "productCache/removeProduct",
          payload: productId,
        });
        dispatch(removeOutOfStockProduct(productId));
        refreshDashboardIfLoaded();
        break;

      case EventTypes.PRODUCT_SOLD:
        // Update cached product with new quantity, no invalidation
        dispatch({
          type: "productCache/updateProduct",
          payload: {
            _id: productId,
            quantity: payload.remainingQuantity,
          },
        });
        syncOutOfStock({
          _id: productId,
          quantity: payload.remainingQuantity,
        });
        refreshDashboardIfLoaded();
        break;
    }
  };

  // Handle batch operations
  if (data?.operation === 'batch-delete' && Array.isArray(data?.productIds)) {
    // Handle batch delete
    data.productIds.forEach((productId) => {
      dispatch({
        type: "productCache/removeProduct",
        payload: productId,
      });
      dispatch(removeOutOfStockProduct(productId));
    });
    refreshDashboardIfLoaded();
    return;
  }

  if (data?.operation === 'batch-toggle' && Array.isArray(data?.productIds)) {
    // Handle batch toggle - update listProduct field for each product
    data.productIds.forEach((productId) => {
      dispatch({
        type: "productCache/updateProduct",
        payload: {
          _id: productId,
          listProduct: data.listProduct,
        },
      });
    });
    refreshDashboardIfLoaded();
    return;
  }

  if (Array.isArray(data?.products)) {
    data.products.forEach((item) => handleSingleProduct(item));
    return;
  }

  if (Array.isArray(data)) {
    data.forEach((item) => handleSingleProduct(item));
    return;
  }

  handleSingleProduct(data);
};

// Product Group event handler
const handleProductGroupEvent =
  (type, data, metadata) => (dispatch, getState) => {
    const state = getState();
    const totalQuantity = data?.totalQuantity;
    const groupId = data?._id;

    const removeGroupProductsFromCache = () => {
      if (!groupId) return;
      const productsById = state.productCache?.productsById || {};
      Object.values(productsById).forEach((product) => {
        if (product?.itemGroup === groupId) {
          dispatch({
            type: "productCache/removeProduct",
            payload: product._id,
          });
        }
      });
    };

    if (totalQuantity != null && Number(totalQuantity) <= 0) {
      dispatch(addOutOfStockGroup(data));
    } else if (data?._id) {
      dispatch(removeOutOfStockGroup(data._id));
    }

    switch (type) {
      case EventTypes.PRODUCT_GROUP_CREATED:
        // Add to bulk cache, no invalidation
        if (data?._id) {
          dispatch(addBulkCacheItem({ dataType: "productGroups", item: data }));
        }
        break;

      case EventTypes.PRODUCT_GROUP_UPDATED:
        // Update bulk cache directly, no invalidation
        if (data?._id) {
          dispatch(
            updateBulkCacheItem({ dataType: "productGroups", item: data }),
          );
        }
        // Avoid clearing group products on change-stream updates.
        // Product-level events (PRODUCT_DELETED/UPDATED) handle variant cache precisely.
        if (metadata?.forceProductCacheReset === true) {
          removeGroupProductsFromCache();
        }
        break;

      case EventTypes.PRODUCT_GROUP_DELETED:
        // Remove from bulk cache directly, no invalidation
        if (data?._id) {
          dispatch(
            removeBulkCacheItem({
              dataType: "productGroups",
              itemId: data._id,
            }),
          );
        }
        dispatch(removeOutOfStockGroup(data?._id));
        removeGroupProductsFromCache();
        break;

      case EventTypes.PRODUCT_GROUP_BULK_DELETED:
        // Handle bulk deletion of groups and variants
        if (Array.isArray(data?.deletedGroupIds)) {
          // Remove all deleted groups from bulk cache
          data.deletedGroupIds.forEach((groupId) => {
            dispatch(
              removeBulkCacheItem({
                dataType: "productGroups",
                itemId: groupId,
              }),
            );
            dispatch(removeOutOfStockGroup(groupId));
          });
        }
        
        // Remove all variant products from product cache
        if (Array.isArray(data?.deletedVariantIds)) {
          data.deletedVariantIds.forEach((productId) => {
            dispatch({
              type: "productCache/removeProduct",
              payload: productId,
            });
            dispatch(removeOutOfStockProduct(productId));
          });
        }
        break;
    }

    updateDashboardStatsIfLoaded(dispatch, getState);
  };

// Cart event handler
const handleCartEvent = (type, data, metadata) => (dispatch) => {
  // Don't invalidate cart cache, just dispatch the realtime update handler
  dispatch({
    type: "cart/handleRealtimeUpdate",
    payload: { eventType: type, data },
  });
};

// Sale event handler
const handleSaleEvent = (type, data, metadata) => (dispatch, getState) => {
  const state = getState();
  const sale = data?.sale || data?.checkout || data || {};
  const shouldAdjustInventory =
    type === EventTypes.CHECKOUT_COMPLETED &&
    metadata?.type !== "payment_update";

  const upsertBulk = (dataType, item) => {
    if (!item?._id) return;
    const cache = state.bulkDataCache?.[dataType];
    if (cache?.byId?.[item._id]) {
      dispatch(updateBulkCacheItem({ dataType, item }));
    } else {
      dispatch(addBulkCacheItem({ dataType, item }));
    }
  };

  if (type === EventTypes.SALE_REFUNDED) {
    // Handle the refund - could be a removal or an update
    if (data?.status === "removed" || !data?.checkout) {
      // Complete removal - checkout was deleted because all items were returned
      if (data?.checkoutId || (sale && sale._id)) {
        const itemIdToRemove = data?.checkoutId || sale._id;
        dispatch(
          removeBulkCacheItem({ dataType: "sales", itemId: itemIdToRemove }),
        );
        dispatch(
          removeBulkCacheItem({
            dataType: "fulfilments",
            itemId: itemIdToRemove,
          }),
        );
      }
    } else if (data?.status === "updated" && data?.checkout) {
      // Partial return - checkout still exists with reduced items
      const updatedCheckout = data.checkout;
      dispatch(
        updateBulkCacheItem({
          dataType: "sales",
          item: updatedCheckout,
        }),
      );

      // Update fulfilments cache if needed
      const paymentStatus = updatedCheckout?.payment?.paymentStatus;
      if (paymentStatus === "pending") {
        dispatch(
          updateBulkCacheItem({
            dataType: "fulfilments",
            item: updatedCheckout,
          }),
        );
      } else if (paymentStatus === "completed") {
        dispatch(
          removeBulkCacheItem({
            dataType: "fulfilments",
            itemId: updatedCheckout._id,
          }),
        );
      }
    }
    updateDashboardStatsIfLoaded(dispatch, getState);
    return;
  }

  // Update sales list incrementally in cache
  if (sale && sale._id) {
    upsertBulk("sales", sale);
  }

  // Update fulfilments (incomplete payments) incrementally
  if (sale && sale._id) {
    const paymentStatus =
      sale?.payment?.paymentStatus || sale?.paymentStatus || null;
    if (paymentStatus === "pending") {
      upsertBulk("fulfilments", sale);
    } else if (paymentStatus === "completed") {
      dispatch(
        removeBulkCacheItem({ dataType: "fulfilments", itemId: sale._id }),
      );
    }
  }

  // Update product quantities based on items sold
  if (shouldAdjustInventory) {
    const items = sale?.items || data?.items || [];
    if (Array.isArray(items) && items.length > 0) {
      items.forEach((item) => {
        const productId = item?.productId || item?.product?._id || item?._id;
        if (!productId) return;

        const soldQty = Number(item?.quantity ?? item?.qty ?? 0);
        const cachedProduct = state.productCache?.productsById?.[productId];
        const currentQty = Number(
          cachedProduct?.quantity ?? item?.product?.quantity ?? 0,
        );
        const nextQty = Number.isFinite(soldQty)
          ? Math.max(0, currentQty - soldQty)
          : currentQty;

        // Update product cache directly
        dispatch({
          type: "productCache/updateProduct",
          payload: { _id: productId, quantity: nextQty },
        });

        if (nextQty <= 0) {
          dispatch(addOutOfStockProduct({ _id: productId, quantity: nextQty }));
        } else {
          dispatch(removeOutOfStockProduct(productId));
        }
      });
    }
  }

  // Add customer to cache if present
  const customer = sale?.customer || data?.customer;
  if (customer && typeof customer === "object") {
    const customerId = customer._id || customer.phone || customer.email;
    if (customerId) {
      dispatch(
        addBulkCacheItem({
          dataType: "customers",
          item: { ...customer, _id: customerId },
        }),
      );
    }
  }

  updateDashboardStatsIfLoaded(dispatch, getState);
};

// Auth event handler
const handleAuthEvent = (type, data, metadata) => (dispatch) => {
  switch (type) {
    case EventTypes.SESSION_EXPIRED:
    case EventTypes.USER_LOGGED_OUT:
      // Trigger logout
      dispatch({
        type: "auth/LOGOUT",
      });
      break;

    case EventTypes.ROLE_CHANGED:
    case EventTypes.PERMISSIONS_UPDATED:
      // Update user permissions
      dispatch({
        type: "auth/UPDATE_PERMISSIONS",
        payload: data,
      });
      break;

    case EventTypes.ACCOUNT_SUSPENDED:
      // Handle account suspension
      dispatch({
        type: "auth/ACCOUNT_SUSPENDED",
        payload: data,
      });
      break;
  }
};

// Business event handler
const handleBusinessEvent = (type, data, metadata) => (dispatch) => {
  dispatch({
    type: "auth/SET_BUSINESS",
    payload: data,
  });
};

// Expense event handler
const handleExpenseEvent = (type, data, metadata) => (dispatch, getState) => {
  // Don't invalidate, update bulk cache directly
  switch (type) {
    case EventTypes.EXPENSE_CREATED:
      dispatch(addBulkCacheItem({ dataType: "expenses", item: data }));
      break;

    case EventTypes.EXPENSE_UPDATED:
      dispatch(updateBulkCacheItem({ dataType: "expenses", item: data }));
      break;

    case EventTypes.EXPENSE_DELETED:
      dispatch(removeBulkCacheItem({ dataType: "expenses", itemId: data._id }));
      break;
  }

  updateDashboardStatsIfLoaded(dispatch, getState);
};

// Discount event handler
const handleDiscountEvent = (type, data) => (dispatch) => {
  switch (type) {
    case EventTypes.DISCOUNT_CREATED:
      dispatch(addBulkCacheItem({ dataType: "discounts", item: data }));
      break;

    case EventTypes.DISCOUNT_UPDATED:
      dispatch(updateBulkCacheItem({ dataType: "discounts", item: data }));
      break;

    case EventTypes.DISCOUNT_DELETED:
      dispatch(
        removeBulkCacheItem({
          dataType: "discounts",
          itemId: data?._id || data?.discountId,
        }),
      );
      break;
  }

  // Product cache embeds discountPricing — mark stale so the next
  // explicit refresh picks up fresh pricing.  Do NOT refetch automatically;
  // the user's discount list is already up-to-date from the bulk-cache
  // update above, and a full product re-fetch is expensive.
  dispatch(invalidateProductCache());
};

// Activity event handler
const handleActivityEvent = (type, data, metadata) => (dispatch) => {
  // Don't invalidate, update bulk cache directly
  if (Array.isArray(data)) {
    data.forEach((activity) => {
      if (activity?._id) {
        dispatch(addBulkCacheItem({ dataType: "activities", item: activity }));
      }
    });
  } else if (data?._id) {
    dispatch(addBulkCacheItem({ dataType: "activities", item: data }));
  }
};

const handleMarketplaceEvent = (type, data) => (dispatch, getState) => {
  if (type === EventTypes.MARKETPLACE_LISTING_UPDATED) {
    // Update product / group cache in-place from the event payload so we
    // avoid a full GET refetch.  Mark the product cache as stale so the
    // next explicit refresh picks up anything we couldn't patch locally.
    if (data?.product && data.product._id) {
      dispatch({
        type: "productCache/updateProduct",
        payload: data.product,
      });
    }
    if (data?.productGroup && data.productGroup._id) {
      dispatch(
        updateBulkCacheItem({
          dataType: "productGroups",
          item: data.productGroup,
        }),
      );
    }
    dispatch(invalidateProductCache());
    return;
  }

  const orderPayload = data?.order || data;
  const orderId = orderPayload?._id || data?.orderId;

  const upsertOrder = () => {
    if (!orderPayload || !(orderPayload._id || orderId)) {
      return;
    }

    const payload = {
      ...(orderPayload || {}),
      _id: orderPayload?._id || orderId,
    };

    dispatch(
      updateBulkCacheItem({
        dataType: "marketplaceOrders",
        item: payload,
      }),
    );

    dispatch(
      addBulkCacheItem({
        dataType: "marketplaceOrders",
        item: payload,
      }),
    );
  };

  switch (type) {
    case EventTypes.MARKETPLACE_ORDER_PLACED:
      upsertOrder();
      break;

    case EventTypes.MARKETPLACE_ORDER_PAYMENT_CONFIRMED:
    case EventTypes.MARKETPLACE_ORDER_ACCEPTED:
    case EventTypes.MARKETPLACE_ORDER_REJECTED:
    case EventTypes.MARKETPLACE_ORDER_PROCESSING:
    case EventTypes.MARKETPLACE_ORDER_SHIPPED:
    case EventTypes.MARKETPLACE_ORDER_DELIVERED:
    case EventTypes.MARKETPLACE_ORDER_LINE_UPDATED:
      upsertOrder();
      break;

    case EventTypes.MARKETPLACE_WEBHOOK_DELIVERY_SUCCEEDED:
    case EventTypes.MARKETPLACE_WEBHOOK_DELIVERY_FAILED:
      if (orderPayload && (orderPayload._id || orderId)) {
        upsertOrder();
      }

      if (orderId) {
        dispatch(
          updateBulkCacheItem({
            dataType: "marketplaceOrders",
            item: {
              _id: orderId,
              webhookDelivery: {
                ...(type === EventTypes.MARKETPLACE_WEBHOOK_DELIVERY_SUCCEEDED
                  ? { status: "success" }
                  : { status: "failed" }),
                ...(data || {}),
              },
            },
          }),
        );
      }
      break;
  }
};

// Application event handler
const handleApplicationEvent = (type, data, metadata) => (dispatch) => {
  // Update admin applications cache via the admin slice
  switch (type) {
    case EventTypes.APPLICATION_SUBMITTED:
      // New application received
      dispatch(addApplicationToCache(data));
      break;

    case EventTypes.APPLICATION_STATUS_CHANGED:
      // Application status was updated (e.g., received -> reviewing -> interview)
      dispatch(updateApplicationInCache(data));
      break;

    case EventTypes.APPLICATION_BRIEF_SENT:
      // Brief was sent to applicant
      dispatch(updateApplicationInCache({
        _id: data._id,
        latestBrief: {
          status: "sent",
          sentAt: new Date().toISOString(),
          dueDate: data.dueDate,
          instructions: data.instructions,
        },
      }));
      break;

    case EventTypes.APPLICATION_BRIEF_SUBMITTED:
      // Applicant submitted their brief responses
      dispatch(updateApplicationInCache({
        _id: data._id,
        latestBrief: {
          status: "submitted",
          submittedAt: new Date().toISOString(),
          hasResponses: true,
        },
      }));
      break;

    case EventTypes.APPLICATION_EMAIL_SENT:
      // Follow-up email was sent to applicant
      // Just mark the application as having communication
      dispatch(updateApplicationInCache({
        _id: data._id,
        lastCommunication: new Date().toISOString(),
      }));
      break;
  }
};

const computeDashboardStatsFromCache = (state) => {
  const productsById = state.productCache?.productsById || {};
  const productIds =
    state.productCache?.allProductIds || Object.keys(productsById);
  const products = productIds.map((id) => productsById[id]).filter(Boolean);

  let totalStoreValueByPrice = 0;
  let totalStoreValueByCost = 0;
  let outOfStockSingleProducts = 0;
  const categories = new Set();

  products.forEach((product) => {
    const qty = Number(product?.quantity ?? product?.remainingQuantity ?? 0);
    const price = Number(product?.price ?? 0);
    const cost = Number(product?.cost ?? 0);
    if (product?.category) categories.add(product.category);
    totalStoreValueByPrice += price * qty;
    totalStoreValueByCost += cost * qty;
    if (qty <= 0) outOfStockSingleProducts += 1;
  });

  const productGroupsState = state.bulkDataCache?.productGroups;
  const productGroups = productGroupsState
    ? productGroupsState.allIds
        .map((id) => productGroupsState.byId[id])
        .filter(Boolean)
    : [];

  const outOfStockSingleFromCache =
    state.bulkDataCache?.outOfStock?.products?.allIds?.length;
  const outOfStockGroupFromCache =
    state.bulkDataCache?.outOfStock?.productGroups?.allIds?.length;

  const totalExpensesFromCache =
    state.bulkDataCache?.expenses?.aggregatedStats?.totalAmount;
  const totalExpenses = Number.isFinite(totalExpensesFromCache)
    ? totalExpensesFromCache
    : Object.values(state.bulkDataCache?.expenses?.byId || {}).reduce(
        (sum, item) => sum + Number(item?.amount || 0),
        0,
      );

  const outOfStockSingle =
    Number.isFinite(outOfStockSingleFromCache) && outOfStockSingleFromCache >= 0
      ? outOfStockSingleFromCache
      : outOfStockSingleProducts;

  const outOfStockGroup =
    Number.isFinite(outOfStockGroupFromCache) && outOfStockGroupFromCache >= 0
      ? outOfStockGroupFromCache
      : productGroups.filter((group) => {
          const totalQty =
            Number(group?.totalQuantity ?? 0) ||
            (Array.isArray(group?.combinations) &&
            group?.combinations?.length === 0
              ? 0
              : 1);
          return totalQty <= 0;
        }).length;

  return {
    totalProducts: products.length,
    totalCategories: categories.size,
    outOfStock: {
      singleProducts: outOfStockSingle,
      groupProducts: outOfStockGroup,
      total: outOfStockSingle + outOfStockGroup,
    },
    storeValue: {
      byPrice: totalStoreValueByPrice,
      byCost: totalStoreValueByCost,
    },
    totalExpenses,
  };
};

const updateDashboardStatsIfLoaded = (dispatch, getState) => {
  const state = getState();
  if (!state.dataCache?.cache?.[BOOTSTRAP_DATA.DASHBOARD_STATS]?.isFetched) {
    return;
  }
  dispatch(setDashboardStats(computeDashboardStatsFromCache(state)));
};

// Selectors
export const selectConnectionStatus = (state) =>
  state.realtime.connectionStatus;
export const selectIsConnected = (state) =>
  state.realtime.connectionStatus === ConnectionStatus.CONNECTED;
export const selectLastEventTimestamp = (state) =>
  state.realtime.lastEventTimestamp;
export const selectLastEventTime = (state) => state.realtime.lastEventTimestamp;
export const selectCacheInvalidation = (state) =>
  state.realtime.cacheInvalidation;
export const selectReconnectAttempts = (state) =>
  state.realtime.reconnectAttempts;
export const selectRetryCount = (state) => state.realtime.reconnectAttempts;

export default realtimeSlice.reducer;
