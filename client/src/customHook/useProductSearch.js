/**
 * useProductSearch Hook
 *
 * Provides state-first search functionality for products.
 *
 * Search Strategy:
 * 1. If dataset is complete (all products loaded) → Search entirely in Redux/memory
 * 2. If dataset is incomplete → Fall back to backend search
 * 3. Cache results to prevent duplicate searches
 *
 * This hook eliminates unnecessary backend calls when data exists locally.
 */

import { useCallback, useMemo, useEffect, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  fetchAllProductsForSearch,
  searchProducts,
  selectProductsById,
  selectAllProductIds,
  selectDatasetMeta,
  selectCanSearchLocally,
  selectBackgroundLoading,
  selectSearchState,
  setSearchQuery,
  clearSearch,
} from "../redux/features/product/productCacheSlice";
import { selectIsBootstrapped } from "../redux/features/dataCache/dataCacheSlice";

/**
 * Debounce function
 */
const debounce = (func, wait) => {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
};

/**
 * Hook for product search with state-first approach
 *
 * @param {Object} options - Search options
 * @param {string} options.initialQuery - Initial search query
 * @param {Object} options.filters - Filter options (category, warehouse, priceRange)
 * @param {number} options.page - Current page number
 * @param {number} options.limit - Items per page
 * @param {number} options.debounceMs - Debounce delay in ms (default: 300)
 */
export const useProductSearch = ({
  initialQuery = "",
  filters = {},
  page = 1,
  limit = 10,
  debounceMs = 300,
} = {}) => {
  const dispatch = useDispatch();
  const isBootstrapped = useSelector(selectIsBootstrapped);
  const productsById = useSelector(selectProductsById);
  const allProductIds = useSelector(selectAllProductIds);
  const datasetMeta = useSelector(selectDatasetMeta);
  const canSearchLocally = useSelector(selectCanSearchLocally);
  const backgroundLoading = useSelector(selectBackgroundLoading);
  const searchState = useSelector(selectSearchState);

  const lastSearchRef = useRef({ query: "", filters: {}, page: 1 });
  const searchInProgressRef = useRef(false);

  // Trigger background loading of all products when bootstrapped
  useEffect(() => {
    if (
      isBootstrapped &&
      !datasetMeta.isComplete &&
      !backgroundLoading.isActive
    ) {
      console.log(
        "[useProductSearch] Initiating background product fetch for local search capability"
      );
      dispatch(fetchAllProductsForSearch());
    }
  }, [
    isBootstrapped,
    datasetMeta.isComplete,
    backgroundLoading.isActive,
    dispatch,
  ]);

  // Perform search (local or remote based on dataset completeness)
  const performSearch = useCallback(
    async (query, searchFilters = filters, searchPage = page) => {
      // Prevent duplicate searches
      const searchKey = JSON.stringify({
        query,
        filters: searchFilters,
        page: searchPage,
      });
      const lastKey = JSON.stringify(lastSearchRef.current);

      if (searchKey === lastKey && searchInProgressRef.current) {
        console.log("[useProductSearch] Skipping duplicate search");
        return;
      }

      lastSearchRef.current = {
        query,
        filters: searchFilters,
        page: searchPage,
      };
      searchInProgressRef.current = true;

      try {
        await dispatch(
          searchProducts({
            query,
            filters: searchFilters,
            page: searchPage,
            limit,
          })
        ).unwrap();
      } finally {
        searchInProgressRef.current = false;
      }
    },
    [dispatch, filters, page, limit]
  );

  // Debounced search
  const debouncedSearch = useMemo(
    () =>
      debounce((query, searchFilters, searchPage) => {
        performSearch(query, searchFilters, searchPage);
      }, debounceMs),
    [performSearch, debounceMs]
  );

  // Handle search input change
  const handleSearch = useCallback(
    (query) => {
      dispatch(setSearchQuery(query));
      if (query.trim()) {
        debouncedSearch(query, filters, 1); // Reset to page 1 on new search
      } else {
        dispatch(clearSearch());
      }
    },
    [dispatch, debouncedSearch, filters]
  );

  // Local search implementation (for when dataset is complete)
  const searchLocally = useCallback(
    (query) => {
      if (!canSearchLocally || !query.trim()) {
        return [];
      }

      const queryLower = query.toLowerCase();
      const matchingProducts = allProductIds
        .map((id) => productsById[id])
        .filter((product) => {
          if (!product) return false;

          // Search in multiple fields
          const searchFields = [
            product.name,
            product.sku,
            product.category,
            product.description,
            product.warehouse,
            product.brand,
          ].filter(Boolean);

          return searchFields.some((field) =>
            field.toLowerCase().includes(queryLower)
          );
        });

      // Apply filters
      let filteredProducts = matchingProducts;

      if (filters.category?.length > 0) {
        filteredProducts = filteredProducts.filter((p) =>
          filters.category.includes(p.category)
        );
      }

      if (filters.warehouse?.length > 0) {
        filteredProducts = filteredProducts.filter((p) =>
          filters.warehouse.includes(p.warehouse)
        );
      }

      if (filters.priceRange?.length > 0) {
        // Assuming priceRange is an array of range strings like ["0-100", "100-500"]
        filteredProducts = filteredProducts.filter((p) => {
          const price = parseFloat(p.price) || 0;
          return filters.priceRange.some((range) => {
            const [min, max] = range.split("-").map(Number);
            return price >= min && (max ? price <= max : true);
          });
        });
      }

      return filteredProducts;
    },
    [canSearchLocally, allProductIds, productsById, filters]
  );

  // Get search results with pagination
  const getSearchResults = useCallback(
    (query, currentPage = 1) => {
      if (!query.trim()) {
        return {
          products: [],
          total: 0,
          currentPage: 1,
          totalPages: 0,
          hasMore: false,
          mode: "none",
        };
      }

      if (canSearchLocally) {
        const allResults = searchLocally(query);
        const startIndex = (currentPage - 1) * limit;
        const paginatedProducts = allResults.slice(
          startIndex,
          startIndex + limit
        );

        return {
          products: paginatedProducts,
          total: allResults.length,
          currentPage,
          totalPages: Math.ceil(allResults.length / limit),
          hasMore: startIndex + limit < allResults.length,
          mode: "local",
        };
      }

      // For remote search, results come from searchState
      const resultIds =
        searchState.localResults.length > 0
          ? searchState.localResults
          : searchState.remoteResults;

      const products = resultIds.map((id) => productsById[id]).filter(Boolean);

      return {
        products,
        total: products.length,
        currentPage,
        totalPages: 1,
        hasMore: false,
        mode: searchState.searchMode,
      };
    },
    [canSearchLocally, searchLocally, limit, searchState, productsById]
  );

  // Force remote search (bypass local)
  const forceRemoteSearch = useCallback(
    async (query, searchFilters = filters, searchPage = page) => {
      lastSearchRef.current = {
        query,
        filters: searchFilters,
        page: searchPage,
      };
      searchInProgressRef.current = true;

      try {
        // Temporarily mark dataset as incomplete to force remote
        await dispatch(
          searchProducts({
            query,
            filters: searchFilters,
            page: searchPage,
            limit,
          })
        ).unwrap();
      } finally {
        searchInProgressRef.current = false;
      }
    },
    [dispatch, filters, page, limit]
  );

  return {
    // State
    searchQuery: searchState.query,
    isSearching: searchState.isSearching,
    searchMode: canSearchLocally ? "local" : "remote",

    // Dataset info
    datasetMeta,
    canSearchLocally,
    isLoadingDataset: backgroundLoading.isActive,
    datasetProgress: backgroundLoading.progress,

    // Methods
    handleSearch,
    performSearch,
    searchLocally,
    getSearchResults,
    forceRemoteSearch,
    clearSearch: () => dispatch(clearSearch()),
  };
};

export default useProductSearch;
