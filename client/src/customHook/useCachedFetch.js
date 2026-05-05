/**
 * useCachedFetch Hook
 *
 * Smart data fetching hook that checks cache before fetching.
 * Use this for paginated/filtered data that shouldn't be fetched
 * on every component mount.
 *
 * Features:
 * - Checks Redux cache before fetching (survives component remounts)
 * - Tracks page-specific cache for pagination
 * - Respects TTL and staleness
 * - Integrates with realtime invalidation
 * - Prevents duplicate fetches across navigation
 * - STATE-FIRST SEARCH: When search query exists and full dataset is loaded,
 *   performs local filtering instead of backend calls
 *
 * ARCHITECTURE NOTE:
 * This hook MUST NOT use useRef for cache tracking because refs reset
 * on component remount (navigation). All cache state lives in Redux
 * which persists across the session.
 */

import { useEffect, useCallback, useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  PAGINATED_DATA,
  setLoading,
  setFetched,
  setPageFetched,
  selectCacheEntry,
  selectIsCached,
  selectIsPageCached,
  selectIsBootstrapped,
  markFetchInProgress,
  clearFetchInProgress,
  selectIsFetchInProgress,
} from "../redux/features/dataCache/dataCacheSlice";
import {
  selectCacheInvalidation,
  clearCacheInvalidation,
} from "../redux/features/realtime/realtimeSlice";
import { selectCanSearchLocally } from "../redux/features/product/productCacheSlice";

/**
 * Generate a cache key from pagination/filter params
 */
const generatePageKey = (params) => {
  const sortedParams = Object.keys(params)
    .sort()
    .reduce((acc, key) => {
      const value = params[key];
      if (value !== undefined && value !== null && value !== "") {
        acc[key] = Array.isArray(value) ? value.sort().join(",") : value;
      }
      return acc;
    }, {});
  return JSON.stringify(sortedParams);
};

/**
 * Hook for fetching paginated/filtered data with caching
 *
 * CRITICAL: Cache checks happen in Redux, not in component refs.
 * This ensures cache survives across navigation (component remounts).
 *
 * @param {string} dataKey - Key from PAGINATED_DATA
 * @param {Function} fetchAction - Redux async thunk to dispatch
 * @param {Object} params - Pagination/filter parameters
 * @param {Object} options - Additional options
 * @param {boolean} options.enableLocalSearch - Enable state-first search (default: true for PRODUCTS)
 */
export const useCachedPaginatedFetch = (
  dataKey,
  fetchAction,
  params = {},
  options = {},
) => {
  const dispatch = useDispatch();
  const isBootstrapped = useSelector(selectIsBootstrapped);
  const cacheEntry = useSelector(selectCacheEntry(dataKey));

  // Generate cache key for this specific page/filter combination
  const pageKey = useMemo(() => generatePageKey(params), [params]);
  const isPageCached = useSelector(selectIsPageCached(dataKey, pageKey));

  // Realtime invalidation
  const cacheInvalidation = useSelector(selectCacheInvalidation);
  const realtimeCacheKey = options.realtimeCacheKey || dataKey;
  const isInvalidated = cacheInvalidation[realtimeCacheKey] || false;

  // Check if a fetch is already in progress for this dataKey+pageKey (stored in Redux)
  const isFetchInProgress = useSelector(
    selectIsFetchInProgress(dataKey, pageKey),
  );

  // State-first search capability check
  // Only applicable for PRODUCTS dataKey when search param exists
  const canSearchLocally = useSelector(selectCanSearchLocally);
  const isProductsDataKey = dataKey === PAGINATED_DATA.PRODUCTS;
  const hasSearchQuery = params.search && params.search.trim().length > 0;

  // Enable local search for products when:
  // 1. It's the products dataKey
  // 2. We have a search query
  // 3. The full dataset is loaded
  // 4. enableLocalSearch option is not explicitly false
  const enableLocalSearch = options.enableLocalSearch !== false;
  const shouldUseLocalSearch =
    isProductsDataKey &&
    hasSearchQuery &&
    canSearchLocally &&
    enableLocalSearch;

  const { dependencies = [], enabled = true } = options;

  // Determine if we should fetch - ALL CHECKS USE REDUX STATE
  const shouldFetch = useMemo(() => {
    if (!enabled) return false;

    // Don't fetch if not bootstrapped yet (wait for core data)
    if (!isBootstrapped) return false;

    // STATE-FIRST SEARCH: If we can search locally, skip backend fetch
    // This is the KEY optimization for search performance
    if (shouldUseLocalSearch) {
      console.log(
        `[CachedFetch] Using local search for ${dataKey}, skipping backend fetch`,
      );
      return false;
    }

    // Don't fetch if already loading (checked in Redux, not ref)
    if (cacheEntry.isLoading) return false;

    // Don't fetch if a fetch is already in progress for this exact page
    if (isFetchInProgress) return false;

    // Don't fetch if this page/filter combination is already cached AND not invalidated
    // This is the KEY check that prevents navigation refetches
    if (isPageCached && !isInvalidated) return false;

    // Fetch if invalidated by realtime
    if (isInvalidated) return true;

    // Fetch if we haven't fetched this exact page/filter combo yet
    if (!isPageCached) return true;

    return false;
  }, [
    isBootstrapped,
    shouldUseLocalSearch,
    cacheEntry.isLoading,
    isFetchInProgress,
    isInvalidated,
    isPageCached,
    dataKey,
    enabled,
  ]);

  // Fetch function
  const executeFetch = useCallback(async () => {
    // Double-check we're not already fetching (race condition prevention)
    // This is a ref check for within the same render cycle only
    dispatch(markFetchInProgress({ dataKey, pageKey }));
    dispatch(setLoading({ dataKey, isLoading: true }));

    console.log(`[CachedFetch] Fetching ${dataKey} with params:`, params);

    try {
      await dispatch(fetchAction(params)).unwrap();
      dispatch(setPageFetched({ dataKey, pageKey }));

      // Clear realtime invalidation if present
      if (isInvalidated) {
        dispatch(clearCacheInvalidation(realtimeCacheKey));
      }
    } catch (error) {
      console.error(`[CachedFetch] Failed to fetch ${dataKey}:`, error);
    } finally {
      dispatch(clearFetchInProgress({ dataKey, pageKey }));
      dispatch(setLoading({ dataKey, isLoading: false }));
    }
  }, [
    dispatch,
    dataKey,
    pageKey,
    params,
    fetchAction,
    isInvalidated,
    realtimeCacheKey,
  ]);

  // Effect to trigger fetch when needed
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (shouldFetch) {
      executeFetch();
    }
  }, [shouldFetch, executeFetch, ...dependencies]);

  // Force refresh function - invalidates cache then fetches
  const refetch = useCallback(() => {
    // Clear the page cache to force refetch
    dispatch(clearFetchInProgress({ dataKey, pageKey }));
    executeFetch();
  }, [dispatch, dataKey, pageKey, executeFetch]);

  return {
    isLoading: cacheEntry.isLoading,
    isCached: isPageCached,
    lastFetched: cacheEntry.lastFetched,
    refetch,
    error: cacheEntry.error,
    // State-first search info
    isUsingLocalSearch: shouldUseLocalSearch,
    canSearchLocally,
  };
};

/**
 * Hook for fetching non-paginated data with caching
 *
 * CRITICAL: Like useCachedPaginatedFetch, cache checks happen in Redux,
 * not in component refs, to survive navigation.
 */
export const useCachedFetch = (dataKey, fetchAction, options = {}) => {
  const dispatch = useDispatch();
  const isBootstrapped = useSelector(selectIsBootstrapped);
  const cacheEntry = useSelector(selectCacheEntry(dataKey));
  const isCached = useSelector(selectIsCached(dataKey));

  // Realtime invalidation
  const cacheInvalidation = useSelector(selectCacheInvalidation);
  const realtimeCacheKey = options.realtimeCacheKey || dataKey;
  const isInvalidated = cacheInvalidation[realtimeCacheKey] || false;

  // Check if fetch is in progress (stored in Redux)
  const isFetchInProgress = useSelector(
    selectIsFetchInProgress(dataKey, "default"),
  );

  const { fetchParams = null, enabled = true } = options;

  // Determine if we should fetch - ALL CHECKS USE REDUX STATE
  const shouldFetch = useMemo(() => {
    if (!enabled) return false;
    if (!isBootstrapped) return false;
    if (cacheEntry.isLoading) return false;
    if (isFetchInProgress) return false;
    if (isInvalidated) return true;
    if (!isCached) return true;
    return false;
  }, [
    isBootstrapped,
    cacheEntry.isLoading,
    isFetchInProgress,
    isInvalidated,
    isCached,
    enabled,
  ]);

  // Fetch function
  const executeFetch = useCallback(async () => {
    dispatch(markFetchInProgress({ dataKey, pageKey: "default" }));
    dispatch(setLoading({ dataKey, isLoading: true }));

    console.log(`[CachedFetch] Fetching ${dataKey}`);

    try {
      const action = fetchParams ? fetchAction(fetchParams) : fetchAction();
      await dispatch(action).unwrap();
      dispatch(setFetched({ dataKey }));

      if (isInvalidated) {
        dispatch(clearCacheInvalidation(realtimeCacheKey));
      }
    } catch (error) {
      console.error(`[CachedFetch] Failed to fetch ${dataKey}:`, error);
    } finally {
      dispatch(clearFetchInProgress({ dataKey, pageKey: "default" }));
      dispatch(setLoading({ dataKey, isLoading: false }));
    }
  }, [
    dispatch,
    dataKey,
    fetchAction,
    fetchParams,
    isInvalidated,
    realtimeCacheKey,
  ]);

  // Effect to trigger fetch when needed
  useEffect(() => {
    if (shouldFetch) {
      executeFetch();
    }
  }, [shouldFetch, executeFetch]);

  // Force refresh function
  const refresh = useCallback(() => {
    dispatch(clearFetchInProgress({ dataKey, pageKey: "default" }));
    executeFetch();
  }, [dispatch, dataKey, executeFetch]);

  return {
    isLoading: cacheEntry.isLoading,
    isCached,
    lastFetched: cacheEntry.lastFetched,
    refresh,
    error: cacheEntry.error,
  };
};

export { PAGINATED_DATA };
export default useCachedPaginatedFetch;
