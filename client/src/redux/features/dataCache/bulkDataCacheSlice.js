/**
 * Bulk Data Cache Slice
 *
 * Centralized cache for bulk-loaded paginated data.
 * All data is loaded once (up to 1000 items) and paginated client-side.
 *
 * ARCHITECTURE:
 * - Each data type has normalized storage (byId + allIds)
 * - Bulk loading fetches up to 1000 items per data type
 * - UI pagination slices from Redux state, NOT backend
 * - Page navigation never triggers backend calls
 * - Backend calls only happen for: bootstrap, mutations, realtime invalidation
 *
 * SUPPORTED DATA TYPES:
 * - sales (checkouts)
 * - expenses
 * - activities
 * - fulfilments (incomplete payments)
 * - customers
 * - productGroups
 * - discounts
 * - outOfStock
 */

import {
  createSlice,
  createAsyncThunk,
  createSelector,
} from "@reduxjs/toolkit";
import cartService from "../cart/cartService";
import expenseService from "../../../services/expenseService";
import activitiesService from "../activities/activityService";
import productService from "../product/productService";
import discountService from "../../../services/discountService";
import marketplaceService from "../../../services/marketplaceService";

// Constants
const BULK_LIMIT = 1000; // Standard page size for bulk loading
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes
const MAX_BACKFILL_PAGES = 100;

const getCurrentYear = () => new Date().getFullYear();

const getYearBoundary = (year) => {
  const numericYear = Number(year) || getCurrentYear();
  return {
    year: numericYear,
    start: new Date(numericYear, 0, 1, 0, 0, 0, 0).toISOString(),
    end: new Date(numericYear, 11, 31, 23, 59, 59, 999).toISOString(),
  };
};

const runPagedBackfill = async ({
  label,
  requestPage,
  extractItems,
  extractTotal,
  extractHasMore,
  resumePage = 1,
  limit = BULK_LIMIT,
  maxPages = MAX_BACKFILL_PAGES,
}) => {
  const startedAt = performance.now();
  const items = [];
  let page = Math.max(1, resumePage);
  let total = 0;
  let hasMore = true;
  let pagesLoaded = 0;

  while (hasMore && pagesLoaded < maxPages) {
    const result = await requestPage({ page, limit });
    const batch = extractItems(result);
    items.push(...batch);

    total = Number(extractTotal(result) || total || 0);
    hasMore = Boolean(extractHasMore(result, batch, total, limit));
    page += 1;
    pagesLoaded += 1;
  }

  const isComplete = !hasMore;
  const nextPage = isComplete ? 1 : page;

  console.info("[BulkCache] backfill_complete", {
    dataset: label,
    durationMs: Number((performance.now() - startedAt).toFixed(2)),
    loaded: items.length,
    total,
    pagesLoaded,
    isComplete,
    nextPage,
  });

  return {
    items,
    total,
    isComplete,
    resumePage: nextPage,
    pagesLoaded,
  };
};

/**
 * Create initial state for a data type
 */
const createDataTypeState = () => ({
  byId: {},
  allIds: [],
  meta: {
    total: 0,
    loaded: 0,
    isComplete: false,
    resumePage: 1,
    pagesLoaded: 0,
    lastFetchedAt: null,
    isLoading: false,
    error: null,
  },
  filters: {},
  aggregatedStats: null,
});

const createYearAwareDataTypeState = () => ({
  ...createDataTypeState(),
  yearBuckets: {},
  yearsLoaded: [],
});

const initialState = {
  // Sales/Checkouts
  sales: createYearAwareDataTypeState(),

  // Expenses
  expenses: createYearAwareDataTypeState(),

  // Activities
  activities: createDataTypeState(),

  // Fulfilments (incomplete payments)
  fulfilments: createDataTypeState(),

  // Customers
  customers: createDataTypeState(),

  // Product Groups
  productGroups: createDataTypeState(),

  // Discounts
  discounts: createDataTypeState(),

  // Marketplace Orders
  marketplaceOrders: createDataTypeState(),

  // Out of Stock
  outOfStock: {
    products: createDataTypeState(),
    productGroups: createDataTypeState(),
  },

  // Cache validity
  cacheValidUntil: {},
};

/**
 * Bulk fetch sales (checkouts)
 */
export const fetchBulkSales = createAsyncThunk(
  "bulkDataCache/fetchBulkSales",
  async (
    { force = false, filters = {}, year = getCurrentYear() } = {},
    { getState, rejectWithValue },
  ) => {
    try {
      const state = getState();
      const yearKey = String(Number(year) || getCurrentYear());
      const salesState = state.bulkDataCache.sales;
      const bucketMeta = salesState?.yearBuckets?.[yearKey]?.meta;
      const meta = bucketMeta || salesState.meta;
      const cacheValidUntil = state.bulkDataCache.cacheValidUntil;
      const salesCacheMap =
        typeof cacheValidUntil.sales === "object" && cacheValidUntil.sales !== null
          ? cacheValidUntil.sales
          : {};
      const salesCacheValid = salesCacheMap[yearKey];
      const { start, end, year: normalizedYear } = getYearBoundary(year);

      // Check if cache is valid
      if (
        !force &&
        meta.isComplete &&
        salesCacheValid &&
        Date.now() < salesCacheValid
      ) {
        console.log(`[BulkCache] Sales cache valid for ${yearKey}, skipping fetch`);
        return { skipped: true, year: normalizedYear };
      }

      console.log(`[BulkCache] Fetching paged sales backfill for ${yearKey}...`);
      const resumePage = force ? 1 : Number(meta.resumePage || 1);
      let firstPageAggregatedStats = null;

      const result = await runPagedBackfill({
        label: `sales-${yearKey}`,
        resumePage,
        requestPage: ({ page, limit }) =>
          cartService.getCheckouts(start, end, page, limit, "", filters),
        extractItems: (payload) => {
          if (!firstPageAggregatedStats && payload?.aggregatedStats) {
            firstPageAggregatedStats = payload.aggregatedStats;
          }
          return payload?.checkouts || payload?.data || [];
        },
        extractTotal: (payload) => payload?.total || payload?.pagination?.total || 0,
        extractHasMore: (payload, batch, total, limit) => {
          if (typeof payload?.hasMore === "boolean") return payload.hasMore;
          if (payload?.pagination?.hasMore !== undefined) {
            return Boolean(payload.pagination.hasMore);
          }
          const currentPage = Number(payload?.currentPage || payload?.pagination?.currentPage || 1);
          return currentPage * limit < total;
        },
      });

      return {
        ...result,
        year: normalizedYear,
        aggregatedStats: firstPageAggregatedStats,
      };
    } catch (error) {
      const message =
        error.response?.data?.message || error.message || error.toString();
      return rejectWithValue(message);
    }
  },
  {
    condition: (args = {}, { getState }) => {
      const yearKey = String(Number(args?.year) || getCurrentYear());
      const { sales } = getState().bulkDataCache;
      const bucket = sales?.yearBuckets?.[yearKey];
      return !(bucket?.meta?.isLoading || sales.meta.isLoading);
    },
  },
);

/**
 * Bulk fetch expenses
 */
export const fetchBulkExpenses = createAsyncThunk(
  "bulkDataCache/fetchBulkExpenses",
  async (
    { force = false, filters = {}, year = getCurrentYear() } = {},
    { getState, rejectWithValue },
  ) => {
    try {
      const state = getState();
      const yearKey = String(Number(year) || getCurrentYear());
      const expensesState = state.bulkDataCache.expenses;
      const bucketMeta = expensesState?.yearBuckets?.[yearKey]?.meta;
      const meta = bucketMeta || expensesState.meta;
      const expensesCacheMap =
        typeof state.bulkDataCache.cacheValidUntil.expenses === "object" &&
        state.bulkDataCache.cacheValidUntil.expenses !== null
          ? state.bulkDataCache.cacheValidUntil.expenses
          : {};
      const cacheValid = expensesCacheMap[yearKey];
      const { start, end, year: normalizedYear } = getYearBoundary(year);
      const mergedFilters = {
        ...filters,
        startDate: start,
        endDate: end,
      };

      if (!force && meta.isComplete && cacheValid && Date.now() < cacheValid) {
        console.log(`[BulkCache] Expenses cache valid for ${yearKey}, skipping fetch`);
        return { skipped: true, year: normalizedYear };
      }

      console.log(`[BulkCache] Fetching paged expenses backfill for ${yearKey}...`);
      const resumePage = force ? 1 : Number(meta.resumePage || 1);
      let firstPageAggregatedStats = null;

      const result = await runPagedBackfill({
        label: `expenses-${yearKey}`,
        resumePage,
        requestPage: ({ page, limit }) =>
          expenseService.getExpenses(page, limit, mergedFilters),
        extractItems: (payload) => {
          if (!firstPageAggregatedStats) {
            firstPageAggregatedStats = {
              totalAmount: payload?.pagination?.totalAmount || payload?.totalAmount || 0,
              byCategory: payload?.byCategory || [],
            };
          }
          return payload?.expenses || payload?.data || [];
        },
        extractTotal: (payload) => payload?.pagination?.total || payload?.total || 0,
        extractHasMore: (payload, batch, total, limit) => {
          if (payload?.pagination?.hasMore !== undefined) {
            return Boolean(payload.pagination.hasMore);
          }
          const currentPage = Number(payload?.pagination?.currentPage || 1);
          return currentPage * limit < total;
        },
      });

      return {
        ...result,
        year: normalizedYear,
        aggregatedStats: firstPageAggregatedStats,
      };
    } catch (error) {
      const message =
        error.response?.data?.message || error.message || error.toString();
      return rejectWithValue(message);
    }
  },
  {
    condition: (args = {}, { getState }) => {
      const yearKey = String(Number(args?.year) || getCurrentYear());
      const { expenses } = getState().bulkDataCache;
      const bucket = expenses?.yearBuckets?.[yearKey];
      return !(bucket?.meta?.isLoading || expenses.meta.isLoading);
    },
  },
);

/**
 * Bulk fetch activities
 */
export const fetchBulkActivities = createAsyncThunk(
  "bulkDataCache/fetchBulkActivities",
  async ({ force = false } = {}, { getState, rejectWithValue }) => {
    try {
      const state = getState();
      const { meta } = state.bulkDataCache.activities;
      const cacheValid = state.bulkDataCache.cacheValidUntil.activities;

      if (!force && meta.isComplete && cacheValid && Date.now() < cacheValid) {
        console.log("[BulkCache] Activities cache valid, skipping fetch");
        return { skipped: true };
      }

      console.log("[BulkCache] Fetching paged activities backfill...");
      const resumePage = force ? 1 : Number(meta.resumePage || 1);

      return await runPagedBackfill({
        label: "activities",
        resumePage,
        requestPage: ({ page, limit }) => activitiesService.getAllActivities(page, limit),
        maxPages: 1,
        extractItems: (payload) => {
          const activities = payload?.activities || payload?.data || payload || [];
          return Array.isArray(activities) ? activities : [];
        },
        extractTotal: (payload) =>
          payload?.pagination?.totalCount || payload?.totalCount || 0,
        extractHasMore: (payload, batch, total, limit) => {
          if (payload?.pagination?.hasMore !== undefined) {
            return Boolean(payload.pagination.hasMore);
          }
          const currentPage = Number(payload?.pagination?.currentPage || 1);
          return currentPage * limit < total;
        },
      });
    } catch (error) {
      const message =
        error.response?.data?.message || error.message || error.toString();
      return rejectWithValue(message);
    }
  },
  {
    condition: (_, { getState }) => {
      const { activities } = getState().bulkDataCache;
      return !activities.meta.isLoading;
    },
  },
);

/**
 * Bulk fetch discounts
 */
export const fetchBulkDiscounts = createAsyncThunk(
  "bulkDataCache/fetchBulkDiscounts",
  async ({ force = false, status } = {}, { getState, rejectWithValue }) => {
    try {
      const state = getState();
      const { meta } = state.bulkDataCache.discounts;
      const cacheValid = state.bulkDataCache.cacheValidUntil.discounts;

      if (!force && meta.isComplete && cacheValid && Date.now() < cacheValid) {
        console.log("[BulkCache] Discounts cache valid, skipping fetch");
        return { skipped: true };
      }

      const result = await discountService.getDiscounts(
        status ? { status } : {},
      );

      if (
        result &&
        typeof result === "object" &&
        !Array.isArray(result) &&
        (result.success === false ||
          (typeof result.message === "string" && result.stack !== undefined))
      ) {
        throw new Error(result.message || "Failed to load discounts");
      }

      const items = ensureArrayFromPayload(result);

      return {
        items,
        total: result?.count || result?.total || items.length,
        isComplete: true,
      };
    } catch (error) {
      const message =
        error.response?.data?.message || error.message || error.toString();
      return rejectWithValue(message);
    }
  },
  {
    condition: (_, { getState }) => {
      const { discounts } = getState().bulkDataCache;
      return !discounts.meta.isLoading;
    },
  },
);

/**
 * Bulk fetch marketplace orders
 */
export const fetchBulkMarketplaceOrders = createAsyncThunk(
  "bulkDataCache/fetchBulkMarketplaceOrders",
  async ({ force = false, status = "" } = {}, { getState, rejectWithValue }) => {
    try {
      const state = getState();
      const { meta } = state.bulkDataCache.marketplaceOrders;
      const cacheValid = state.bulkDataCache.cacheValidUntil.marketplaceOrders;

      if (!force && meta.isComplete && cacheValid && Date.now() < cacheValid) {
        console.log("[BulkCache] Marketplace orders cache valid, skipping fetch");
        return { skipped: true };
      }

      const result = await marketplaceService.getMarketplaceOrders({ status });
      const items = result.orders || result.data || [];

      return {
        items,
        total: result.total || items.length,
        isComplete: true,
      };
    } catch (error) {
      const message =
        error.response?.data?.message || error.message || error.toString();
      return rejectWithValue(message);
    }
  },
  {
    condition: (_, { getState }) => {
      const { marketplaceOrders } = getState().bulkDataCache;
      return !marketplaceOrders.meta.isLoading;
    },
  },
);

/**
 * Bulk fetch fulfilments (incomplete payments)
 */
export const fetchBulkFulfilments = createAsyncThunk(
  "bulkDataCache/fetchBulkFulfilments",
  async (
    { force = false, status = "" } = {},
    { getState, rejectWithValue },
  ) => {
    try {
      const state = getState();
      const { meta } = state.bulkDataCache.fulfilments;
      const cacheValid = state.bulkDataCache.cacheValidUntil.fulfilments;

      if (!force && meta.isComplete && cacheValid && Date.now() < cacheValid) {
        console.log("[BulkCache] Fulfilments cache valid, skipping fetch");
        return { skipped: true };
      }

      console.log("[BulkCache] Fetching paged fulfilments backfill...");
      const resumePage = force ? 1 : Number(meta.resumePage || 1);

      return await runPagedBackfill({
        label: "fulfilments",
        resumePage,
        requestPage: ({ page, limit }) =>
          cartService.getIncompletePayments({ page, limit, status }),
        extractItems: (payload) => payload?.incompletePayments || payload?.data || [],
        extractTotal: (payload) => payload?.pagination?.total || payload?.total || 0,
        extractHasMore: (payload, batch, total, limit) => {
          if (payload?.pagination?.hasMore !== undefined) {
            return Boolean(payload.pagination.hasMore);
          }
          const currentPage = Number(payload?.pagination?.currentPage || 1);
          return currentPage * limit < total;
        },
      });
    } catch (error) {
      const message =
        error.response?.data?.message || error.message || error.toString();
      return rejectWithValue(message);
    }
  },
  {
    condition: (_, { getState }) => {
      const { fulfilments } = getState().bulkDataCache;
      return !fulfilments.meta.isLoading;
    },
  },
);

/**
 * Bulk fetch customers
 */
export const fetchBulkCustomers = createAsyncThunk(
  "bulkDataCache/fetchBulkCustomers",
  async ({ force = false } = {}, { getState, rejectWithValue }) => {
    try {
      const state = getState();
      const { meta } = state.bulkDataCache.customers;
      const cacheValid = state.bulkDataCache.cacheValidUntil.customers;

      if (!force && meta.isComplete && cacheValid && Date.now() < cacheValid) {
        console.log("[BulkCache] Customers cache valid, skipping fetch");
        return { skipped: true };
      }

      console.log("[BulkCache] Fetching bulk customers...");
      const result = await cartService.getCustomers();

      const customers = result.customers || result.data || result || [];

      return {
        items: Array.isArray(customers) ? customers : [],
        total: customers.length,
        isComplete: true, // Customers typically all loaded at once
      };
    } catch (error) {
      const message =
        error.response?.data?.message || error.message || error.toString();
      return rejectWithValue(message);
    }
  },
  {
    condition: (_, { getState }) => {
      const { customers } = getState().bulkDataCache;
      return !customers.meta.isLoading;
    },
  },
);

/**
 * Bulk fetch product groups
 */
export const fetchBulkProductGroups = createAsyncThunk(
  "bulkDataCache/fetchBulkProductGroups",
  async ({ force = false } = {}, { getState, rejectWithValue }) => {
    try {
      const state = getState();
      const { meta } = state.bulkDataCache.productGroups;
      const cacheValid = state.bulkDataCache.cacheValidUntil.productGroups;

      if (!force && meta.isComplete && cacheValid && Date.now() < cacheValid) {
        console.log("[BulkCache] ProductGroups cache valid, skipping fetch");
        return { skipped: true };
      }

      console.log("[BulkCache] Fetching paged product groups backfill...");
      const resumePage = force ? 1 : Number(meta.resumePage || 1);
      let firstPageAggregatedStats = null;

      const result = await runPagedBackfill({
        label: "productGroups",
        resumePage,
        requestPage: ({ page, limit }) => productService.getProductGroups({ page, limit }),
        extractItems: (payload) => {
          if (!firstPageAggregatedStats && payload?.aggregatedStats) {
            firstPageAggregatedStats = payload.aggregatedStats;
          }
          return payload?.products || payload?.productGroups || payload?.data || [];
        },
        extractTotal: (payload) => payload?.total || payload?.pagination?.total || 0,
        extractHasMore: (payload, batch, total, limit) => {
          if (payload?.hasMore !== undefined) return Boolean(payload.hasMore);
          if (payload?.pagination?.hasMore !== undefined) {
            return Boolean(payload.pagination.hasMore);
          }
          const currentPage = Number(payload?.currentPage || payload?.pagination?.currentPage || 1);
          return currentPage * limit < total;
        },
      });

      return {
        ...result,
        aggregatedStats: firstPageAggregatedStats,
      };
    } catch (error) {
      const message =
        error.response?.data?.message || error.message || error.toString();
      return rejectWithValue(message);
    }
  },
  {
    condition: (_, { getState }) => {
      const { productGroups } = getState().bulkDataCache;
      return !productGroups.meta.isLoading;
    },
  },
);

/**
 * Bulk fetch out of stock items
 */
export const fetchBulkOutOfStock = createAsyncThunk(
  "bulkDataCache/fetchBulkOutOfStock",
  async ({ force = false } = {}, { getState, rejectWithValue }) => {
    try {
      const state = getState();
      const { products } = state.bulkDataCache.outOfStock;
      const cacheValid = state.bulkDataCache.cacheValidUntil.outOfStock;

      if (
        !force &&
        products.meta.isComplete &&
        cacheValid &&
        Date.now() < cacheValid
      ) {
        console.log("[BulkCache] OutOfStock cache valid, skipping fetch");
        return { skipped: true };
      }

      console.log("[BulkCache] Fetching bulk out of stock items...");
      const result = await productService.getOutOfStock({
        page: 1,
        limit: BULK_LIMIT,
      });

      return {
        products: result.products?.data || result.products || [],
        productGroups: result.productGroups?.data || result.productGroups || [],
        productsTotal:
          result.products?.total || result.pagination?.products?.total || 0,
        productGroupsTotal:
          result.productGroups?.total ||
          result.pagination?.productGroups?.total ||
          0,
        isComplete: true, // Out of stock typically limited
      };
    } catch (error) {
      const message =
        error.response?.data?.message || error.message || error.toString();
      return rejectWithValue(message);
    }
  },
  {
    condition: (_, { getState }) => {
      const { outOfStock } = getState().bulkDataCache;
      return !outOfStock.products.meta.isLoading;
    },
  },
);

/**
 * Helper to normalize items into byId/allIds format
 * CRITICAL: This function ONLY operates on raw backend/websocket payloads.
 * It must NEVER be applied to Redux state or selector output.
 * Always ensures input is an array before processing.
 */
const normalizeItems = (items, idField = "_id") => {
  const byId = {};
  const allIds = [];

  // CRITICAL SAFETY CHECK: Ensure items is always an array
  // This prevents items.forEach errors when backend returns unexpected shapes
  const safeItems = ensureArrayFromPayload(items);

  safeItems.forEach((item) => {
    if (item && typeof item === "object") {
      const id = item[idField];
      if (id) {
        byId[id] = item;
        allIds.push(id);
      }
    }
  });
  return { byId, allIds };
};

/**
 * Safely extract array from any backend payload structure.
 * This is the SINGLE source of truth for payload normalization.
 * ONLY use on raw backend responses, NEVER on Redux state.
 */
const ensureArrayFromPayload = (payload) => {
  // Already an array - return as-is
  if (Array.isArray(payload)) {
    return payload;
  }

  // Null/undefined - return empty array
  if (payload == null) {
    return [];
  }

  // Not an object - return empty array
  if (typeof payload !== "object") {
    console.warn("[BulkCache] Unexpected payload type:", typeof payload);
    return [];
  }

  // Try common response envelope patterns
  // Each pattern is explicit to avoid accidentally extracting wrong data
  const arrayFields = [
    "items",
    "data",
    "results",
    "records",
    "checkouts",
    "checkOuts",
    "sales",
    "expenses",
    "activities",
    "customers",
    "products",
    "productGroups",
    "discounts",
    "incompletePayments",
    "fulfilments",
    "orders",
  ];

  for (const field of arrayFields) {
    if (Array.isArray(payload[field])) {
      return payload[field];
    }
  }

  // Unknown structure - log warning and return empty array
  console.warn(
    "[BulkCache] Could not extract array from payload:",
    Object.keys(payload),
  );
  return [];
};

const bulkDataCacheSlice = createSlice({
  name: "bulkDataCache",
  initialState,
  reducers: {
    // CRITICAL: Reset all bulk data on logout - ensures no data leakage to next user
    RESET_SESSION(state) {
      return initialState;
    },
    // Invalidate specific cache
    invalidateBulkCache: (state, action) => {
      const dataType = action.payload;
      if (dataType === "outOfStock") {
        state.outOfStock.products.meta.isComplete = false;
        state.outOfStock.productGroups.meta.isComplete = false;
        state.cacheValidUntil.outOfStock = null;
        return;
      }
      if (dataType === "sales" || dataType === "expenses") {
        if (state[dataType]?.yearBuckets) {
          Object.keys(state[dataType].yearBuckets).forEach((yearKey) => {
            state[dataType].yearBuckets[yearKey].meta.isComplete = false;
          });
        }
      }
      if (state[dataType]) {
        state[dataType].meta.isComplete = false;
        state.cacheValidUntil[dataType] = null;
      }
    },

    // Invalidate all caches
    invalidateAllBulkCaches: (state) => {
      Object.keys(state).forEach((key) => {
        if (state[key]?.meta) {
          state[key].meta.isComplete = false;
        }
        if (state[key]?.yearBuckets) {
          Object.keys(state[key].yearBuckets).forEach((yearKey) => {
            state[key].yearBuckets[yearKey].meta.isComplete = false;
          });
        }
      });
      state.outOfStock.products.meta.isComplete = false;
      state.outOfStock.productGroups.meta.isComplete = false;
      state.cacheValidUntil = {};
    },

    forceClearBulkLoading: (state, action) => {
      const { dataType, year, error = null } = action.payload || {};

      if (dataType === "outOfStock") {
        state.outOfStock.products.meta.isLoading = false;
        state.outOfStock.products.meta.error = error;
        state.outOfStock.productGroups.meta.isLoading = false;
        state.outOfStock.productGroups.meta.error = error;
        return;
      }

      if (!dataType || !state[dataType]) {
        return;
      }

      if (
        (dataType === "sales" || dataType === "expenses") &&
        state[dataType]?.yearBuckets
      ) {
        const yearKey = String(Number(year) || getCurrentYear());
        if (state[dataType].yearBuckets[yearKey]) {
          state[dataType].yearBuckets[yearKey].meta.isLoading = false;
          state[dataType].yearBuckets[yearKey].meta.error = error;
        }

        if (Number(year) === getCurrentYear()) {
          state[dataType].meta.isLoading = false;
          state[dataType].meta.error = error;
        }

        return;
      }

      if (state[dataType].meta) {
        state[dataType].meta.isLoading = false;
        state[dataType].meta.error = error;
      }
    },

    // Update single item (for realtime updates)
    updateBulkCacheItem: (state, action) => {
      const { dataType, item, idField = "_id" } = action.payload;
      if (state[dataType] && item && item[idField]) {
        const existing = state[dataType].byId[item[idField]] || {};
        if (dataType === "expenses") {
          const prevAmount = Number(existing?.amount || 0);
          const nextAmount = Number(item?.amount || 0);
          if (!state.expenses.aggregatedStats) {
            state.expenses.aggregatedStats = { totalAmount: 0, byCategory: [] };
          }
          state.expenses.aggregatedStats.totalAmount += nextAmount - prevAmount;
        }

        state[dataType].byId[item[idField]] = { ...existing, ...item };
      }
    },

    // Remove single item
    removeBulkCacheItem: (state, action) => {
      const { dataType, itemId } = action.payload;
      if (state[dataType]) {
        if (dataType === "expenses") {
          const existing = state.expenses.byId[itemId];
          const prevAmount = Number(existing?.amount || 0);
          if (!state.expenses.aggregatedStats) {
            state.expenses.aggregatedStats = { totalAmount: 0, byCategory: [] };
          }
          state.expenses.aggregatedStats.totalAmount = Math.max(
            0,
            (state.expenses.aggregatedStats.totalAmount || 0) - prevAmount,
          );
        }

        delete state[dataType].byId[itemId];
        state[dataType].allIds = state[dataType].allIds.filter(
          (id) => id !== itemId,
        );
        state[dataType].meta.loaded = Math.max(
          0,
          state[dataType].meta.loaded - 1,
        );
      }
    },

    // Add single item
    addBulkCacheItem: (state, action) => {
      const { dataType, item, idField = "_id" } = action.payload;
      if (state[dataType] && item && item[idField]) {
        const id = item[idField];
        if (!state[dataType].byId[id]) {
          if (dataType === "expenses") {
            const nextAmount = Number(item?.amount || 0);
            if (!state.expenses.aggregatedStats) {
              state.expenses.aggregatedStats = {
                totalAmount: 0,
                byCategory: [],
              };
            }
            state.expenses.aggregatedStats.totalAmount += nextAmount;
          }
          state[dataType].byId[id] = item;
          state[dataType].allIds.unshift(id); // Add to beginning
          state[dataType].meta.loaded += 1;
          state[dataType].meta.total += 1;
        }
      }
    },

    // Out of stock product helpers
    addOutOfStockProduct: (state, action) => {
      const item = action.payload;
      if (!item || !item._id) return;
      const target = state.outOfStock.products;
      if (!target.byId[item._id]) {
        target.byId[item._id] = item;
        target.allIds.unshift(item._id);
        target.meta.loaded += 1;
        target.meta.total += 1;
      } else {
        target.byId[item._id] = { ...target.byId[item._id], ...item };
      }
    },
    removeOutOfStockProduct: (state, action) => {
      const itemId = action.payload;
      const target = state.outOfStock.products;
      if (target.byId[itemId]) {
        delete target.byId[itemId];
        target.allIds = target.allIds.filter((id) => id !== itemId);
        target.meta.loaded = Math.max(0, target.meta.loaded - 1);
        target.meta.total = Math.max(0, target.meta.total - 1);
      }
    },

    // Out of stock product group helpers
    addOutOfStockGroup: (state, action) => {
      const item = action.payload;
      if (!item || !item._id) return;
      const target = state.outOfStock.productGroups;
      if (!target.byId[item._id]) {
        target.byId[item._id] = item;
        target.allIds.unshift(item._id);
        target.meta.loaded += 1;
        target.meta.total += 1;
      } else {
        target.byId[item._id] = { ...target.byId[item._id], ...item };
      }
    },
    removeOutOfStockGroup: (state, action) => {
      const itemId = action.payload;
      const target = state.outOfStock.productGroups;
      if (target.byId[itemId]) {
        delete target.byId[itemId];
        target.allIds = target.allIds.filter((id) => id !== itemId);
        target.meta.loaded = Math.max(0, target.meta.loaded - 1);
        target.meta.total = Math.max(0, target.meta.total - 1);
      }
    },

    // Reset on logout
    resetBulkDataCache: () => initialState,
  },
  extraReducers: (builder) => {
    builder
      // Sales
      .addCase(fetchBulkSales.pending, (state, action) => {
        const year = Number(action.meta?.arg?.year) || getCurrentYear();
        const yearKey = String(year);
        if (!state.sales.yearBuckets) state.sales.yearBuckets = {};
        if (!state.sales.yearBuckets[yearKey]) {
          state.sales.yearBuckets[yearKey] = createDataTypeState();
        }
        state.sales.yearBuckets[yearKey].meta.isLoading = true;
        state.sales.yearBuckets[yearKey].meta.error = null;

        if (year === getCurrentYear()) {
          state.sales.meta.isLoading = true;
          state.sales.meta.error = null;
        }
      })
      .addCase(fetchBulkSales.fulfilled, (state, action) => {
        const year = Number(action.payload?.year) || getCurrentYear();
        const yearKey = String(year);
        if (!state.sales.yearBuckets) state.sales.yearBuckets = {};
        if (!state.sales.yearBuckets[yearKey]) {
          state.sales.yearBuckets[yearKey] = createDataTypeState();
        }

        if (action.payload.skipped) {
          console.log(`[BulkCache] ✓ Sales cache still valid for ${yearKey}, skipped fetch`);
          state.sales.yearBuckets[yearKey].meta.isLoading = false;
          if (year === getCurrentYear()) {
            state.sales.meta.isLoading = false;
          }
          return;
        }
        const {
          items,
          total,
          aggregatedStats,
          isComplete,
          resumePage = 1,
          pagesLoaded = 0,
        } = action.payload;
        const normalized = normalizeItems(items);
        const yearState = {
          byId: normalized.byId,
          allIds: normalized.allIds,
          meta: {
            total,
            loaded: items.length,
            isComplete,
            resumePage,
            pagesLoaded,
            lastFetchedAt: Date.now(),
            isLoading: false,
            error: null,
          },
          filters: state.sales.yearBuckets[yearKey].filters || {},
          aggregatedStats,
        };

        state.sales.yearBuckets[yearKey] = yearState;
        state.sales.yearsLoaded = Array.from(
          new Set([...(state.sales.yearsLoaded || []), year]),
        ).sort((a, b) => b - a);

        if (year === getCurrentYear()) {
          state.sales.byId = yearState.byId;
          state.sales.allIds = yearState.allIds;
          state.sales.meta = yearState.meta;
          state.sales.aggregatedStats = yearState.aggregatedStats;
        }

        if (
          typeof state.cacheValidUntil.sales !== "object" ||
          state.cacheValidUntil.sales === null
        ) {
          state.cacheValidUntil.sales = {};
        }
        state.cacheValidUntil.sales[yearKey] = Date.now() + CACHE_TTL;

        console.log(
          `[BulkCache] ✓ Loaded ${items.length}/${total} sales for ${yearKey}. Complete: ${isComplete}`,
        );
        console.log(
          "[BulkCache] Sample sales IDs:",
          normalized.allIds.slice(0, 3),
        );
      })
      .addCase(fetchBulkSales.rejected, (state, action) => {
        const year = Number(action.meta?.arg?.year) || getCurrentYear();
        const yearKey = String(year);
        if (!state.sales.yearBuckets) state.sales.yearBuckets = {};
        if (!state.sales.yearBuckets[yearKey]) {
          state.sales.yearBuckets[yearKey] = createDataTypeState();
        }
        state.sales.yearBuckets[yearKey].meta.isLoading = false;
        state.sales.yearBuckets[yearKey].meta.error = action.payload;
        if (year === getCurrentYear()) {
          state.sales.meta.isLoading = false;
          state.sales.meta.error = action.payload;
        }
        console.error("[BulkCache] Failed to fetch sales:", action.payload);
      })

      // Expenses
      .addCase(fetchBulkExpenses.pending, (state, action) => {
        const year = Number(action.meta?.arg?.year) || getCurrentYear();
        const yearKey = String(year);
        if (!state.expenses.yearBuckets) state.expenses.yearBuckets = {};
        if (!state.expenses.yearBuckets[yearKey]) {
          state.expenses.yearBuckets[yearKey] = createDataTypeState();
        }
        state.expenses.yearBuckets[yearKey].meta.isLoading = true;
        state.expenses.yearBuckets[yearKey].meta.error = null;

        if (year === getCurrentYear()) {
          state.expenses.meta.isLoading = true;
          state.expenses.meta.error = null;
        }
      })
      .addCase(fetchBulkExpenses.fulfilled, (state, action) => {
        const year = Number(action.payload?.year) || getCurrentYear();
        const yearKey = String(year);
        if (!state.expenses.yearBuckets) state.expenses.yearBuckets = {};
        if (!state.expenses.yearBuckets[yearKey]) {
          state.expenses.yearBuckets[yearKey] = createDataTypeState();
        }

        if (action.payload.skipped) {
          console.log(
            `[BulkCache] ✓ Expenses cache still valid for ${yearKey}, skipped fetch`,
          );
          state.expenses.yearBuckets[yearKey].meta.isLoading = false;
          if (year === getCurrentYear()) {
            state.expenses.meta.isLoading = false;
          }
          return;
        }

        const {
          items,
          total,
          aggregatedStats,
          isComplete,
          resumePage = 1,
          pagesLoaded = 0,
        } = action.payload;
        const normalized = normalizeItems(items);

        const yearState = {
          byId: normalized.byId,
          allIds: normalized.allIds,
          meta: {
            total,
            loaded: items.length,
            isComplete,
            resumePage,
            pagesLoaded,
            lastFetchedAt: Date.now(),
            isLoading: false,
            error: null,
          },
          filters: state.expenses.yearBuckets[yearKey].filters || {},
          aggregatedStats,
        };

        state.expenses.yearBuckets[yearKey] = yearState;
        state.expenses.yearsLoaded = Array.from(
          new Set([...(state.expenses.yearsLoaded || []), year]),
        ).sort((a, b) => b - a);

        if (year === getCurrentYear()) {
          state.expenses.byId = yearState.byId;
          state.expenses.allIds = yearState.allIds;
          state.expenses.meta = yearState.meta;
          state.expenses.aggregatedStats = yearState.aggregatedStats;
        }

        if (
          typeof state.cacheValidUntil.expenses !== "object" ||
          state.cacheValidUntil.expenses === null
        ) {
          state.cacheValidUntil.expenses = {};
        }
        state.cacheValidUntil.expenses[yearKey] = Date.now() + CACHE_TTL;

        console.log(
          `[BulkCache] ✓ Loaded ${items.length}/${total} expenses for ${yearKey}. Complete: ${isComplete}`,
        );
        console.log(
          "[BulkCache] Sample expense IDs:",
          normalized.allIds.slice(0, 3),
        );
      })
      .addCase(fetchBulkExpenses.rejected, (state, action) => {
        const year = Number(action.meta?.arg?.year) || getCurrentYear();
        const yearKey = String(year);
        if (!state.expenses.yearBuckets) state.expenses.yearBuckets = {};
        if (!state.expenses.yearBuckets[yearKey]) {
          state.expenses.yearBuckets[yearKey] = createDataTypeState();
        }
        state.expenses.yearBuckets[yearKey].meta.isLoading = false;
        state.expenses.yearBuckets[yearKey].meta.error = action.payload;
        if (year === getCurrentYear()) {
          state.expenses.meta.isLoading = false;
          state.expenses.meta.error = action.payload;
        }
      })

      // Activities
      .addCase(fetchBulkActivities.pending, (state) => {
        state.activities.meta.isLoading = true;
        state.activities.meta.error = null;
      })
      .addCase(fetchBulkActivities.fulfilled, (state, action) => {
        if (action.payload.skipped) {
          console.log(
            "[BulkCache] ✓ Activities cache still valid, skipped fetch",
          );
          state.activities.meta.isLoading = false;
          return;
        }
        const {
          items,
          total,
          isComplete,
          resumePage = 1,
          pagesLoaded = 0,
        } = action.payload;
        const normalized = normalizeItems(items);
        state.activities.byId = normalized.byId;
        state.activities.allIds = normalized.allIds;
        state.activities.meta = {
          total,
          loaded: items.length,
          isComplete,
          resumePage,
          pagesLoaded,
          lastFetchedAt: Date.now(),
          isLoading: false,
          error: null,
        };
        state.cacheValidUntil.activities = Date.now() + CACHE_TTL;
        console.log(
          `[BulkCache] ✓ Loaded ${items.length}/${total} activities. Complete: ${isComplete}`,
        );
        console.log(
          "[BulkCache] Sample activity IDs:",
          normalized.allIds.slice(0, 3),
        );
      })
      .addCase(fetchBulkActivities.rejected, (state, action) => {
        state.activities.meta.isLoading = false;
        state.activities.meta.error = action.payload;
      })

      // Discounts
      .addCase(fetchBulkDiscounts.pending, (state) => {
        state.discounts.meta.isLoading = true;
        state.discounts.meta.error = null;
      })
      .addCase(fetchBulkDiscounts.fulfilled, (state, action) => {
        if (action.payload.skipped) {
          state.discounts.meta.isLoading = false;
          return;
        }
        const {
          items,
          total,
          isComplete,
          resumePage = 1,
          pagesLoaded = 0,
        } = action.payload;
        const normalized = normalizeItems(items);
        state.discounts.byId = normalized.byId;
        state.discounts.allIds = normalized.allIds;
        state.discounts.meta = {
          total,
          loaded: items.length,
          isComplete,
          resumePage,
          pagesLoaded,
          lastFetchedAt: Date.now(),
          isLoading: false,
          error: null,
        };
        state.cacheValidUntil.discounts = Date.now() + CACHE_TTL;
      })
      .addCase(fetchBulkDiscounts.rejected, (state, action) => {
        state.discounts.meta.isLoading = false;
        state.discounts.meta.error = action.payload;
      })

      // Marketplace Orders
      .addCase(fetchBulkMarketplaceOrders.pending, (state) => {
        state.marketplaceOrders.meta.isLoading = true;
        state.marketplaceOrders.meta.error = null;
      })
      .addCase(fetchBulkMarketplaceOrders.fulfilled, (state, action) => {
        if (action.payload.skipped) {
          state.marketplaceOrders.meta.isLoading = false;
          return;
        }
        const {
          items,
          total,
          isComplete,
          resumePage = 1,
          pagesLoaded = 1,
        } = action.payload;
        const normalized = normalizeItems(items);
        state.marketplaceOrders.byId = normalized.byId;
        state.marketplaceOrders.allIds = normalized.allIds;
        state.marketplaceOrders.meta = {
          total,
          loaded: items.length,
          isComplete,
          resumePage,
          pagesLoaded,
          lastFetchedAt: Date.now(),
          isLoading: false,
          error: null,
        };
        state.cacheValidUntil.marketplaceOrders = Date.now() + CACHE_TTL;
      })
      .addCase(fetchBulkMarketplaceOrders.rejected, (state, action) => {
        state.marketplaceOrders.meta.isLoading = false;
        state.marketplaceOrders.meta.error = action.payload;
      })

      // Fulfilments
      .addCase(fetchBulkFulfilments.pending, (state) => {
        state.fulfilments.meta.isLoading = true;
        state.fulfilments.meta.error = null;
      })
      .addCase(fetchBulkFulfilments.fulfilled, (state, action) => {
        if (action.payload.skipped) {
          console.log(
            "[BulkCache] ✓ Fulfilments cache still valid, skipped fetch",
          );
          state.fulfilments.meta.isLoading = false;
          return;
        }
        const {
          items,
          total,
          isComplete,
          resumePage = 1,
          pagesLoaded = 0,
        } = action.payload;
        const normalized = normalizeItems(items);
        state.fulfilments.byId = normalized.byId;
        state.fulfilments.allIds = normalized.allIds;
        state.fulfilments.meta = {
          total,
          loaded: items.length,
          isComplete,
          resumePage,
          pagesLoaded,
          lastFetchedAt: Date.now(),
          isLoading: false,
          error: null,
        };
        state.cacheValidUntil.fulfilments = Date.now() + CACHE_TTL;
        console.log(
          `[BulkCache] ✓ Loaded ${items.length}/${total} fulfilments. Complete: ${isComplete}`,
        );
        console.log(
          "[BulkCache] Sample fulfilment IDs:",
          normalized.allIds.slice(0, 3),
        );
      })
      .addCase(fetchBulkFulfilments.rejected, (state, action) => {
        state.fulfilments.meta.isLoading = false;
        state.fulfilments.meta.error = action.payload;
      })

      // Customers
      .addCase(fetchBulkCustomers.pending, (state) => {
        state.customers.meta.isLoading = true;
        state.customers.meta.error = null;
      })
      .addCase(fetchBulkCustomers.fulfilled, (state, action) => {
        if (action.payload.skipped) {
          state.customers.meta.isLoading = false;
          return;
        }
        const {
          items,
          total,
          isComplete,
          resumePage = 1,
          pagesLoaded = 1,
        } = action.payload;
        // Customers may use phone as unique identifier
        const byId = {};
        const allIds = [];
        items.forEach((item) => {
          const id = item._id || item.phone || `${item.phone}-${item.email}`;
          if (id) {
            byId[id] = item;
            allIds.push(id);
          }
        });
        state.customers.byId = byId;
        state.customers.allIds = allIds;
        state.customers.meta = {
          total,
          loaded: items.length,
          isComplete,
          resumePage,
          pagesLoaded,
          lastFetchedAt: Date.now(),
          isLoading: false,
          error: null,
        };
        state.cacheValidUntil.customers = Date.now() + CACHE_TTL;
        console.log(
          `[BulkCache] Loaded ${items.length}/${total} customers. Complete: ${isComplete}`,
        );
      })
      .addCase(fetchBulkCustomers.rejected, (state, action) => {
        state.customers.meta.isLoading = false;
        state.customers.meta.error = action.payload;
      })

      // Product Groups
      .addCase(fetchBulkProductGroups.pending, (state) => {
        state.productGroups.meta.isLoading = true;
        state.productGroups.meta.error = null;
      })
      .addCase(fetchBulkProductGroups.fulfilled, (state, action) => {
        if (action.payload.skipped) {
          state.productGroups.meta.isLoading = false;
          return;
        }
        const {
          items,
          total,
          aggregatedStats,
          isComplete,
          resumePage = 1,
          pagesLoaded = 0,
        } = action.payload;
        const normalized = normalizeItems(items);
        state.productGroups.byId = normalized.byId;
        state.productGroups.allIds = normalized.allIds;
        state.productGroups.meta = {
          total,
          loaded: items.length,
          isComplete,
          resumePage,
          pagesLoaded,
          lastFetchedAt: Date.now(),
          isLoading: false,
          error: null,
        };
        state.productGroups.aggregatedStats = aggregatedStats;
        state.cacheValidUntil.productGroups = Date.now() + CACHE_TTL;
        console.log(
          `[BulkCache] Loaded ${items.length}/${total} product groups. Complete: ${isComplete}`,
        );
      })
      .addCase(fetchBulkProductGroups.rejected, (state, action) => {
        state.productGroups.meta.isLoading = false;
        state.productGroups.meta.error = action.payload;
      })

      // Out of Stock
      .addCase(fetchBulkOutOfStock.pending, (state) => {
        state.outOfStock.products.meta.isLoading = true;
        state.outOfStock.productGroups.meta.isLoading = true;
      })
      .addCase(fetchBulkOutOfStock.fulfilled, (state, action) => {
        if (action.payload.skipped) {
          state.outOfStock.products.meta.isLoading = false;
          state.outOfStock.productGroups.meta.isLoading = false;
          return;
        }
        const {
          products,
          productGroups,
          productsTotal,
          productGroupsTotal,
          isComplete,
        } = action.payload;

        // Normalize products
        const normalizedProducts = normalizeItems(products);
        state.outOfStock.products.byId = normalizedProducts.byId;
        state.outOfStock.products.allIds = normalizedProducts.allIds;
        state.outOfStock.products.meta = {
          total: productsTotal,
          loaded: products.length,
          isComplete,
          resumePage: 1,
          pagesLoaded: 1,
          lastFetchedAt: Date.now(),
          isLoading: false,
          error: null,
        };

        // Normalize product groups
        const normalizedGroups = normalizeItems(productGroups);
        state.outOfStock.productGroups.byId = normalizedGroups.byId;
        state.outOfStock.productGroups.allIds = normalizedGroups.allIds;
        state.outOfStock.productGroups.meta = {
          total: productGroupsTotal,
          loaded: productGroups.length,
          isComplete,
          resumePage: 1,
          pagesLoaded: 1,
          lastFetchedAt: Date.now(),
          isLoading: false,
          error: null,
        };

        state.cacheValidUntil.outOfStock = Date.now() + CACHE_TTL;
        console.log(
          `[BulkCache] Loaded ${products.length} out-of-stock products, ${productGroups.length} groups`,
        );
      })
      .addCase(fetchBulkOutOfStock.rejected, (state, action) => {
        state.outOfStock.products.meta.isLoading = false;
        state.outOfStock.productGroups.meta.isLoading = false;
        state.outOfStock.products.meta.error = action.payload;
      });
  },
});

export const {
  invalidateBulkCache,
  invalidateAllBulkCaches,
  forceClearBulkLoading,
  updateBulkCacheItem,
  removeBulkCacheItem,
  addBulkCacheItem,
  addOutOfStockProduct,
  removeOutOfStockProduct,
  addOutOfStockGroup,
  removeOutOfStockGroup,
  resetBulkDataCache,
  RESET_SESSION,
} = bulkDataCacheSlice.actions;

const selectBulkDataCacheRoot = (state) => state?.bulkDataCache || initialState;

// Base selectors
export const selectBulkSales = (state) => selectBulkDataCacheRoot(state).sales;
export const selectBulkExpenses = (state) =>
  selectBulkDataCacheRoot(state).expenses;
export const selectBulkActivities = (state) =>
  selectBulkDataCacheRoot(state).activities;
export const selectBulkFulfilments = (state) =>
  selectBulkDataCacheRoot(state).fulfilments;
export const selectBulkCustomers = (state) =>
  selectBulkDataCacheRoot(state).customers;
export const selectBulkProductGroups = (state) =>
  selectBulkDataCacheRoot(state).productGroups;
export const selectBulkDiscounts = (state) =>
  selectBulkDataCacheRoot(state).discounts;
export const selectBulkMarketplaceOrders = (state) =>
  selectBulkDataCacheRoot(state).marketplaceOrders;
export const selectBulkOutOfStock = (state) =>
  selectBulkDataCacheRoot(state).outOfStock;

export const selectSalesMetaByYear = (year) => (state) => {
  const root = selectBulkDataCacheRoot(state);
  const yearKey = String(Number(year) || getCurrentYear());
  return root.sales?.yearBuckets?.[yearKey]?.meta || createDataTypeState().meta;
};

export const selectExpensesMetaByYear = (year) => (state) => {
  const root = selectBulkDataCacheRoot(state);
  const yearKey = String(Number(year) || getCurrentYear());
  return (
    root.expenses?.yearBuckets?.[yearKey]?.meta || createDataTypeState().meta
  );
};

export const selectSalesYearsLoaded = (state) =>
  selectBulkDataCacheRoot(state).sales?.yearsLoaded || [];

export const selectExpensesYearsLoaded = (state) =>
  selectBulkDataCacheRoot(state).expenses?.yearsLoaded || [];

// Meta selectors
export const selectSalesMeta = (state) => selectBulkDataCacheRoot(state).sales.meta;
export const selectExpensesMeta = (state) =>
  selectBulkDataCacheRoot(state).expenses.meta;
export const selectActivitiesMeta = (state) =>
  selectBulkDataCacheRoot(state).activities.meta;
export const selectFulfilmentsMeta = (state) =>
  selectBulkDataCacheRoot(state).fulfilments.meta;
export const selectCustomersMeta = (state) =>
  selectBulkDataCacheRoot(state).customers.meta;
export const selectProductGroupsMeta = (state) =>
  selectBulkDataCacheRoot(state).productGroups.meta;
export const selectDiscountsMeta = (state) =>
  selectBulkDataCacheRoot(state).discounts.meta;
export const selectMarketplaceOrdersMeta = (state) =>
  selectBulkDataCacheRoot(state).marketplaceOrders.meta;

// Array selectors (for convenience)
export const selectSalesArray = createSelector([selectBulkSales], (sales) =>
  sales.allIds.map((id) => sales.byId[id]).filter(Boolean),
);

export const selectExpensesArray = createSelector(
  [selectBulkExpenses],
  (expenses) => expenses.allIds.map((id) => expenses.byId[id]).filter(Boolean),
);

export const selectSalesArrayByYear = (year) => (state) => {
  const sales = selectBulkDataCacheRoot(state).sales;
  const yearKey = String(Number(year) || getCurrentYear());
  const bucket = sales?.yearBuckets?.[yearKey];
  if (!bucket) return [];
  return bucket.allIds.map((id) => bucket.byId[id]).filter(Boolean);
};

export const selectExpensesArrayByYear = (year) => (state) => {
  const expenses = selectBulkDataCacheRoot(state).expenses;
  const yearKey = String(Number(year) || getCurrentYear());
  const bucket = expenses?.yearBuckets?.[yearKey];
  if (!bucket) return [];
  return bucket.allIds.map((id) => bucket.byId[id]).filter(Boolean);
};

export const selectActivitiesArray = createSelector(
  [selectBulkActivities],
  (activities) =>
    activities.allIds.map((id) => activities.byId[id]).filter(Boolean),
);

export const selectFulfilmentsArray = createSelector(
  [selectBulkFulfilments],
  (fulfilments) =>
    fulfilments.allIds.map((id) => fulfilments.byId[id]).filter(Boolean),
);

export const selectCustomersArray = createSelector(
  [selectBulkCustomers],
  (customers) =>
    customers.allIds.map((id) => customers.byId[id]).filter(Boolean),
);

export const selectProductGroupsArray = createSelector(
  [selectBulkProductGroups],
  (groups) => groups.allIds.map((id) => groups.byId[id]).filter(Boolean),
);

export const selectDiscountsArray = createSelector(
  [selectBulkDiscounts],
  (discounts) =>
    discounts.allIds.map((id) => discounts.byId[id]).filter(Boolean),
);

export const selectMarketplaceOrdersArray = createSelector(
  [selectBulkMarketplaceOrders],
  (orders) => orders.allIds.map((id) => orders.byId[id]).filter(Boolean),
);

export const selectOutOfStockProductsArray = createSelector(
  [selectBulkOutOfStock],
  (oos) =>
    oos.products.allIds.map((id) => oos.products.byId[id]).filter(Boolean),
);

export const selectOutOfStockGroupsArray = createSelector(
  [selectBulkOutOfStock],
  (oos) =>
    oos.productGroups.allIds
      .map((id) => oos.productGroups.byId[id])
      .filter(Boolean),
);

// Can paginate locally selectors
export const selectCanPaginateSalesLocally = createSelector(
  [selectSalesMeta],
  (meta) => meta.isComplete && meta.loaded > 0,
);

export const selectCanPaginateExpensesLocally = createSelector(
  [selectExpensesMeta],
  (meta) => meta.isComplete && meta.loaded > 0,
);

export const selectCanPaginateActivitiesLocally = createSelector(
  [selectActivitiesMeta],
  (meta) => meta.isComplete && meta.loaded > 0,
);

export const selectCanPaginateFulfilmentsLocally = createSelector(
  [selectFulfilmentsMeta],
  (meta) => meta.isComplete && meta.loaded > 0,
);

export const selectCanPaginateCustomersLocally = createSelector(
  [selectCustomersMeta],
  (meta) => meta.isComplete && meta.loaded > 0,
);

export const selectCanPaginateProductGroupsLocally = createSelector(
  [selectProductGroupsMeta],
  (meta) => meta.isComplete && meta.loaded > 0,
);

export const selectCanPaginateDiscountsLocally = createSelector(
  [selectDiscountsMeta],
  (meta) => meta.isComplete && meta.loaded > 0,
);

export const selectCanPaginateMarketplaceOrdersLocally = createSelector(
  [selectMarketplaceOrdersMeta],
  (meta) => meta.isComplete && meta.loaded > 0,
);

export default bulkDataCacheSlice.reducer;
