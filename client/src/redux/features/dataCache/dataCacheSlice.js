/**
 * Data Cache Slice
 *
 * Centralized cache management for session-scoped data.
 * Tracks data freshness, loading states, and bootstrap status.
 *
 * This slice enables the app to:
 * - Fetch data once per session
 * - Track when data was last fetched
 * - Determine if data is stale
 * - Prevent duplicate fetches
 * - Invalidate specific data via realtime events
 * - Track in-flight fetches to prevent duplicate requests
 *
 * ARCHITECTURE NOTE:
 * All cache state MUST live in Redux (not component refs) because
 * components remount on navigation. Redux state persists across the session.
 */

import { createSlice } from "@reduxjs/toolkit";

// Cache TTL in milliseconds (5 minutes default, adjust as needed)
const DEFAULT_CACHE_TTL = 5 * 60 * 1000;

// Data that should be fetched at session start (bootstrap data)
export const BOOTSTRAP_DATA = {
  DASHBOARD_STATS: "dashboardStats",
  BUSINESS_INFO: "businessInfo",
  CART: "cart",
  INCOMPLETE_PAYMENTS: "incompletePayments",
  FILTER_OPTIONS: "filterOptions",
  ADMIN_BUSINESSES: "adminBusinesses",
  ADMIN_APPLICATIONS: "adminApplications",
};

// Data that is page-specific with pagination (not bootstrapped)
export const PAGINATED_DATA = {
  PRODUCTS: "products",
  PRODUCT_GROUPS: "productGroups",
  SALES: "sales",
  OUT_OF_STOCK: "outOfStock",
  TOP_PRODUCTS: "topProducts",
  LOW_PRODUCTS: "lowProducts",
  SALES_BY_YEAR: "salesByYear",
  EXPENSES: "expenses",
  ACTIVITIES: "activities",
  FULFILMENTS: "fulfilments", // Paginated incomplete payments for fulfilment page
  CUSTOMERS: "customers",
  CHECKOUT_YEARS: "checkoutYears",
};

const createCacheEntry = () => ({
  lastFetched: null,
  isLoading: false,
  isFetched: false,
  isStale: false,
  error: null,
  ttl: DEFAULT_CACHE_TTL,
});

const initialState = {
  // Bootstrap status
  isBootstrapped: false,
  isBootstrapping: false,
  bootstrapPhase: "idle",
  backgroundBootstrap: {
    startedAt: null,
    completedAt: null,
    totalTasks: 0,
    completedTasks: 0,
    errors: 0,
  },
  bootstrapError: null,

  // Session ID (changes on login/logout)
  sessionId: null,

  // Track in-flight fetches to prevent duplicate requests
  // Key format: "dataKey:pageKey" -> timestamp when fetch started
  fetchesInProgress: {},

  // Cache entries for each data type
  cache: {
    // Bootstrap data
    [BOOTSTRAP_DATA.DASHBOARD_STATS]: createCacheEntry(),
    [BOOTSTRAP_DATA.BUSINESS_INFO]: createCacheEntry(),
    [BOOTSTRAP_DATA.CART]: createCacheEntry(),
    [BOOTSTRAP_DATA.INCOMPLETE_PAYMENTS]: createCacheEntry(),
    [BOOTSTRAP_DATA.FILTER_OPTIONS]: createCacheEntry(),
    [BOOTSTRAP_DATA.ADMIN_BUSINESSES]: createCacheEntry(),
    [BOOTSTRAP_DATA.ADMIN_APPLICATIONS]: createCacheEntry(),

    // Paginated data (tracked differently - by page/filter hash)
    [PAGINATED_DATA.PRODUCTS]: { ...createCacheEntry(), pages: {} },
    [PAGINATED_DATA.PRODUCT_GROUPS]: { ...createCacheEntry(), pages: {} },
    [PAGINATED_DATA.SALES]: { ...createCacheEntry(), pages: {} },
    [PAGINATED_DATA.OUT_OF_STOCK]: { ...createCacheEntry(), pages: {} },
    [PAGINATED_DATA.TOP_PRODUCTS]: createCacheEntry(),
    [PAGINATED_DATA.LOW_PRODUCTS]: createCacheEntry(),
    [PAGINATED_DATA.SALES_BY_YEAR]: { ...createCacheEntry(), years: {} },
    [PAGINATED_DATA.EXPENSES]: { ...createCacheEntry(), pages: {} },
    [PAGINATED_DATA.ACTIVITIES]: { ...createCacheEntry(), pages: {} },
    [PAGINATED_DATA.FULFILMENTS]: { ...createCacheEntry(), pages: {} },
    [PAGINATED_DATA.CUSTOMERS]: createCacheEntry(),
    [PAGINATED_DATA.CHECKOUT_YEARS]: createCacheEntry(),
  },
};

const dataCacheSlice = createSlice({
  name: "dataCache",
  initialState,
  reducers: {
    // Start a new session (on login)
    startSession: (state, action) => {
      state.sessionId = action.payload || Date.now().toString();
      state.isBootstrapped = false;
      state.isBootstrapping = false;
      state.bootstrapPhase = "idle";
      state.backgroundBootstrap = {
        startedAt: null,
        completedAt: null,
        totalTasks: 0,
        completedTasks: 0,
        errors: 0,
      };
      state.bootstrapError = null;
      state.fetchesInProgress = {}; // Clear all in-flight fetches

      // Reset all cache entries
      Object.keys(state.cache).forEach((key) => {
        state.cache[key] =
          key.includes("pages") || key.includes("years")
            ? { ...createCacheEntry(), pages: {}, years: {} }
            : createCacheEntry();
      });
    },

    // End session (on logout) - CRITICAL: Resets all cache and bootstrap flags
    endSession: (state) => {
      return initialState;
    },
    // Alias for clarity in logout flow
    RESET_SESSION: (state) => {
      return initialState;
    },

    // Bootstrap started
    startBootstrap: (state) => {
      state.isBootstrapping = true;
      state.bootstrapPhase = "critical";
      state.bootstrapError = null;
    },

    // Bootstrap completed
    completeBootstrap: (state) => {
      state.isBootstrapped = true;
      state.isBootstrapping = false;
      state.bootstrapPhase = "critical-complete";
    },

    startBackgroundBootstrap: (state, action) => {
      const totalTasks = Number(action.payload?.totalTasks || 0);
      state.bootstrapPhase = "background";
      state.backgroundBootstrap = {
        startedAt: Date.now(),
        completedAt: null,
        totalTasks,
        completedTasks: 0,
        errors: 0,
      };
    },

    markBackgroundTaskComplete: (state, action) => {
      const hasError = Boolean(action.payload?.hasError);
      state.backgroundBootstrap.completedTasks += 1;
      if (hasError) {
        state.backgroundBootstrap.errors += 1;
      }

      if (
        state.backgroundBootstrap.totalTasks > 0 &&
        state.backgroundBootstrap.completedTasks >=
          state.backgroundBootstrap.totalTasks
      ) {
        state.bootstrapPhase = "ready";
        state.backgroundBootstrap.completedAt = Date.now();
      }
    },

    // Bootstrap failed
    failBootstrap: (state, action) => {
      state.isBootstrapping = false;
      state.bootstrapPhase = "error";
      state.bootstrapError = action.payload;
    },

    // Mark data as loading
    setLoading: (state, action) => {
      const { dataKey, isLoading } = action.payload;
      if (state.cache[dataKey]) {
        state.cache[dataKey].isLoading = isLoading;
      }
    },

    // Mark data as fetched
    setFetched: (state, action) => {
      const { dataKey, timestamp } = action.payload;
      if (state.cache[dataKey]) {
        state.cache[dataKey].isFetched = true;
        state.cache[dataKey].lastFetched = timestamp || Date.now();
        state.cache[dataKey].isLoading = false;
        state.cache[dataKey].isStale = false;
        state.cache[dataKey].error = null;
      }
    },

    // Mark page-specific data as fetched
    setPageFetched: (state, action) => {
      const { dataKey, pageKey, timestamp } = action.payload;
      if (state.cache[dataKey]) {
        if (!state.cache[dataKey].pages) {
          state.cache[dataKey].pages = {};
        }
        state.cache[dataKey].pages[pageKey] = {
          lastFetched: timestamp || Date.now(),
          isStale: false,
        };
        state.cache[dataKey].isFetched = true;
        state.cache[dataKey].lastFetched = timestamp || Date.now();
        state.cache[dataKey].isLoading = false;
      }
    },

    // Mark data as stale (needs refresh)
    invalidateCache: (state, action) => {
      const dataKey = action.payload;
      if (state.cache[dataKey]) {
        state.cache[dataKey].isStale = true;
        // Also invalidate all pages if paginated
        if (state.cache[dataKey].pages) {
          Object.keys(state.cache[dataKey].pages).forEach((pageKey) => {
            state.cache[dataKey].pages[pageKey].isStale = true;
          });
        }
      }
    },

    // Invalidate all caches (e.g., on significant change)
    invalidateAllCaches: (state) => {
      Object.keys(state.cache).forEach((key) => {
        state.cache[key].isStale = true;
        if (state.cache[key].pages) {
          Object.keys(state.cache[key].pages).forEach((pageKey) => {
            state.cache[key].pages[pageKey].isStale = true;
          });
        }
      });
    },

    // Set fetch error
    setFetchError: (state, action) => {
      const { dataKey, error } = action.payload;
      if (state.cache[dataKey]) {
        state.cache[dataKey].error = error;
        state.cache[dataKey].isLoading = false;
      }
    },

    // Update TTL for specific data
    setTTL: (state, action) => {
      const { dataKey, ttl } = action.payload;
      if (state.cache[dataKey]) {
        state.cache[dataKey].ttl = ttl;
      }
    },

    // Mark a fetch as in-progress (prevents duplicate fetches across component remounts)
    markFetchInProgress: (state, action) => {
      const { dataKey, pageKey } = action.payload;
      const key = `${dataKey}:${pageKey}`;
      state.fetchesInProgress[key] = Date.now();
    },

    // Clear fetch-in-progress flag
    clearFetchInProgress: (state, action) => {
      const { dataKey, pageKey } = action.payload;
      const key = `${dataKey}:${pageKey}`;
      delete state.fetchesInProgress[key];
    },

    // Reset session - clear all fetches in progress and cache
    resetSession: (state) => {
      state.fetchesInProgress = {};
      state.isBootstrapped = false;
      state.isBootstrapping = false;
      Object.keys(state.cache).forEach((key) => {
        if (state.cache[key].pages) {
          state.cache[key].pages = {};
        }
        state.cache[key].isFetched = false;
        state.cache[key].isStale = false;
        state.cache[key].lastFetched = null;
      });
    },
  },
});

export const {
  startSession,
  endSession,
  startBootstrap,
  completeBootstrap,
  startBackgroundBootstrap,
  markBackgroundTaskComplete,
  failBootstrap,
  setLoading,
  setFetched,
  setPageFetched,
  invalidateCache,
  invalidateAllCaches,
  setFetchError,
  setTTL,
  markFetchInProgress,
  clearFetchInProgress,
  resetSession,
  RESET_SESSION,
} = dataCacheSlice.actions;

// Selectors
export const selectIsBootstrapped = (state) => state.dataCache.isBootstrapped;
export const selectIsBootstrapping = (state) => state.dataCache.isBootstrapping;
export const selectSessionId = (state) => state.dataCache.sessionId;
export const selectBootstrapPhase = (state) => state.dataCache.bootstrapPhase;
export const selectBackgroundBootstrap = (state) =>
  state.dataCache.backgroundBootstrap;

export const selectCacheEntry = (dataKey) => (state) =>
  state.dataCache.cache[dataKey] || createCacheEntry();

export const selectIsCached = (dataKey) => (state) => {
  const entry = state.dataCache.cache[dataKey];
  if (!entry) return false;

  const now = Date.now();
  const isExpired = entry.lastFetched && now - entry.lastFetched > entry.ttl;

  return entry.isFetched && !entry.isStale && !isExpired;
};

export const selectIsPageCached = (dataKey, pageKey) => (state) => {
  const entry = state.dataCache.cache[dataKey];
  if (!entry || !entry.pages || !entry.pages[pageKey]) return false;

  const page = entry.pages[pageKey];
  const now = Date.now();
  const ttl = entry.ttl || DEFAULT_CACHE_TTL;
  const isExpired = page.lastFetched && now - page.lastFetched > ttl;

  return !page.isStale && !isExpired;
};

// Check if a fetch is currently in progress for this dataKey+pageKey
export const selectIsFetchInProgress = (dataKey, pageKey) => (state) => {
  const key = `${dataKey}:${pageKey}`;
  const startTime = state.dataCache.fetchesInProgress[key];

  if (!startTime) return false;

  // Consider a fetch stale after 30 seconds (safety valve for crashed fetches)
  const FETCH_TIMEOUT = 30 * 1000;
  const isStale = Date.now() - startTime > FETCH_TIMEOUT;

  return !isStale;
};

export const selectShouldFetch = (dataKey) => (state) => {
  const entry = state.dataCache.cache[dataKey];
  if (!entry) return true;

  // Should fetch if:
  // - Never fetched
  // - Marked as stale
  // - TTL expired
  // - Not currently loading
  if (entry.isLoading) return false;
  if (!entry.isFetched) return true;
  if (entry.isStale) return true;

  const now = Date.now();
  const isExpired = entry.lastFetched && now - entry.lastFetched > entry.ttl;

  return isExpired;
};

export default dataCacheSlice.reducer;
