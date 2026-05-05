/**
 * Product Cache Slice
 *
 * Manages comprehensive product caching with:
 * - Bulk data loading for client-side pagination
 * - All-products cache for local search capability
 * - Dataset completeness tracking
 * - State-first search AND pagination with backend fallback
 * - Cursor/page tracking for incremental loading
 *
 * ARCHITECTURE:
 * - Products are stored in a normalized map for O(1) lookups
 * - Bulk loading fetches all products at once (up to threshold)
 * - Completeness is tracked for the full dataset
 * - Search AND pagination run locally when dataset is complete
 * - Backend is only used as fallback when data is incomplete
 *
 * PAGINATION STRATEGY:
 * - On bootstrap, load all products in bulk (up to 1000)
 * - UI pagination slices from Redux state, NOT backend
 * - Page navigation never triggers backend calls when data is loaded
 * - Backend calls only happen for: initial load, mutations, realtime invalidation
 */

import {
  createSlice,
  createAsyncThunk,
  createSelector,
} from "@reduxjs/toolkit";
import productService from "./productService";

// Constants
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes
const CURSOR_BACKFILL_LIMIT = 500;
const MAX_BACKFILL_PAGES = 100;
const MAX_LOCAL_SEARCH_THRESHOLD = 5000; // Max products for efficient local search

/**
 * Generate a stable key for a filter configuration
 */
const generateFilterKey = (filters = {}) => {
  const { category = [], warehouse = [], priceRange = [] } = filters;
  return JSON.stringify({
    category: [...category].sort(),
    warehouse: [...warehouse].sort(),
    priceRange: [...priceRange].sort(),
  });
};

const initialState = {
  // Normalized product storage: { [productId]: product }
  productsById: {},

  // All product IDs in order (for the unfiltered dataset)
  allProductIds: [],

  // Track loaded pages per filter configuration
  // { [filterKey]: { loadedPages: Set<number>, totalPages: number, total: number, isComplete: boolean } }
  paginationState: {},

  // Current filter configuration
  currentFilterKey: generateFilterKey(),

  // Dataset completeness for local search
  datasetMeta: {
    totalProducts: 0,
    loadedProducts: 0,
    isComplete: false,
    lastFullFetchAt: null,
    resumeCursor: null,
  },

  // Search state
  search: {
    query: "",
    isSearching: false,
    searchMode: "local", // "local" | "remote" | "hybrid"
    localResults: [],
    remoteResults: [],
    lastSearchAt: null,
  },

  // Background loading state (doesn't block UI)
  backgroundLoading: {
    isActive: false,
    progress: 0,
    currentPage: 0,
    totalPages: 0,
  },

  // Timestamps
  lastUpdatedAt: null,
  cacheValidUntil: null,
};

/**
 * Fetch all products in bulk for client-side pagination and search
 * Uses the bulk endpoint for efficient single-request loading
 * This runs in the background and doesn't block UI
 */
export const fetchAllProductsForSearch = createAsyncThunk(
  "productCache/fetchAllProductsForSearch",
  async ({ force = false } = {}, { getState, dispatch, rejectWithValue }) => {
    try {
      const state = getState();
      const { datasetMeta, cacheValidUntil } = state.productCache;

      // Check if we already have complete data and it's not stale
      if (
        !force &&
        datasetMeta.isComplete &&
        cacheValidUntil &&
        Date.now() < cacheValidUntil
      ) {
        console.log(
          "[ProductCache] Dataset is complete and valid, skipping fetch",
        );
        return { skipped: true };
      }

      dispatch(
        setBackgroundLoading({
          isActive: true,
          progress: 0,
          currentPage: 0,
          totalPages: MAX_BACKFILL_PAGES,
        }),
      );

      const startedAt = performance.now();
      let cursor = state.productCache?.datasetMeta?.resumeCursor || null;
      let hasMore = true;
      let total = 0;
      let currentPage = 0;
      const products = [];

      while (hasMore && currentPage < MAX_BACKFILL_PAGES) {
        currentPage += 1;
        const result = await productService.getProductsCursor({
          cursor,
          limit: CURSOR_BACKFILL_LIMIT,
        });

        const batch = Array.isArray(result?.products) ? result.products : [];
        products.push(...batch);

        const pagination = result?.pagination || {};
        total = Number(result?.total || pagination?.total || total || 0);
        cursor = pagination?.nextCursor || null;
        hasMore = Boolean(pagination?.hasMore);

        const progress = hasMore
          ? Math.min(
              99,
              Math.round((products.length / Math.max(total || 1, 1)) * 100),
            )
          : 100;

        dispatch(
          setBackgroundLoading({
            isActive: true,
            progress,
            currentPage,
            totalPages: Math.max(
              1,
              Math.ceil((total || 1) / CURSOR_BACKFILL_LIMIT),
            ),
          }),
        );
      }

      const isComplete = !hasMore;

      console.info("[ProductCache] cursor_backfill_complete", {
        durationMs: Number((performance.now() - startedAt).toFixed(2)),
        loaded: products.length,
        total,
        pagesLoaded: currentPage,
        isComplete,
      });

      return {
        products,
        total,
        isComplete,
        resumeCursor: isComplete ? null : cursor,
      };
    } catch (error) {
      const message =
        error.response?.data?.message || error.message || error.toString();
      return rejectWithValue(message);
    }
  },
  {
    // Prevent duplicate concurrent fetches
    condition: (_, { getState }) => {
      const { backgroundLoading } = getState().productCache;
      return !backgroundLoading.isActive;
    },
  },
);

/**
 * Search products - uses local search when possible, falls back to remote
 */
export const searchProducts = createAsyncThunk(
  "productCache/searchProducts",
  async (
    { query, filters = {}, page = 1, limit = 10 },
    { getState, rejectWithValue },
  ) => {
    try {
      const state = getState();
      const { productsById, allProductIds, datasetMeta } = state.productCache;

      // If dataset is complete and query exists, search locally
      if (datasetMeta.isComplete && query) {
        console.log("[ProductCache] Performing local search for:", query);

        const queryLower = query.toLowerCase();
        const matchingProducts = allProductIds
          .map((id) => productsById[id])
          .filter((product) => {
            if (!product) return false;

            // Search in name, sku, category, description
            const searchFields = [
              product.name,
              product.sku,
              product.category,
              product.description,
              product.warehouse,
            ].filter(Boolean);

            return searchFields.some((field) =>
              field.toLowerCase().includes(queryLower),
            );
          });

        // Apply filters
        let filteredProducts = matchingProducts;
        if (filters.category?.length > 0) {
          filteredProducts = filteredProducts.filter((p) =>
            filters.category.includes(p.category),
          );
        }
        if (filters.warehouse?.length > 0) {
          filteredProducts = filteredProducts.filter((p) =>
            filters.warehouse.includes(p.warehouse),
          );
        }

        // Paginate locally
        const startIndex = (page - 1) * limit;
        const paginatedProducts = filteredProducts.slice(
          startIndex,
          startIndex + limit,
        );

        return {
          mode: "local",
          products: paginatedProducts,
          total: filteredProducts.length,
          currentPage: page,
          totalPages: Math.ceil(filteredProducts.length / limit),
          hasMore: startIndex + limit < filteredProducts.length,
        };
      }

      // Fall back to remote search
      console.log("[ProductCache] Falling back to remote search for:", query);
      const result = await productService.getProducts({
        page,
        limit,
        search: query,
        ...filters,
      });

      return {
        mode: "remote",
        products: result.products,
        total: result.total,
        currentPage: result.currentPage,
        totalPages: result.totalPages,
        hasMore: result.hasMore,
      };
    } catch (error) {
      const message =
        error.response?.data?.message || error.message || error.toString();
      return rejectWithValue(message);
    }
  },
);

const productCacheSlice = createSlice({
  name: "productCache",
  initialState,
  reducers: {
    // Update a single product (for realtime updates)
    updateProduct: (state, action) => {
      const product = action.payload;
      if (product && product._id) {
        const exists = Boolean(state.productsById[product._id]);
        state.productsById[product._id] = {
          ...(state.productsById[product._id] || {}),
          ...product,
        };
        if (!exists) {
          state.allProductIds.push(product._id);
          state.datasetMeta.loadedProducts += 1;
          state.datasetMeta.totalProducts += 1;
        }
        state.lastUpdatedAt = Date.now();
      }
    },

    // Remove a product (for realtime deletes)
    removeProduct: (state, action) => {
      const productId = action.payload;
      delete state.productsById[productId];
      state.allProductIds = state.allProductIds.filter(
        (id) => id !== productId,
      );
      state.datasetMeta.loadedProducts = Math.max(
        0,
        state.datasetMeta.loadedProducts - 1,
      );
      state.lastUpdatedAt = Date.now();
    },

    // Add a new product (for realtime creates)
    addProduct: (state, action) => {
      const product = action.payload;
      if (product && product._id && !state.productsById[product._id]) {
        state.productsById[product._id] = product;
        state.allProductIds.unshift(product._id); // Add to beginning
        state.datasetMeta.loadedProducts += 1;
        state.datasetMeta.totalProducts += 1;
        state.lastUpdatedAt = Date.now();
      }
    },

    // Invalidate cache (triggers refetch on next access)
    invalidateProductCache: (state) => {
      state.datasetMeta.isComplete = false;
      state.cacheValidUntil = null;
    },

    // Set background loading state
    setBackgroundLoading: (state, action) => {
      state.backgroundLoading = {
        ...state.backgroundLoading,
        ...action.payload,
      };
    },

    // Set search query (for debounced search)
    setSearchQuery: (state, action) => {
      state.search.query = action.payload;
    },

    // Clear search
    clearSearch: (state) => {
      state.search = initialState.search;
    },

    // Reset cache on logout
    resetProductCache: () => initialState,
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchAllProductsForSearch.pending, (state) => {
        state.backgroundLoading.isActive = true;
      })
      .addCase(fetchAllProductsForSearch.fulfilled, (state, action) => {
        if (action.payload.skipped) {
          state.backgroundLoading.isActive = false;
          return;
        }

        const { products, total, isComplete, resumeCursor } = action.payload;

        // Normalize products into map
        products.forEach((product) => {
          state.productsById[product._id] = product;
          if (!state.allProductIds.includes(product._id)) {
            state.allProductIds.push(product._id);
          }
        });

        state.datasetMeta = {
          totalProducts: total,
          loadedProducts: products.length,
          isComplete,
          lastFullFetchAt: Date.now(),
          resumeCursor: resumeCursor || null,
        };

        state.cacheValidUntil = Date.now() + CACHE_TTL;
        state.lastUpdatedAt = Date.now();
        state.backgroundLoading = {
          isActive: false,
          progress: 100,
          currentPage: 0,
          totalPages: 0,
        };

        console.log(
          `[ProductCache] Loaded ${products.length}/${total} products. Complete: ${isComplete}`,
        );
      })
      .addCase(fetchAllProductsForSearch.rejected, (state, action) => {
        state.backgroundLoading.isActive = false;
        console.error(
          "[ProductCache] Failed to fetch products:",
          action.payload,
        );
      })
      .addCase(searchProducts.pending, (state) => {
        state.search.isSearching = true;
      })
      .addCase(searchProducts.fulfilled, (state, action) => {
        state.search.isSearching = false;
        state.search.searchMode = action.payload.mode;
        state.search.lastSearchAt = Date.now();

        if (action.payload.mode === "local") {
          state.search.localResults = action.payload.products.map((p) => p._id);
        } else {
          state.search.remoteResults = action.payload.products.map(
            (p) => p._id,
          );
          // Also cache the remote results
          action.payload.products.forEach((product) => {
            state.productsById[product._id] = product;
          });
        }
      })
      .addCase(searchProducts.rejected, (state, action) => {
        state.search.isSearching = false;
        console.error("[ProductCache] Search failed:", action.payload);
      });
  },
});

export const {
  updateProduct,
  removeProduct,
  addProduct,
  invalidateProductCache,
  setBackgroundLoading,
  setSearchQuery,
  clearSearch,
  resetProductCache,
} = productCacheSlice.actions;

// Selectors
export const selectProductsById = (state) => state.productCache.productsById;
export const selectAllProductIds = (state) => state.productCache.allProductIds;
export const selectDatasetMeta = (state) => state.productCache.datasetMeta;
export const selectIsDatasetComplete = (state) =>
  state.productCache.datasetMeta.isComplete;
export const selectBackgroundLoading = (state) =>
  state.productCache.backgroundLoading;
export const selectSearchState = (state) => state.productCache.search;

// Memoized selector for getting products array from normalized data
export const selectAllProductsArray = createSelector(
  [selectProductsById, selectAllProductIds],
  (productsById, allProductIds) =>
    allProductIds.map((id) => productsById[id]).filter(Boolean),
);

// Selector to check if local search is available
export const selectCanSearchLocally = createSelector(
  [selectDatasetMeta],
  (datasetMeta) => datasetMeta.isComplete && datasetMeta.loadedProducts > 0,
);

/**
 * Factory selector for local search with filters and pagination
 * Use this when local search is available to avoid backend calls
 *
 * @param {string} searchQuery - Search query string
 * @param {Object} filters - Filter object { category: [], warehouse: [], priceRange: [] }
 * @param {number} page - Current page (1-indexed)
 * @param {number} limit - Items per page
 */
export const makeSelectLocalSearchResults = () =>
  createSelector(
    [
      selectProductsById,
      selectAllProductIds,
      selectCanSearchLocally,
      (_, searchQuery) => searchQuery,
      (_, __, filters) => filters,
      (_, __, ___, page) => page,
      (_, __, ___, ____, limit) => limit,
    ],
    (
      productsById,
      allProductIds,
      canSearchLocally,
      searchQuery,
      filters = {},
      page = 1,
      limit = 10,
    ) => {
      if (!canSearchLocally) {
        return {
          products: [],
          total: 0,
          currentPage: page,
          totalPages: 0,
          hasMore: false,
          isLocalSearch: false,
        };
      }

      let filteredProducts = allProductIds
        .map((id) => productsById[id])
        .filter(Boolean);

      // Apply search filter
      if (searchQuery && searchQuery.trim()) {
        const queryLower = searchQuery.toLowerCase();
        filteredProducts = filteredProducts.filter((product) => {
          const searchFields = [
            product.name,
            product.sku,
            product.category,
            product.description,
            product.warehouse,
            product.brand,
          ].filter(Boolean);
          return searchFields.some((field) =>
            field.toLowerCase().includes(queryLower),
          );
        });
      }

      // Apply category filter
      if (filters.category?.length > 0) {
        filteredProducts = filteredProducts.filter((p) =>
          filters.category.includes(p.category),
        );
      }

      // Apply warehouse filter
      if (filters.warehouse?.length > 0) {
        filteredProducts = filteredProducts.filter((p) =>
          filters.warehouse.includes(p.warehouse),
        );
      }

      // Apply price range filter
      if (filters.priceRange?.length > 0) {
        filteredProducts = filteredProducts.filter((p) => {
          const price = parseFloat(p.price) || 0;
          return filters.priceRange.some((range) => {
            const [min, max] = range.split("-").map(Number);
            return price >= min && (max ? price <= max : true);
          });
        });
      }

      const total = filteredProducts.length;
      const totalPages = Math.ceil(total / limit);
      const startIndex = (page - 1) * limit;
      const paginatedProducts = filteredProducts.slice(
        startIndex,
        startIndex + limit,
      );

      return {
        products: paginatedProducts,
        total,
        currentPage: page,
        totalPages,
        hasMore: startIndex + limit < total,
        isLocalSearch: true,
      };
    },
  );

export default productCacheSlice.reducer;
