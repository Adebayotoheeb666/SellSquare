import { useMemo, useCallback } from "react";
import { useSelector, useDispatch } from "react-redux";
import { getActivities } from "../redux/features/activities/activitySlice";
import { getExpenses } from "../redux/features/expense/expenseSlice";
import {
  getCheckouts,
  fetchIncompletePayments,
  getCustomers,
} from "../redux/features/cart/cartSlice";
import {
  fetchAllProductsForSearch,
  selectAllProductsArray,
  selectBackgroundLoading,
} from "../redux/features/product/productCacheSlice";

// Bulk Data Cache selectors and actions
import {
  selectSalesArray,
  selectExpensesArray,
  selectActivitiesArray,
  selectFulfilmentsArray,
  selectCustomersArray,
  selectProductGroupsArray,
  selectOutOfStockProductsArray,
  selectOutOfStockGroupsArray,
  selectSalesMeta,
  selectExpensesMeta,
  selectActivitiesMeta,
  selectFulfilmentsMeta,
  selectCustomersMeta,
  selectProductGroupsMeta,
  fetchBulkSales,
  fetchBulkExpenses,
  fetchBulkActivities,
  fetchBulkFulfilments,
  fetchBulkCustomers,
  fetchBulkProductGroups,
  fetchBulkOutOfStock,
} from "../redux/features/dataCache/bulkDataCacheSlice";

/**
 * DEFENSIVE: Ensure input is always an array.
 *
 * ARCHITECTURAL NOTE:
 * - This function exists ONLY as a last-resort safety net
 * - Redux reducers SHOULD always store raw arrays (never paginated objects)
 * - If this function ever needs to extract from an object, it indicates
 *   a bug in the reducer that should be fixed at the source
 * - This hook does NOT normalize or mutate data - it only reads and slices
 *
 * The normalizeItems logic in bulkDataCacheSlice operates on RAW BACKEND PAYLOADS,
 * not on Redux state. If you're seeing object-to-array conversion here,
 * the reducer storing the data is broken.
 */
const ensureArray = (data, debugSource = "unknown") => {
  // Fast path: already an array (expected case)
  if (Array.isArray(data)) return data;

  // Null/undefined - return empty (valid for unloaded state)
  if (data == null) return [];

  // DIAGNOSTIC: If we reach here, a reducer stored wrong data type
  if (typeof data === "object") {
    console.warn(
      `[useStatePagination] BUG DETECTED: Redux state "${debugSource}" contains an object instead of array.`,
      "Keys:",
      Object.keys(data),
      "This indicates a reducer is storing paginated response instead of raw array.",
      "Fix the reducer, not this hook.",
    );

    // Emergency extraction - but this should never be needed if reducers are correct
    if (Array.isArray(data.items)) return data.items;
    if (Array.isArray(data.data)) return data.data;
    if (Array.isArray(data.results)) return data.results;
  }

  console.error(
    `[useStatePagination] CRITICAL: Redux state "${debugSource}" is neither array nor object:`,
    typeof data,
  );
  return [];
};

/**
 * Generic pagination utility
 * Applies filtering, sorting, and pagination to an array
 */
const paginateArray = (items, page = 1, limit = 10, options = {}) => {
  const safeItems = ensureArray(items, options.debugSource || "paginateArray");
  const { sortField, sortDirection = "desc", filterFn } = options;

  // Apply filter if provided
  let filtered = filterFn ? safeItems.filter(filterFn) : safeItems;

  // Apply sorting if provided
  if (sortField) {
    filtered = [...filtered].sort((a, b) => {
      const aVal = a?.[sortField];
      const bVal = b?.[sortField];

      // Handle date sorting
      if (
        sortField === "createdAt" ||
        sortField === "date" ||
        sortField === "updatedAt"
      ) {
        const aDate = new Date(aVal || 0).getTime();
        const bDate = new Date(bVal || 0).getTime();
        return sortDirection === "asc" ? aDate - bDate : bDate - aDate;
      }

      // Handle numeric sorting
      if (typeof aVal === "number" && typeof bVal === "number") {
        return sortDirection === "asc" ? aVal - bVal : bVal - aVal;
      }

      // Handle string sorting
      const aStr = String(aVal || "").toLowerCase();
      const bStr = String(bVal || "").toLowerCase();
      return sortDirection === "asc"
        ? aStr.localeCompare(bStr)
        : bStr.localeCompare(aStr);
    });
  }

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const startIndex = (safePage - 1) * limit;
  const endIndex = startIndex + limit;
  const pageItems = filtered.slice(startIndex, endIndex);

  return {
    items: pageItems,
    total,
    totalPages,
    currentPage: safePage,
    hasMore: endIndex < total,
    isEmpty: total === 0,
  };
};

/**
 * Create a search filter function
 */
const createSearchFilter = (search, searchFields = ["name"]) => {
  if (!search || !search.trim()) return null;
  const searchLower = search.toLowerCase().trim();
  return (item) => {
    return searchFields.some((field) => {
      const value = item?.[field];
      if (typeof value === "string") {
        return value.toLowerCase().includes(searchLower);
      }
      return false;
    });
  };
};

/**
 * Create a multi-filter function from filter object
 */
const createMultiFilter = (filters = {}) => {
  const activeFilters = Object.entries(filters).filter(
    ([_, values]) => Array.isArray(values) && values.length > 0,
  );
  if (activeFilters.length === 0) return null;

  return (item) => {
    return activeFilters.every(([field, values]) => {
      // Handle nested item access (e.g., items in fulfilments)
      if (field === "category" && item.items) {
        return item.items.some((subItem) => values.includes(subItem?.category));
      }
      if (field === "warehouse" && item.items) {
        return item.items.some((subItem) =>
          values.includes(subItem?.warehouse),
        );
      }
      const itemValue = item?.[field];
      return values.includes(itemValue);
    });
  };
};

/**
 * Create a date range filter
 */
const createDateRangeFilter = (startDate, endDate, dateField = "createdAt") => {
  if (!startDate && !endDate) return null;
  const start = startDate ? new Date(startDate).getTime() : 0;
  const end = endDate ? new Date(endDate).getTime() : Infinity;

  return (item) => {
    const itemDate = new Date(item?.[dateField] || 0).getTime();
    return itemDate >= start && itemDate <= end;
  };
};

/**
 * Combine multiple filter functions
 */
const combineFilters = (...filters) => {
  const activeFilters = filters.filter(Boolean);
  if (activeFilters.length === 0) return null;
  return (item) => activeFilters.every((fn) => fn(item));
};

// ============================================================================
// SALES PAGINATION HOOK
// ============================================================================

/**
 * useStateSalesPagination
 *
 * Provides paginated access to sales/checkouts.
 * Reads from bulkDataCache.sales (denormalized via selectSalesArray).
 *
 * @param {number} page - Current page (1-indexed)
 * @param {number} limit - Items per page (default: 10)
 * @returns {Object} { items, pagination, isLoading, isEmpty, refresh }
 */
export function useStateSalesPagination(page = 1, limit = 10) {
  const dispatch = useDispatch();

  // Read from BULK CACHE: selectSalesArray denormalizes byId/allIds to array
  const salesArray = useSelector(selectSalesArray);
  const salesMeta = useSelector(selectSalesMeta);
  const isLoading = salesMeta?.isLoading || false;
  const aggregatedStats = useSelector(
    (state) => state.bulkDataCache.sales.aggregatedStats,
  );

  const result = useMemo(() => {
    const safeItems = ensureArray(salesArray, "bulkDataCache.sales");
    const paginated = paginateArray(safeItems, page, limit, {
      sortField: "createdAt",
      sortDirection: "desc",
    });

    return {
      items: paginated.items,
      pagination: {
        currentPage: paginated.currentPage,
        totalPages: paginated.totalPages,
        totalItems: paginated.total,
        itemsPerPage: limit,
        hasMore: paginated.hasMore,
      },
      isLoading: isLoading || false,
      isEmpty: paginated.isEmpty,
      aggregatedStats: aggregatedStats || null,
    };
  }, [salesArray, page, limit, isLoading, aggregatedStats]);

  const refresh = useCallback(() => {
    dispatch(fetchBulkSales({ force: true }));
  }, [dispatch]);

  return { ...result, refresh };
}

// ============================================================================
// EXPENSES PAGINATION HOOK
// ============================================================================

/**
 * useStateExpensesPagination
 *
 * Provides paginated access to expenses.
 * Reads from bulkDataCache.expenses (denormalized via selectExpensesArray).
 * Supports both positional args and object config.
 *
 * @param {Object|number} config - Config object or page number
 * @returns {Object} { items, pagination, isLoading, isEmpty, refresh, total, totalPages, currentPage, aggregatedStats }
 */
export function useStateExpensesPagination(config = {}) {
  const dispatch = useDispatch();

  // Read from BULK CACHE: selectExpensesArray denormalizes byId/allIds to array
  const expensesArray = useSelector(selectExpensesArray);
  const expensesMeta = useSelector(selectExpensesMeta);
  const isLoading = expensesMeta?.isLoading || false;
  const aggregatedStats = useSelector(
    (state) => state.bulkDataCache.expenses.aggregatedStats,
  );

  // Support both object config and positional args
  const {
    page = 1,
    limit = 10,
    filters = {},
    sortField = "createdAt",
    sortDirection = "desc",
  } = typeof config === "object" ? config : { page: config, limit: 10 };

  const result = useMemo(() => {
    const safeItems = ensureArray(expensesArray, "bulkDataCache.expenses");

    // Build filter function
    const filterFns = [];

    // Category filter
    if (filters.category && filters.category !== "All") {
      filterFns.push((item) => item.category === filters.category);
    }

    // Date range filter
    if (filters.startDate || filters.endDate) {
      filterFns.push(
        createDateRangeFilter(filters.startDate, filters.endDate, "date"),
      );
    }

    const combinedFilter =
      filterFns.length > 0 ? combineFilters(...filterFns) : null;

    const paginated = paginateArray(safeItems, page, limit, {
      sortField,
      sortDirection,
      filterFn: combinedFilter,
    });

    return {
      items: paginated.items,
      pagination: {
        currentPage: paginated.currentPage,
        totalPages: paginated.totalPages,
        totalItems: paginated.total,
        itemsPerPage: limit,
        hasMore: paginated.hasMore,
      },
      total: paginated.total,
      totalPages: paginated.totalPages,
      currentPage: paginated.currentPage,
      isLoading: isLoading || false,
      isEmpty: paginated.isEmpty,
      aggregatedStats: {
        totalAmount: aggregatedStats?.totalAmount || 0,
      },
    };
  }, [
    expensesArray,
    page,
    limit,
    filters,
    sortField,
    sortDirection,
    isLoading,
    aggregatedStats?.totalAmount,
  ]);

  const refresh = useCallback(() => {
    dispatch(fetchBulkExpenses({ force: true }));
  }, [dispatch]);

  return { ...result, refresh };
}

// ============================================================================
// ACTIVITIES PAGINATION HOOK
// ============================================================================

/**
 * useStateActivitiesPagination
 *
 * Provides paginated access to activities.
 * Reads from bulkDataCache.activities (denormalized via selectActivitiesArray).
 *
 * @param {number} page - Current page (1-indexed)
 * @param {number} limit - Items per page (default: 10)
 * @returns {Object} { items, pagination, isLoading, isEmpty, refresh }
 */
export function useStateActivitiesPagination(page = 1, limit = 10) {
  const dispatch = useDispatch();

  // Read from BULK CACHE: selectActivitiesArray denormalizes byId/allIds to array
  const activitiesArray = useSelector(selectActivitiesArray);
  const activitiesMeta = useSelector(selectActivitiesMeta);
  const isLoading = activitiesMeta?.isLoading || false;

  const result = useMemo(() => {
    const safeItems = ensureArray(activitiesArray, "bulkDataCache.activities");
    const paginated = paginateArray(safeItems, page, limit, {
      sortField: "createdAt",
      sortDirection: "desc",
    });

    return {
      items: paginated.items,
      pagination: {
        currentPage: paginated.currentPage,
        totalPages: paginated.totalPages,
        totalItems: paginated.total,
        itemsPerPage: limit,
        hasMore: paginated.hasMore,
      },
      isLoading: isLoading || false,
      isEmpty: paginated.isEmpty,
    };
  }, [activitiesArray, page, limit, isLoading]);

  const refresh = useCallback(() => {
    dispatch(fetchBulkActivities({ force: true }));
  }, [dispatch]);

  return { ...result, refresh };
}

// ============================================================================
// FULFILMENTS PAGINATION HOOK
// ============================================================================

/**
 * useStateFulfilmentsPagination
 *
 * Provides paginated access to fulfilments (incomplete payments).
 * Reads from bulkDataCache.fulfilments (denormalized via selectFulfilmentsArray).
 * Supports filtering by status, search, and custom filters.
 *
 * @param {Object} config - Configuration object
 * @returns {Object} { items, totalPages, isLoading, isEmpty, refresh }
 */
export function useStateFulfilmentsPagination(config = {}) {
  const dispatch = useDispatch();

  // Read from BULK CACHE: selectFulfilmentsArray denormalizes byId/allIds to array
  const fulfilmentsArray = useSelector(selectFulfilmentsArray);
  const fulfilmentsMeta = useSelector(selectFulfilmentsMeta);
  const isLoading = fulfilmentsMeta?.isLoading || false;

  const {
    page = 1,
    limit = 10,
    search = "",
    filters = {},
    status = "pending",
    sortField = "createdAt",
    sortDirection = "desc",
  } = config;

  const result = useMemo(() => {
    const safeItems = ensureArray(
      fulfilmentsArray,
      "bulkDataCache.fulfilments",
    );

    // Build combined filter
    const filterFns = [];

    // Status filter
    if (status) {
      filterFns.push((item) => {
        const itemStatus = item?.payment?.paymentStatus || "pending";
        return itemStatus === status;
      });
    }

    // Search filter
    if (search && search.trim()) {
      const searchLower = search.toLowerCase();
      filterFns.push((item) => {
        const customerName = item?.customer?.name?.toLowerCase() || "";
        const customerPhone = item?.customer?.phone || "";
        const customerEmail = item?.customer?.email?.toLowerCase() || "";
        return (
          customerName.includes(searchLower) ||
          customerPhone.includes(searchLower) ||
          customerEmail.includes(searchLower)
        );
      });
    }

    // Category filter
    if (filters.category?.length > 0) {
      filterFns.push((item) => {
        return item?.items?.some((subItem) =>
          filters.category.includes(subItem?.category),
        );
      });
    }

    // Warehouse filter
    if (filters.warehouse?.length > 0) {
      filterFns.push((item) => {
        return item?.items?.some((subItem) =>
          filters.warehouse.includes(subItem?.warehouse),
        );
      });
    }

    const combinedFilter =
      filterFns.length > 0 ? combineFilters(...filterFns) : null;

    const paginated = paginateArray(safeItems, page, limit, {
      sortField,
      sortDirection,
      filterFn: combinedFilter,
    });

    return {
      items: paginated.items,
      totalPages: paginated.totalPages,
      total: paginated.total,
      currentPage: paginated.currentPage,
      isLoading: isLoading || false,
      isEmpty: paginated.isEmpty,
    };
  }, [
    fulfilmentsArray,
    page,
    limit,
    search,
    filters,
    status,
    sortField,
    sortDirection,
    isLoading,
  ]);

  const refresh = useCallback(() => {
    dispatch(fetchBulkFulfilments({ force: true }));
  }, [dispatch]);

  return { ...result, refresh };
}

// ============================================================================
// CUSTOMERS PAGINATION HOOK
// ============================================================================

/**
 * useStateCustomersPagination
 *
 * Provides paginated access to customers.
 * Reads from bulkDataCache.customers (denormalized via selectCustomersArray).
 *
 * @param {Object} config - Configuration object
 * @returns {Object} { items, totalPages, isLoading, isEmpty, refresh }
 */
export function useStateCustomersPagination(config = {}) {
  const dispatch = useDispatch();

  // Read from BULK CACHE: selectCustomersArray denormalizes byId/allIds to array
  const customersArray = useSelector(selectCustomersArray);
  const customersMeta = useSelector(selectCustomersMeta);
  const isLoading = customersMeta?.isLoading || false;

  const {
    page = 1,
    limit = 10,
    search = "",
    sortField = "name",
    sortDirection = "asc",
  } = config;

  const result = useMemo(() => {
    const safeItems = ensureArray(customersArray, "bulkDataCache.customers");

    // Build filter
    let filterFn = null;
    if (search && search.trim()) {
      const searchLower = search.toLowerCase();
      filterFn = (item) => {
        const name = item?.name?.toLowerCase() || "";
        const phone = item?.phone || "";
        const email = item?.email?.toLowerCase() || "";
        return (
          name.includes(searchLower) ||
          phone.includes(searchLower) ||
          email.includes(searchLower)
        );
      };
    }

    const paginated = paginateArray(safeItems, page, limit, {
      sortField,
      sortDirection,
      filterFn,
    });

    return {
      items: paginated.items,
      totalPages: paginated.totalPages,
      total: paginated.total,
      currentPage: paginated.currentPage,
      isLoading: isLoading || false,
      isEmpty: paginated.isEmpty,
    };
  }, [
    customersArray,
    page,
    limit,
    search,
    sortField,
    sortDirection,
    isLoading,
  ]);

  const refresh = useCallback(() => {
    dispatch(fetchBulkCustomers({ force: true }));
  }, [dispatch]);

  return { ...result, refresh };
}

// ============================================================================
// PRODUCT GROUPS PAGINATION HOOK
// ============================================================================

/**
 * useStateProductGroupsPagination
 *
 * Provides paginated access to product groups.
 * Reads from bulkDataCache.productGroups (denormalized via selectProductGroupsArray).
 *
 * @param {Object} config - Configuration object
 * @returns {Object} { items, totalPages, isLoading, isEmpty, refresh }
 */
export function useStateProductGroupsPagination(config = {}) {
  const dispatch = useDispatch();

  // Read from BULK CACHE: selectProductGroupsArray denormalizes byId/allIds to array
  const productGroupsArray = useSelector(selectProductGroupsArray);
  const productGroupsMeta = useSelector(selectProductGroupsMeta);
  const isLoading = productGroupsMeta?.isLoading || false;

  const {
    page = 1,
    limit = 10,
    search = "",
    filters = {},
    sortField = "createdAt",
    sortDirection = "desc",
  } = config;

  const result = useMemo(() => {
    const safeItems = ensureArray(
      productGroupsArray,
      "bulkDataCache.productGroups",
    );

    // Build combined filter
    const filterFns = [];

    // Search filter
    if (search && search.trim()) {
      const searchLower = search.toLowerCase();
      filterFns.push((item) => {
        // Handle both 'name' and 'groupName' properties
        const name = (item?.name || item?.groupName || "").toLowerCase();
        const category = (item?.category || "").toLowerCase();
        // Product groups don't have SKU, only individual products do
        return name.includes(searchLower) || category.includes(searchLower);
      });
    }

    // Category filter
    if (filters.category?.length > 0) {
      filterFns.push((item) => filters.category.includes(item?.category));
    }

    // Warehouse filter
    if (filters.warehouse?.length > 0) {
      filterFns.push((item) => filters.warehouse.includes(item?.warehouse));
    }

    const combinedFilter =
      filterFns.length > 0 ? combineFilters(...filterFns) : null;

    const paginated = paginateArray(safeItems, page, limit, {
      sortField,
      sortDirection,
      filterFn: combinedFilter,
    });

    return {
      items: paginated.items,
      totalPages: paginated.totalPages,
      total: paginated.total,
      currentPage: paginated.currentPage,
      isLoading: isLoading || false,
      isEmpty: paginated.isEmpty,
    };
  }, [
    productGroupsArray,
    page,
    limit,
    search,
    filters,
    sortField,
    sortDirection,
    isLoading,
  ]);

  const refresh = useCallback(() => {
    dispatch(fetchBulkProductGroups({ force: true }));
  }, [dispatch]);

  return { ...result, refresh };
}

// ============================================================================
// OUT OF STOCK PAGINATION HOOK
// ============================================================================

/**
 * useStateOutOfStockPagination
 *
 * Provides paginated access to out-of-stock items.
 * Reads from bulkDataCache.outOfStock (denormalized via selectOutOfStockProductsArray + selectOutOfStockGroupsArray).
 * Includes both products and product groups.
 *
 * @param {number} page - Current page (1-indexed)
 * @param {number} limit - Items per page (default: 10)
 * @returns {Object} { items, pagination, isLoading, isEmpty, refresh, products, productGroups }
 */
export function useStateOutOfStockPagination(page = 1, limit = 10) {
  const dispatch = useDispatch();

  // Read from BULK CACHE: selectOutOfStockProductsArray & selectOutOfStockGroupsArray
  const outOfStockProducts = useSelector(selectOutOfStockProductsArray);
  const outOfStockGroups = useSelector(selectOutOfStockGroupsArray);
  // Check loading from both nested meta objects
  const isLoading = useSelector(
    (state) =>
      state.bulkDataCache.outOfStock.products.meta?.isLoading ||
      state.bulkDataCache.outOfStock.productGroups.meta?.isLoading ||
      false,
  );

  const result = useMemo(() => {
    const safeProducts = ensureArray(
      outOfStockProducts,
      "bulkDataCache.outOfStock.products",
    );
    const safeGroups = ensureArray(
      outOfStockGroups,
      "bulkDataCache.outOfStock.productGroups",
    );

    // Combine all out-of-stock items with type identifier
    const allItems = [
      ...safeProducts.map((p) => ({ ...p, _type: "product" })),
      ...safeGroups.map((g) => ({ ...g, _type: "productGroup" })),
    ];

    const paginated = paginateArray(allItems, page, limit, {
      sortField: "createdAt",
      sortDirection: "desc",
    });

    return {
      items: paginated.items,
      pagination: {
        currentPage: paginated.currentPage,
        totalPages: paginated.totalPages,
        totalItems: paginated.total,
        itemsPerPage: limit,
        hasMore: paginated.hasMore,
      },
      isLoading: isLoading || false,
      isEmpty: paginated.isEmpty,
      products: safeProducts,
      productGroups: safeGroups,
    };
  }, [outOfStockProducts, outOfStockGroups, page, limit, isLoading]);

  const refresh = useCallback(() => {
    dispatch(fetchBulkOutOfStock({ force: true }));
  }, [dispatch]);

  return { ...result, refresh };
}

// ============================================================================
// PRODUCTS PAGINATION HOOK
// ============================================================================

/**
 * useStateProductPagination
 *
 * Provides paginated access to products.
 * Reads from state.product.products (the ACTUAL data source).
 * Supports search and filters for client-side operations.
 *
 * @param {Object} config - Configuration object
 * @returns {Object} { items, totalPages, isLoading, canPaginateLocally, refresh, aggregatedStats }
 */
export function useStateProductPagination(config = {}) {
  const dispatch = useDispatch();

  // Read from product cache (bulk-loaded during bootstrap)
  const productsArray = useSelector(selectAllProductsArray);
  const backgroundLoading = useSelector(selectBackgroundLoading);
  const isLoading = Boolean(backgroundLoading?.isActive);

  const {
    page = 1,
    limit = 10,
    search = "",
    filters = {},
    sortField = "createdAt",
    sortDirection = "desc",
  } = config;

  const result = useMemo(() => {
    const safeItems = ensureArray(productsArray, "state.product.products");

    // Build combined filter
    const filterFns = [];

    // Search filter
    if (search && search.trim()) {
      const searchLower = search.toLowerCase();
      filterFns.push((item) => {
        const name = item?.name?.toLowerCase() || "";
        const sku = item?.sku?.toLowerCase() || "";
        const category = item?.category?.toLowerCase() || "";
        const description = item?.description?.toLowerCase() || "";
        return (
          name.includes(searchLower) ||
          sku.includes(searchLower) ||
          category.includes(searchLower) ||
          description.includes(searchLower)
        );
      });
    }

    // Category filter
    if (filters.category?.length > 0) {
      filterFns.push((item) => filters.category.includes(item?.category));
    }

    // Warehouse filter
    if (filters.warehouse?.length > 0) {
      filterFns.push((item) => filters.warehouse.includes(item?.warehouse));
    }

    // Price range filter
    if (filters.priceRange?.length > 0) {
      filterFns.push((item) => {
        const price = parseFloat(item?.price) || 0;
        return filters.priceRange.some((range) => {
          const [min, max] = range.split("-").map(Number);
          return price >= min && (max ? price <= max : true);
        });
      });
    }

    // Listing status filter
    if (filters.listStatus?.length > 0) {
      const wantsListed = filters.listStatus.includes("listed");
      const wantsUnlisted = filters.listStatus.includes("unlisted");

      if (!(wantsListed && wantsUnlisted)) {
        filterFns.push((item) =>
          wantsListed ? Boolean(item?.listProduct) : !item?.listProduct,
        );
      }
    }

    const combinedFilter =
      filterFns.length > 0 ? combineFilters(...filterFns) : null;

    const paginated = paginateArray(safeItems, page, limit, {
      sortField,
      sortDirection,
      filterFn: combinedFilter,
    });

    // Calculate aggregated stats for filtered products
    let filteredItems = combinedFilter
      ? safeItems.filter(combinedFilter)
      : safeItems;
    const aggregatedStats = {
      totalProducts: filteredItems.length,
      totalValue: filteredItems.reduce(
        (sum, p) =>
          sum + (parseFloat(p?.price) || 0) * (parseInt(p?.quantity) || 0),
        0,
      ),
      totalQuantity: filteredItems.reduce(
        (sum, p) => sum + (parseInt(p?.quantity) || 0),
        0,
      ),
    };

    return {
      items: paginated.items,
      totalPages: paginated.totalPages,
      total: paginated.total,
      currentPage: paginated.currentPage,
      isLoading: isLoading || false,
      isEmpty: paginated.isEmpty,
      // Products array is already loaded - can always paginate locally
      canPaginateLocally: safeItems.length > 0,
      aggregatedStats,
      allItems: filteredItems, // Expose all filtered items for batch operations
    };
  }, [
    productsArray,
    page,
    limit,
    search,
    filters,
    sortField,
    sortDirection,
    isLoading,
  ]);

  const refresh = useCallback(() => {
    dispatch(fetchAllProductsForSearch({ force: true }));
  }, [dispatch]);

  return { ...result, refresh };
}

// ============================================================================
// DEFAULT EXPORT (for backwards compatibility)
// ============================================================================

export default {
  useStateProductPagination,
  useStateSalesPagination,
  useStateExpensesPagination,
  useStateActivitiesPagination,
  useStateFulfilmentsPagination,
  useStateCustomersPagination,
  useStateProductGroupsPagination,
  useStateOutOfStockPagination,
};
