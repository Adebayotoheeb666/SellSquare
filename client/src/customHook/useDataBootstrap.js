/**
 * useDataBootstrap Hook
 *
 * Handles session-scoped data loading when user logs in.
 * This hook should be used in the Layout component to ensure
 * core data is loaded once and cached for the session.
 *
 * Benefits:
 * - Single point of data initialization
 * - Prevents duplicate fetches across page navigations
 * - Works with realtime updates for incremental changes
 * - Tracks loading and error states centrally
 * - Initiates bulk loading of all paginated data for state-driven pagination
 *
 * BULK LOADING STRATEGY:
 * - All paginated data is loaded in bulk (up to 1000 items per type)
 * - UI pagination operates entirely on client-side data
 * - Page navigation NEVER triggers backend calls
 * - Backend calls only happen for: bootstrap, mutations, realtime invalidation
 */

import { useEffect, useCallback, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  BOOTSTRAP_DATA,
  startSession,
  startBootstrap,
  completeBootstrap,
  startBackgroundBootstrap,
  markBackgroundTaskComplete,
  failBootstrap,
  setLoading,
  setFetched,
  setFetchError,
  invalidateCache,
  selectCacheEntry,
  selectIsBootstrapped,
  selectIsBootstrapping,
  selectShouldFetch,
  selectSessionId,
} from "../redux/features/dataCache/dataCacheSlice";
import { selectIsLoggedIn } from "../redux/features/auth/authSlice";
import { selectBusiness } from "../redux/features/auth/authSlice";
import {
  getDashboardStats,
  getFilterOptions,
  forceClearProductLoading,
} from "../redux/features/product/productSlice";
import {
  fetchAllProductsForSearch,
  selectDatasetMeta,
  selectBackgroundLoading as selectProductBackgroundLoading,
  setBackgroundLoading,
  resetProductCache,
} from "../redux/features/product/productCacheSlice";
import {
  getCart,
  forceClearCartLoading,
  RESET_SESSION as resetCart,
} from "../redux/features/cart/cartSlice";
import { getBusiness } from "../services/authService";
import { SET_BUSINESS, SET_CONNECTED_STORES, SET_CURRENT_BUSINESS } from "../redux/features/auth/authSlice";
import {
  fetchBulkSales,
  fetchBulkExpenses,
  fetchBulkActivities,
  fetchBulkDiscounts,
  fetchBulkFulfilments,
  fetchBulkCustomers,
  fetchBulkProductGroups,
  fetchBulkOutOfStock,
  fetchBulkMarketplaceOrders,
  forceClearBulkLoading,
  RESET_SESSION as resetBulkDataCache,
  selectSalesMeta,
  selectExpensesMeta,
  selectActivitiesMeta,
  selectFulfilmentsMeta,
  selectCustomersMeta,
  selectProductGroupsMeta,
  selectDiscountsMeta,
  selectMarketplaceOrdersMeta,
} from "../redux/features/dataCache/bulkDataCacheSlice";
import { RESET_SESSION as resetFilters } from "../redux/features/product/filterSlice";
import {
  fetchAdminBusinesses,
  fetchAdminApplications,
  selectAdminBusinesses,
  selectAdminApplications,
  selectAdminLoadingBusinesses,
  selectAdminLoadingApplications,
} from "../redux/features/admin/adminSlice";
import { isSuperAdminEmail } from "../utils/superAdmin";

const CRITICAL_BOOTSTRAP_TIMEOUT_MS = 30 * 1000;
const BACKGROUND_BOOTSTRAP_TIMEOUT_MS = 2 * 60 * 1000;
const CRITICAL_RECOVERY_RETRY_COOLDOWN_MS = 30 * 1000;

export const hasCompletedBulkDataset = (meta) => {
  if (!meta) {
    return false;
  }

  return (
    Boolean(meta.lastFetchedAt) ||
    Boolean(meta.isComplete) ||
    Number(meta.loaded || 0) > 0
  );
};

export const hasCompletedProductDataset = (datasetMeta) => {
  if (!datasetMeta) {
    return false;
  }

  return (
    Boolean(datasetMeta.lastFullFetchAt) ||
    Boolean(datasetMeta.isComplete) ||
    Number(datasetMeta.loadedProducts || 0) > 0
  );
};

/**
 * Hook to bootstrap session data
 * Call this in the Layout component
 */
export const useDataBootstrap = ({ userEmail, isAdmin } = {}) => {
  const canFetchAdminData = Boolean(isAdmin) && isSuperAdminEmail(userEmail);

  const dispatch = useDispatch();
  const isLoggedIn = useSelector(selectIsLoggedIn);
  const business = useSelector(selectBusiness);
  const isBootstrapped = useSelector(selectIsBootstrapped);
  const isBootstrapping = useSelector(selectIsBootstrapping);
  const sessionId = useSelector(selectSessionId);
  const productDatasetMeta = useSelector(selectDatasetMeta);
  const productBackgroundLoading = useSelector(selectProductBackgroundLoading);
  const salesMeta = useSelector(selectSalesMeta);
  const expensesMeta = useSelector(selectExpensesMeta);
  const activitiesMeta = useSelector(selectActivitiesMeta);
  const fulfilmentsMeta = useSelector(selectFulfilmentsMeta);
  const customersMeta = useSelector(selectCustomersMeta);
  const productGroupsMeta = useSelector(selectProductGroupsMeta);
  const discountsMeta = useSelector(selectDiscountsMeta);
  const marketplaceOrdersMeta = useSelector(selectMarketplaceOrdersMeta);
  const outOfStockMeta = useSelector(
    (state) => state.bulkDataCache?.outOfStock?.products?.meta,
  );
  const dashboardStatsCache = useSelector(
    selectCacheEntry(BOOTSTRAP_DATA.DASHBOARD_STATS),
  );
  const businessInfoCache = useSelector(
    selectCacheEntry(BOOTSTRAP_DATA.BUSINESS_INFO),
  );
  const cartCache = useSelector(selectCacheEntry(BOOTSTRAP_DATA.CART));
  const filterOptionsCache = useSelector(
    selectCacheEntry(BOOTSTRAP_DATA.FILTER_OPTIONS),
  );
  const adminBusinessesCache = useSelector(
    selectCacheEntry(BOOTSTRAP_DATA.ADMIN_BUSINESSES),
  );
  const adminApplicationsCache = useSelector(
    selectCacheEntry(BOOTSTRAP_DATA.ADMIN_APPLICATIONS),
  );
  const adminBusinesses = useSelector(selectAdminBusinesses);
  const adminApplications = useSelector(selectAdminApplications);
  const isAdminBusinessesLoading = useSelector(selectAdminLoadingBusinesses);
  const isAdminApplicationsLoading = useSelector(selectAdminLoadingApplications);

  const bootstrapAttempted = useRef(false);
  const criticalRecoveryAttemptedAt = useRef({});
  const adminRecoveryAttempted = useRef({
    sessionId: null,
    businesses: false,
    applications: false,
  });
  const previousLoginState = useRef(isLoggedIn);
  const previousScope = useRef(null);
  const latestSessionId = useRef(sessionId);
  const latestLoggedInState = useRef(isLoggedIn);

  const withTimeout = useCallback((operation, timeoutMs, label) => {
    return new Promise((resolve, reject) => {
      const timer = window.setTimeout(() => {
        reject(new Error(`${label} timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      Promise.resolve(typeof operation === "function" ? operation() : operation)
        .then(resolve)
        .catch(reject)
        .finally(() => {
          window.clearTimeout(timer);
        });
    });
  }, []);

  const yieldToBrowser = useCallback((timeout = 0) => {
    return new Promise((resolve) => {
      if (
        typeof window !== "undefined" &&
        typeof window.requestIdleCallback === "function"
      ) {
        window.requestIdleCallback(() => resolve(), { timeout: 500 });
        return;
      }

      window.setTimeout(resolve, timeout);
    });
  }, []);

  const recoverCriticalLoading = useCallback(
    (dataKey, errorMessage) => {
      dispatch(setLoading({ dataKey, isLoading: false }));
      dispatch(setFetchError({ dataKey, error: errorMessage }));

      if (
        dataKey === BOOTSTRAP_DATA.DASHBOARD_STATS ||
        dataKey === BOOTSTRAP_DATA.FILTER_OPTIONS
      ) {
        dispatch(forceClearProductLoading({ error: errorMessage }));
      }

      if (dataKey === BOOTSTRAP_DATA.CART) {
        dispatch(forceClearCartLoading({ error: errorMessage }));
      }
    },
    [dispatch],
  );

  const recoverBackgroundLoading = useCallback(
    (taskKey, errorMessage) => {
      const currentYear = new Date().getFullYear();

      if (taskKey === "products") {
        dispatch(
          setBackgroundLoading({
            isActive: false,
            progress: 0,
            currentPage: 0,
            totalPages: 0,
          }),
        );
        return;
      }

      dispatch(
        forceClearBulkLoading({
          dataType: taskKey,
          year: currentYear,
          error: errorMessage,
        }),
      );
    },
    [dispatch],
  );

  const runCriticalTask = useCallback(
    async ({ dataKey, label, task, onSuccess }) => {
      try {
        const result = await withTimeout(task, CRITICAL_BOOTSTRAP_TIMEOUT_MS, label);
        if (typeof onSuccess === "function") {
          try {
            onSuccess(result);
          } catch (onSuccessError) {
            console.error(
              `[DataBootstrap] ${label} onSuccess handler failed:`,
              onSuccessError,
            );
          }
        }
        dispatch(setFetched({ dataKey }));
        return { ok: true };
      } catch (error) {
        const message = error?.message || String(error);
        recoverCriticalLoading(dataKey, message);
        console.error(`[DataBootstrap] ${label} failed:`, error);
        return { ok: false, error: message };
      }
    },
    [dispatch, recoverCriticalLoading, withTimeout],
  );

  const shouldAttemptCriticalRecovery = useCallback((dataKey) => {
    const now = Date.now();
    const lastAttempt = criticalRecoveryAttemptedAt.current[dataKey] || 0;

    if (now - lastAttempt < CRITICAL_RECOVERY_RETRY_COOLDOWN_MS) {
      return false;
    }

    criticalRecoveryAttemptedAt.current[dataKey] = now;
    return true;
  }, []);

  const scheduleBackgroundBootstrap = useCallback(
    (backgroundTasks, backgroundSessionId) => {
      void (async () => {
        await yieldToBrowser(250);

        if (
          !latestLoggedInState.current ||
          latestSessionId.current !== backgroundSessionId
        ) {
          return;
        }

        const backgroundStartedAt = performance.now();
        const workerCount = Math.min(2, backgroundTasks.length);
        let nextTaskIndex = 0;
        const results = [];

        dispatch(startBackgroundBootstrap({ totalTasks: backgroundTasks.length }));

        const runTask = async (task) => {
          const startedAt = performance.now();

          try {
            await withTimeout(
              task.action,
              BACKGROUND_BOOTSTRAP_TIMEOUT_MS,
              `${task.key} background bootstrap`,
            );

            if (
              latestLoggedInState.current &&
              latestSessionId.current === backgroundSessionId
            ) {
              dispatch(markBackgroundTaskComplete({ hasError: false }));
            }

            console.info("[DataBootstrap] background_task_complete", {
              task: task.key,
              durationMs: Number((performance.now() - startedAt).toFixed(2)),
            });
            return { ok: true };
          } catch (error) {
            const message = error?.message || String(error);

            if (
              latestLoggedInState.current &&
              latestSessionId.current === backgroundSessionId
            ) {
              recoverBackgroundLoading(task.key, message);
              dispatch(markBackgroundTaskComplete({ hasError: true }));
            }

            console.error("[DataBootstrap] background_task_failed", {
              task: task.key,
              durationMs: Number((performance.now() - startedAt).toFixed(2)),
              message,
            });
            return { ok: false, error: message };
          }
        };

        const workers = Array.from({ length: workerCount }, async () => {
          while (nextTaskIndex < backgroundTasks.length) {
            const task = backgroundTasks[nextTaskIndex];
            nextTaskIndex += 1;

            if (
              !latestLoggedInState.current ||
              latestSessionId.current !== backgroundSessionId
            ) {
              return;
            }

            await yieldToBrowser();
            results.push(await runTask(task));
          }
        });

        await Promise.all(workers);

        if (
          !latestLoggedInState.current ||
          latestSessionId.current !== backgroundSessionId
        ) {
          return;
        }

        const failures = results.filter((entry) => entry && !entry.ok).length;
        console.info("[DataBootstrap] background_phase_complete", {
          durationMs: Number((performance.now() - backgroundStartedAt).toFixed(2)),
          totalTasks: backgroundTasks.length,
          failures,
        });
      })();
    },
    [
      dispatch,
      recoverBackgroundLoading,
      withTimeout,
      yieldToBrowser,
    ],
  );

  // Check if bootstrap is needed
  const shouldBootstrap = isLoggedIn && !isBootstrapped && !isBootstrapping;

  // Bootstrap function
  const bootstrap = useCallback(async () => {
    if (!isLoggedIn || isBootstrapping || bootstrapAttempted.current) {
      return;
    }

    bootstrapAttempted.current = true;
    const criticalStartedAt = performance.now();
    console.log("[DataBootstrap] Starting critical bootstrap phase...");

    dispatch(startBootstrap());

    try {
      // Fetch all bootstrap data in parallel
      const criticalTasks = [];

      dispatch(
        setLoading({
          dataKey: BOOTSTRAP_DATA.DASHBOARD_STATS,
          isLoading: true,
        }),
      );
      criticalTasks.push(
        runCriticalTask({
          dataKey: BOOTSTRAP_DATA.DASHBOARD_STATS,
          label: "dashboard stats bootstrap",
          task: () => dispatch(getDashboardStats()).unwrap(),
        }),
      );

      dispatch(
        setLoading({ dataKey: BOOTSTRAP_DATA.BUSINESS_INFO, isLoading: true }),
      );
      criticalTasks.push(
        runCriticalTask({
          dataKey: BOOTSTRAP_DATA.BUSINESS_INFO,
          label: "business info bootstrap",
          task: () => getBusiness(),
          onSuccess: (data) => {
            if (data) {
              dispatch(SET_BUSINESS(data));
              if (data.connectedStores) {
                dispatch(SET_CONNECTED_STORES(data.connectedStores));
              }
              if (data.currentBusiness) {
                dispatch(SET_CURRENT_BUSINESS(data.currentBusiness));
              } else if (data._id) {
                // getBusiness returns the current store's data directly at the top level
                dispatch(SET_CURRENT_BUSINESS({
                  _id: data._id,
                  businessName: data.businessName,
                  businessEmail: data.businessEmail,
                  photo: data.photo,
                  industry: data.industry,
                  country: data.country,
                }));
              }
            }
          },
        }),
      );

      if (userEmail) {
        dispatch(setLoading({ dataKey: BOOTSTRAP_DATA.CART, isLoading: true }));
        criticalTasks.push(
          runCriticalTask({
            dataKey: BOOTSTRAP_DATA.CART,
            label: "cart bootstrap",
            task: () => dispatch(getCart(userEmail)).unwrap(),
          }),
        );
      }

      dispatch(
        setLoading({ dataKey: BOOTSTRAP_DATA.FILTER_OPTIONS, isLoading: true }),
      );
      criticalTasks.push(
        runCriticalTask({
          dataKey: BOOTSTRAP_DATA.FILTER_OPTIONS,
          label: "filter options bootstrap",
          task: () => dispatch(getFilterOptions()).unwrap(),
        }),
      );

      if (canFetchAdminData) {
        dispatch(
          setLoading({
            dataKey: BOOTSTRAP_DATA.ADMIN_BUSINESSES,
            isLoading: true,
          }),
        );
        criticalTasks.push(
          runCriticalTask({
            dataKey: BOOTSTRAP_DATA.ADMIN_BUSINESSES,
            label: "admin businesses bootstrap",
            task: () => dispatch(fetchAdminBusinesses()).unwrap(),
          }),
        );

        dispatch(
          setLoading({
            dataKey: BOOTSTRAP_DATA.ADMIN_APPLICATIONS,
            isLoading: true,
          }),
        );
        criticalTasks.push(
          runCriticalTask({
            dataKey: BOOTSTRAP_DATA.ADMIN_APPLICATIONS,
            label: "admin applications bootstrap",
            task: () => dispatch(fetchAdminApplications()).unwrap(),
          }),
        );
      }

      const criticalResults = await Promise.all(criticalTasks);
      const criticalFailures = criticalResults.filter((entry) => !entry.ok).length;

      const criticalDurationMs = Number(
        (performance.now() - criticalStartedAt).toFixed(2),
      );

      console.info("[DataBootstrap] critical_phase_complete", {
        durationMs: criticalDurationMs,
        totalTasks: criticalTasks.length,
        failures: criticalFailures,
      });

      dispatch(completeBootstrap());

      const currentYear = new Date().getFullYear();
      const backgroundTasks = [
        {
          key: "products",
          action: () => dispatch(fetchAllProductsForSearch()).unwrap(),
        },
        {
          key: "sales",
          action: () => dispatch(fetchBulkSales({ year: currentYear })).unwrap(),
        },
        {
          key: "expenses",
          action: () => dispatch(fetchBulkExpenses({ year: currentYear })).unwrap(),
        },
        {
          key: "activities",
          action: () => dispatch(fetchBulkActivities()).unwrap(),
        },
        {
          key: "discounts",
          action: () => dispatch(fetchBulkDiscounts()).unwrap(),
        },
        {
          key: "fulfilments",
          action: () => dispatch(fetchBulkFulfilments()).unwrap(),
        },
        {
          key: "customers",
          action: () => dispatch(fetchBulkCustomers()).unwrap(),
        },
        {
          key: "productGroups",
          action: () => dispatch(fetchBulkProductGroups()).unwrap(),
        },
        {
          key: "outOfStock",
          action: () => dispatch(fetchBulkOutOfStock()).unwrap(),
        },
        {
          key: "marketplaceOrders",
          action: () => dispatch(fetchBulkMarketplaceOrders()).unwrap(),
        },
      ];

      scheduleBackgroundBootstrap(backgroundTasks, sessionId);
    } catch (error) {
      console.error("[DataBootstrap] Bootstrap failed:", error);
      dispatch(failBootstrap(error.message));
    }
  }, [
    dispatch,
    isLoggedIn,
    isBootstrapping,
    userEmail,
    canFetchAdminData,
    scheduleBackgroundBootstrap,
    runCriticalTask,
    sessionId,
  ]);

  useEffect(() => {
    latestSessionId.current = sessionId;
    latestLoggedInState.current = isLoggedIn;
  }, [isLoggedIn, sessionId]);

  // Start new session when user logs in
  useEffect(() => {
    const currentScope = `${business?._id || "no-business"}:${userEmail || "no-user"}`;

    if (
      isLoggedIn &&
      previousScope.current &&
      previousScope.current !== currentScope
    ) {
      console.info("[DataBootstrap] account_scope_changed", {
        previousScope: previousScope.current,
        currentScope,
      });
      bootstrapAttempted.current = false;
      criticalRecoveryAttemptedAt.current = {};
      adminRecoveryAttempted.current = {
        sessionId: null,
        businesses: false,
        applications: false,
      };
      // Reset ALL data caches so re-bootstrap fetches fresh data
      // for the new business instead of serving stale cached data
      dispatch(resetBulkDataCache());
      dispatch(resetProductCache());
      dispatch(resetCart());
      dispatch(resetFilters());
      dispatch(startSession(Date.now().toString()));
    }

    previousScope.current = currentScope;
  }, [isLoggedIn, business?._id, userEmail, dispatch]);

  useEffect(() => {
    if (isLoggedIn && !previousLoginState.current) {
      // User just logged in
      console.log("[DataBootstrap] User logged in, starting new session");
      dispatch(startSession(Date.now().toString()));
      bootstrapAttempted.current = false;
      criticalRecoveryAttemptedAt.current = {};
      adminRecoveryAttempted.current = {
        sessionId: null,
        businesses: false,
        applications: false,
      };
    } else if (!isLoggedIn && previousLoginState.current) {
      // User just logged out
      console.log("[DataBootstrap] User logged out, ending session");
      bootstrapAttempted.current = false;
      criticalRecoveryAttemptedAt.current = {};
      adminRecoveryAttempted.current = {
        sessionId: null,
        businesses: false,
        applications: false,
      };
    }
    previousLoginState.current = isLoggedIn;
  }, [isLoggedIn, dispatch]);

  // Run bootstrap when conditions are met
  useEffect(() => {
    if (shouldBootstrap) {
      bootstrap();
    }
  }, [shouldBootstrap, bootstrap]);

  // Self-healing hydration for persisted sessions that report bootstrapped but miss datasets
  useEffect(() => {
    if (!isLoggedIn || !isBootstrapped) {
      return;
    }

    if (adminRecoveryAttempted.current.sessionId !== sessionId) {
      adminRecoveryAttempted.current = {
        sessionId,
        businesses: false,
        applications: false,
      };
    }

    const currentYear = new Date().getFullYear();

    if (
      !dashboardStatsCache.isFetched &&
      !dashboardStatsCache.isLoading &&
      shouldAttemptCriticalRecovery(BOOTSTRAP_DATA.DASHBOARD_STATS)
    ) {
      dispatch(
        setLoading({
          dataKey: BOOTSTRAP_DATA.DASHBOARD_STATS,
          isLoading: true,
        }),
      );
      withTimeout(
        () => dispatch(getDashboardStats()).unwrap(),
        CRITICAL_BOOTSTRAP_TIMEOUT_MS,
        "dashboard stats recovery",
      )
        .then(() => {
          dispatch(setFetched({ dataKey: BOOTSTRAP_DATA.DASHBOARD_STATS }));
        })
        .catch((error) => {
          recoverCriticalLoading(
            BOOTSTRAP_DATA.DASHBOARD_STATS,
            error?.message || String(error),
          );
        });
    }

    if (
      !businessInfoCache.isFetched &&
      !businessInfoCache.isLoading &&
      shouldAttemptCriticalRecovery(BOOTSTRAP_DATA.BUSINESS_INFO)
    ) {
      dispatch(
        setLoading({
          dataKey: BOOTSTRAP_DATA.BUSINESS_INFO,
          isLoading: true,
        }),
      );
      withTimeout(
        () => getBusiness(),
        CRITICAL_BOOTSTRAP_TIMEOUT_MS,
        "business info recovery",
      )
        .then((data) => {
          if (data) {
            try {
              dispatch(SET_BUSINESS(data));
              if (data.connectedStores) {
                dispatch(SET_CONNECTED_STORES(data.connectedStores));
              }
              if (data.currentBusiness) {
                dispatch(SET_CURRENT_BUSINESS(data.currentBusiness));
              } else if (data._id) {
                dispatch(SET_CURRENT_BUSINESS({
                  _id: data._id,
                  businessName: data.businessName,
                  businessEmail: data.businessEmail,
                  photo: data.photo,
                  industry: data.industry,
                  country: data.country,
                }));
              }
            } catch (setBusinessError) {
              console.error(
                "[DataBootstrap] business info recovery state update failed:",
                setBusinessError,
              );
            }
          }
          dispatch(setFetched({ dataKey: BOOTSTRAP_DATA.BUSINESS_INFO }));
        })
        .catch((error) => {
          recoverCriticalLoading(
            BOOTSTRAP_DATA.BUSINESS_INFO,
            error?.message || String(error),
          );
        });
    }

    if (
      userEmail &&
      !cartCache.isFetched &&
      !cartCache.isLoading &&
      shouldAttemptCriticalRecovery(BOOTSTRAP_DATA.CART)
    ) {
      dispatch(setLoading({ dataKey: BOOTSTRAP_DATA.CART, isLoading: true }));
      withTimeout(
        () => dispatch(getCart(userEmail)).unwrap(),
        CRITICAL_BOOTSTRAP_TIMEOUT_MS,
        "cart recovery",
      )
        .then(() => {
          dispatch(setFetched({ dataKey: BOOTSTRAP_DATA.CART }));
        })
        .catch((error) => {
          recoverCriticalLoading(
            BOOTSTRAP_DATA.CART,
            error?.message || String(error),
          );
        });
    }

    if (
      !filterOptionsCache.isFetched &&
      !filterOptionsCache.isLoading &&
      shouldAttemptCriticalRecovery(BOOTSTRAP_DATA.FILTER_OPTIONS)
    ) {
      dispatch(
        setLoading({
          dataKey: BOOTSTRAP_DATA.FILTER_OPTIONS,
          isLoading: true,
        }),
      );
      withTimeout(
        () => dispatch(getFilterOptions()).unwrap(),
        CRITICAL_BOOTSTRAP_TIMEOUT_MS,
        "filter options recovery",
      )
        .then(() => {
          dispatch(setFetched({ dataKey: BOOTSTRAP_DATA.FILTER_OPTIONS }));
        })
        .catch((error) => {
          recoverCriticalLoading(
            BOOTSTRAP_DATA.FILTER_OPTIONS,
            error?.message || String(error),
          );
        });
    }

    const shouldLoadProducts =
      !productBackgroundLoading?.isActive &&
      !hasCompletedProductDataset(productDatasetMeta);
    if (shouldLoadProducts) {
      dispatch(fetchAllProductsForSearch());
    }

    if (!salesMeta?.isLoading && !hasCompletedBulkDataset(salesMeta)) {
      dispatch(fetchBulkSales({ year: currentYear }));
    }

    if (!expensesMeta?.isLoading && !hasCompletedBulkDataset(expensesMeta)) {
      dispatch(fetchBulkExpenses({ year: currentYear }));
    }

    if (!activitiesMeta?.isLoading && !hasCompletedBulkDataset(activitiesMeta)) {
      dispatch(fetchBulkActivities());
    }

    if (!fulfilmentsMeta?.isLoading && !hasCompletedBulkDataset(fulfilmentsMeta)) {
      dispatch(fetchBulkFulfilments());
    }

    if (!customersMeta?.isLoading && !hasCompletedBulkDataset(customersMeta)) {
      dispatch(fetchBulkCustomers());
    }

    if (!productGroupsMeta?.isLoading && !hasCompletedBulkDataset(productGroupsMeta)) {
      dispatch(fetchBulkProductGroups());
    }

    if (!discountsMeta?.isLoading && !hasCompletedBulkDataset(discountsMeta)) {
      dispatch(fetchBulkDiscounts());
    }

    if (!outOfStockMeta?.isLoading && !hasCompletedBulkDataset(outOfStockMeta)) {
      dispatch(fetchBulkOutOfStock());
    }

    if (
      !marketplaceOrdersMeta?.isLoading &&
      !hasCompletedBulkDataset(marketplaceOrdersMeta)
    ) {
      dispatch(fetchBulkMarketplaceOrders());
    }

    if (canFetchAdminData) {
      if (
        !adminRecoveryAttempted.current.businesses &&
        !isAdminBusinessesLoading &&
        (!adminBusinesses || adminBusinesses.length === 0)
      ) {
        adminRecoveryAttempted.current.businesses = true;
        dispatch(fetchAdminBusinesses());
      }

      if (
        !adminRecoveryAttempted.current.applications &&
        !isAdminApplicationsLoading &&
        (!adminApplications || adminApplications.length === 0)
      ) {
        adminRecoveryAttempted.current.applications = true;
        dispatch(fetchAdminApplications());
      }
    }
  }, [
    dispatch,
    isLoggedIn,
    isBootstrapped,
    userEmail,
    canFetchAdminData,
    dashboardStatsCache.isFetched,
    dashboardStatsCache.isLoading,
    businessInfoCache.isFetched,
    businessInfoCache.isLoading,
    cartCache.isFetched,
    cartCache.isLoading,
    filterOptionsCache.isFetched,
    filterOptionsCache.isLoading,
    adminBusinessesCache.isFetched,
    adminApplicationsCache.isFetched,
    productDatasetMeta?.loadedProducts,
    productBackgroundLoading?.isActive,
    salesMeta?.isLoading,
    salesMeta?.loaded,
    expensesMeta?.isLoading,
    expensesMeta?.loaded,
    activitiesMeta?.isLoading,
    activitiesMeta?.loaded,
    fulfilmentsMeta?.isLoading,
    fulfilmentsMeta?.loaded,
    discountsMeta?.isLoading,
    discountsMeta?.loaded,
    customersMeta?.isLoading,
    customersMeta?.loaded,
    productGroupsMeta?.isLoading,
    productGroupsMeta?.loaded,
    outOfStockMeta?.isLoading,
    outOfStockMeta?.loaded,
    marketplaceOrdersMeta?.isLoading,
    marketplaceOrdersMeta?.loaded,
    adminBusinesses,
    adminApplications,
    isAdminBusinessesLoading,
    isAdminApplicationsLoading,
    recoverCriticalLoading,
    sessionId,
    shouldAttemptCriticalRecovery,
    withTimeout,
  ]);

  return {
    isBootstrapped,
    isBootstrapping,
    sessionId,
    rebootstrap: () => {
      bootstrapAttempted.current = false;
      dispatch(startSession(Date.now().toString()));
    },
  };
};

/**
 * Hook to check if specific data should be fetched
 * Use this in components that need paginated/filtered data
 */
export const useShouldFetch = (dataKey) => {
  const shouldFetch = useSelector(selectShouldFetch(dataKey));
  const dispatch = useDispatch();

  const markFetched = useCallback(() => {
    dispatch(setFetched({ dataKey }));
  }, [dispatch, dataKey]);

  const markLoading = useCallback(
    (isLoading) => {
      dispatch(setLoading({ dataKey, isLoading }));
    },
    [dispatch, dataKey],
  );

  const invalidate = useCallback(() => {
    dispatch(invalidateCache(dataKey));
  }, [dispatch, dataKey]);

  return {
    shouldFetch,
    markFetched,
    markLoading,
    invalidate,
  };
};

/**
 * Hook that integrates with realtime events to invalidate cache
 */
export const useRealtimeCacheInvalidation = () => {
  const dispatch = useDispatch();
  const { isConnected } =
    require("./useRealtime").useRealtimeConnection?.() || {};

  const invalidateByEventType = useCallback(
    (eventType) => {
      // Map event types to cache keys
      const eventToCacheMap = {
        "cart.updated": BOOTSTRAP_DATA.CART,
        "cart.item_added": BOOTSTRAP_DATA.CART,
        "cart.item_removed": BOOTSTRAP_DATA.CART,
        "cart.cleared": BOOTSTRAP_DATA.CART,
        "sale.completed": BOOTSTRAP_DATA.INCOMPLETE_PAYMENTS,
        "checkout.completed": BOOTSTRAP_DATA.INCOMPLETE_PAYMENTS,
      };

      const cacheKeys = eventToCacheMap[eventType];
      if (cacheKeys) {
        const keys = Array.isArray(cacheKeys) ? cacheKeys : [cacheKeys];
        keys.forEach((key) => dispatch(invalidateCache(key)));
      }
    },
    [dispatch],
  );

  return {
    isConnected,
    invalidateByEventType,
  };
};

export default useDataBootstrap;
