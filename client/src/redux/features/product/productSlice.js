import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import productService from "./productService";
import { toast } from "sonner";

/**
 * Safely extract array from any backend payload.
 * CRITICAL: This ensures Redux state ALWAYS contains arrays, never objects.
 * This is the root fix for "items.forEach is not a function" errors.
 */
const ensureArray = (payload, ...fieldNames) => {
  // Already an array
  if (Array.isArray(payload)) {
    return payload;
  }

  // Null/undefined
  if (payload == null) {
    return [];
  }

  // Not an object
  if (typeof payload !== "object") {
    console.warn("[ProductSlice] Unexpected payload type:", typeof payload);
    return [];
  }

  // Try specified field names first
  for (const field of fieldNames) {
    if (Array.isArray(payload[field])) {
      return payload[field];
    }
  }

  // Try common patterns
  const commonFields = ["items", "data", "results", "records"];
  for (const field of commonFields) {
    if (Array.isArray(payload[field])) {
      return payload[field];
    }
  }

  console.warn(
    "[ProductSlice] Could not extract array from payload:",
    Object.keys(payload),
  );
  return [];
};

const initialState = {
  product: null,
  sale: null,
  topProducts: [],
  lowProducts: [],
  salesByYear: [],
  products: [],
  allProductGroups: [],
  sales: [],
  productsOutOfStock: [],
  productGroupOutOfStock: [],
  filterOptions: {
    categories: [],
    warehouses: [],
  },
  isError: false,
  isSuccess: false,
  isLoading: false,
  message: "",
  totalSalesValue: 0,
  totalProfitValue: 0,
  totalStoreValueByPrice: 0,
  totalStoreValueByCost: 0,
  outOfStockSingleProducts: 0,
  outOfStockGroupProducts: 0,
  category: [],
  savingDraftStatus: "",
  draft: null,
  dashboardStats: {
    totalProducts: 0,
    totalCategories: 0,
    outOfStock: {
      singleProducts: 0,
      groupProducts: 0,
      total: 0,
    },
    storeValue: {
      byPrice: 0,
      byCost: 0,
    },
    totalExpenses: 0,
  },
  // Pagination metadata
  productsPagination: {
    currentPage: 1,
    totalPages: 1,
    total: 0,
    hasMore: false,
  },
  productGroupsPagination: {
    currentPage: 1,
    totalPages: 1,
    total: 0,
    hasMore: false,
  },
  salesPagination: { currentPage: 1, totalPages: 1, total: 0, hasMore: false },
  outOfStockPagination: {
    products: { currentPage: 1, totalPages: 1, total: 0, hasMore: false },
    productGroups: { currentPage: 1, totalPages: 1, total: 0, hasMore: false },
  },
  topProductsPagination: {
    products: { currentPage: 1, totalPages: 1, total: 0, hasMore: false },
    productGroups: { currentPage: 1, totalPages: 1, total: 0, hasMore: false },
  },
  lowProductsPagination: {
    products: { currentPage: 1, totalPages: 1, total: 0, hasMore: false },
    productGroups: { currentPage: 1, totalPages: 1, total: 0, hasMore: false },
  },
  // Aggregated stats for all filtered results (not just current page)
  productsAggregatedStats: {
    totalValue: 0,
    totalCost: 0,
    totalQuantity: 0,
    totalProducts: 0,
  },
  productGroupsAggregatedStats: {
    totalValue: 0,
    totalCost: 0,
    totalVariants: 0,
    totalGroups: 0,
  },
};

// Create New Product
export const createMultipleProducts = createAsyncThunk(
  "products/createMultipleProducts",
  async (formData, thunkAPI) => {
    try {
      return await productService.createMultipleProducts(formData);
    } catch (error) {
      const message =
        (error.response &&
          error.response.data &&
          error.response.data.message) ||
        error.message ||
        error.toString();
      console.log(message);
      return thunkAPI.rejectWithValue(message);
    }
  },
);

// Create New Product
export const createProduct = createAsyncThunk(
  "products/create",
  async (formData, thunkAPI) => {
    try {
      const product = await productService.createProduct(formData);
      // Update the product cache immediately for instant UI update
      // This ensures the product appears without waiting for realtime event
      if (product) {
        thunkAPI.dispatch({
          type: "productCache/addProduct",
          payload: product,
        });
        thunkAPI.dispatch({
          type: "productCache/updateProduct",
          payload: product,
        });
      }
      return product;
    } catch (error) {
      const message =
        (error.response &&
          error.response.data &&
          error.response.data.message) ||
        error.message ||
        error.toString();
      console.log(message);
      return thunkAPI.rejectWithValue(message);
    }
  },
);

// Sell product
export const sellProduct = createAsyncThunk(
  "product/sellProducById",
  async ({ id, formData }, thunkAPI) => {
    try {
      return await productService.sellProduct(id, formData);
    } catch (error) {
      const message =
        (error.response &&
          error.response.data &&
          error.response.data.message) ||
        error.message ||
        error.toString();
      console.log(message);
      return thunkAPI.rejectWithValue(message);
    }
  },
);

// Get all low products
export const getLowProducts = createAsyncThunk(
  "products/getAllLowSellingProducts",
  async ({ page = 1, limit = 5 } = {}, thunkAPI) => {
    try {
      return await productService.getLowProducts(page, limit);
    } catch (error) {
      const message =
        (error.response &&
          error.response.data &&
          error.response.data.message) ||
        error.message ||
        error.toString();
      console.log(message);
      return thunkAPI.rejectWithValue(message);
    }
  },
);

// Get all top selling products
export const getSalesByYear = createAsyncThunk(
  "products/getAllAllSalesByYear",
  async (params, thunkAPI) => {
    try {
      // Handle both object params { year: 2026 } and direct year value for backwards compatibility
      const year =
        typeof params === "object" && params.year ? params.year : params;
      return await productService.getSalesByYear(year);
    } catch (error) {
      const message =
        (error.response &&
          error.response.data &&
          error.response.data.message) ||
        error.message ||
        error.toString();
      console.log(message);
      return thunkAPI.rejectWithValue(message);
    }
  },
);

// Get all top selling products
export const getTopProducts = createAsyncThunk(
  "products/getAllTopSellingProducts",
  async ({ page = 1, limit = 5 } = {}, thunkAPI) => {
    try {
      return await productService.getTopProducts(page, limit);
    } catch (error) {
      const message =
        (error.response &&
          error.response.data &&
          error.response.data.message) ||
        error.message ||
        error.toString();
      console.log(message);
      return thunkAPI.rejectWithValue(message);
    }
  },
);

// Get all product groups
export const getAllProductGroups = createAsyncThunk(
  "products/getAllProductGroups",
  async (
    {
      page = 1,
      limit = 10,
      search = "",
      category = [],
      warehouse = [],
      priceRange = [],
    } = {},
    thunkAPI,
  ) => {
    try {
      return await productService.getProductGroups({
        page,
        limit,
        search,
        category,
        warehouse,
        priceRange,
      });
    } catch (error) {
      const message =
        (error.response &&
          error.response.data &&
          error.response.data.message) ||
        error.message ||
        error.toString();
      console.log(message);
      return thunkAPI.rejectWithValue(message);
    }
  },
);

// Get all products
export const getProducts = createAsyncThunk(
  "products/getAll",
  async (
    {
      page = 1,
      limit = 10,
      search = "",
      category = [],
      warehouse = [],
      priceRange = [],
    } = {},
    thunkAPI,
  ) => {
    try {
      return await productService.getProducts({
        page,
        limit,
        search,
        category,
        warehouse,
        priceRange,
      });
    } catch (error) {
      const message =
        (error.response &&
          error.response.data &&
          error.response.data.message) ||
        error.message ||
        error.toString();
      console.log(message);
      return thunkAPI.rejectWithValue(message);
    }
  },
);

// Get filter options (all categories and warehouses)
// Uses condition to prevent duplicate fetches when data already exists
export const getFilterOptions = createAsyncThunk(
  "products/getFilterOptions",
  async (options = {}, thunkAPI) => {
    try {
      return await productService.getFilterOptions();
    } catch (error) {
      const message =
        (error.response &&
          error.response.data &&
          error.response.data.message) ||
        error.message ||
        error.toString();
      console.log(message);
      return thunkAPI.rejectWithValue(message);
    }
  },
  {
    // Condition: Skip fetch if filter options already exist and force is not specified
    condition: (options = {}, { getState }) => {
      const { force = false } = options;
      const state = getState();
      const filterOptions = state.product.filterOptions;
      const hasCategories = filterOptions?.categories?.length > 0;
      const hasWarehouses = filterOptions?.warehouses?.length > 0;

      // If we already have filter options and not forcing, skip the fetch
      if (!force && (hasCategories || hasWarehouses)) {
        console.log(
          "[getFilterOptions] Skipping fetch - data already exists in Redux",
        );
        return false; // Returning false cancels the thunk
      }
      return true;
    },
  },
);

// Get all products that are out of stock
export const getOutOfStock = createAsyncThunk(
  "products/getAllProductsOutOfStock",
  async (
    { page = 1, limit = 10, search = "", category = [], warehouse = [] } = {},
    thunkAPI,
  ) => {
    try {
      return await productService.getOutOfStock({
        page,
        limit,
        search,
        category,
        warehouse,
      });
    } catch (error) {
      const message =
        (error.response &&
          error.response.data &&
          error.response.data.message) ||
        error.message ||
        error.toString();
      console.log(message);
      return thunkAPI.rejectWithValue(message);
    }
  },
);

// Get all Sales
export const getSales = createAsyncThunk(
  "products/getAllSales",
  async ({ interval, page = 1, limit = 10, search = "" }, thunkAPI) => {
    try {
      return await productService.getSales(interval, page, limit, search);
    } catch (error) {
      const message =
        (error.response &&
          error.response.data &&
          error.response.data.message) ||
        error.message ||
        error.toString();
      console.log(message);
      return thunkAPI.rejectWithValue(message);
    }
  },
);

// Delete a Product
export const deleteProduct = createAsyncThunk(
  "products/delete",
  async (id, thunkAPI) => {
    try {
      return await productService.deleteProduct(id);
    } catch (error) {
      const message =
        (error.response &&
          error.response.data &&
          error.response.data.message) ||
        error.message ||
        error.toString();
      console.log(message);
      return thunkAPI.rejectWithValue(message);
    }
  },
);

// Batch delete products
export const batchDeleteProducts = createAsyncThunk(
  "products/batchDelete",
  async (productIds, thunkAPI) => {
    try {
      return await productService.batchDeleteProducts(productIds);
    } catch (error) {
      const message =
        (error.response &&
          error.response.data &&
          error.response.data.message) ||
        error.message ||
        error.toString();
      console.log(message);
      return thunkAPI.rejectWithValue(message);
    }
  },
);

// Batch delete product groups
export const batchDeleteProductGroups = createAsyncThunk(
  "products/batchDeleteGroups",
  async (groupIds, thunkAPI) => {
    try {
      return await productService.batchDeleteProductGroups(groupIds);
    } catch (error) {
      const message =
        (error.response &&
          error.response.data &&
          error.response.data.message) ||
        error.message ||
        error.toString();
      console.log(message);
      return thunkAPI.rejectWithValue(message);
    }
  },
);

// Batch toggle products
export const batchToggleProducts = createAsyncThunk(
  "products/batchToggle",
  async ({ productIds, listProduct }, thunkAPI) => {
    try {
      return await productService.batchToggleProducts(productIds, listProduct);
    } catch (error) {
      const message =
        (error.response &&
          error.response.data &&
          error.response.data.message) ||
        error.message ||
        error.toString();
      console.log(message);
      return thunkAPI.rejectWithValue(message);
    }
  },
);

export const updateGroupListingOptions = createAsyncThunk(
  "products/updateGroupListingOptions",
  async ({ id, listingOptions }, thunkAPI) => {
    try {
      return await productService.updateGroupListingOptions(id, listingOptions);
    } catch (error) {
      const message =
        (error.response &&
          error.response.data &&
          error.response.data.message) ||
        error.message ||
        error.toString();
      console.log(message);
      return thunkAPI.rejectWithValue(message);
    }
  },
);

// Delete a group item
export const deleteGroupItem = createAsyncThunk(
  "products/deleteGroup",
  async (id, thunkAPI) => {
    try {
      return await productService.deleteGroup(id);
    } catch (error) {
      const message =
        (error.response &&
          error.response.data &&
          error.response.data.message) ||
        error.message ||
        error.toString();
      console.log(message);
      return thunkAPI.rejectWithValue(message);
    }
  },
);

// Get a product
export const getProduct = createAsyncThunk(
  "products/getSingleProduct",
  async (id, thunkAPI) => {
    try {
      return await productService.getProduct(id);
    } catch (error) {
      const message =
        (error.response &&
          error.response.data &&
          error.response.data.message) ||
        error.message ||
        error.toString();
      console.log(message);
      return thunkAPI.rejectWithValue(message);
    }
  },
);

// Get a sale
export const getSale = createAsyncThunk(
  "products/getSaleById",
  async (id, thunkAPI) => {
    try {
      return await productService.getSale(id);
    } catch (error) {
      const message =
        (error.response &&
          error.response.data &&
          error.response.data.message) ||
        error.message ||
        error.toString();
      console.log(message);
      return thunkAPI.rejectWithValue(message);
    }
  },
);

// Update product
export const updateProduct = createAsyncThunk(
  "products/updateProduct",
  async ({ id, formData }, thunkAPI) => {
    try {
      // console.log("update", id, formData);
      return await productService.updateProduct(id, formData);
    } catch (error) {
      const message =
        (error.response &&
          error.response.data &&
          error.response.data.message) ||
        error.message ||
        error.toString();
      console.log(message);
      return thunkAPI.rejectWithValue(message);
    }
  },
);

// Update product group
export const updateProductGroup = createAsyncThunk(
  "products/groupUpdate",
  async ({ id, formData }, thunkAPI) => {
    try {
      // console.log("update", id, formData);
      return await productService.updateProductGroup(id, formData);
    } catch (error) {
      const message =
        (error.response &&
          error.response.data &&
          error.response.data.message) ||
        error.message ||
        error.toString();
      console.log(message);
      return thunkAPI.rejectWithValue(message);
    }
  },
);

// Save product to draft
export const saveDraft = createAsyncThunk(
  "products/draft/saveDraft",
  async (formData, thunkAPI) => {
    try {
      return await productService.saveDraft(formData);
    } catch (error) {
      const message =
        (error.response &&
          error.response.data &&
          error.response.data.message) ||
        error.message ||
        error.toString();
      console.log(message);
      return thunkAPI.rejectWithValue(message);
    }
  },
);

// Get dashboard statistics
export const getDashboardStats = createAsyncThunk(
  "products/getDashboardStats",
  async (_, thunkAPI) => {
    try {
      return await productService.getDashboardStats();
    } catch (error) {
      const message =
        (error.response &&
          error.response.data &&
          error.response.data.message) ||
        error.message ||
        error.toString();
      console.log(message);
      return thunkAPI.rejectWithValue(message);
    }
  },
);

// Save product to draft
export const getDraft = createAsyncThunk(
  "products/draft/getDraft",
  async (_, thunkAPI) => {
    try {
      return await productService.getDraft();
    } catch (error) {
      const message =
        (error.response &&
          error.response.data &&
          error.response.data.message) ||
        error.message ||
        error.toString();
      console.log(message);
      return thunkAPI.rejectWithValue(message);
    }
  },
);

const productSlice = createSlice({
  name: "product",
  initialState,
  reducers: {
    setDashboardStats(state, action) {
      state.dashboardStats = {
        ...state.dashboardStats,
        ...action.payload,
        outOfStock: {
          ...state.dashboardStats.outOfStock,
          ...(action.payload?.outOfStock || {}),
        },
        storeValue: {
          ...state.dashboardStats.storeValue,
          ...(action.payload?.storeValue || {}),
        },
      };
    },
    CALC_STORE_VALUE_BY_PRICE(state, action) {
      const products = action.payload;
      const array = [];
      products.map((item) => {
        const { price, quantity } = item;
        const productValue = price * quantity;
        return array.push(productValue);
      });
      const totalValue = array.reduce((a, b) => {
        return a + b;
      }, 0);
      state.totalStoreValueByPrice = totalValue;
    },
    CALC_STORE_VALUE_BY_COST(state, action) {
      const products = action.payload;
      const array = [];
      products.map((item) => {
        const { price, quantity, cost } = item;
        const productValue = cost * quantity;
        return array.push(productValue);
      });
      const totalValue = array.reduce((a, b) => {
        return a + b;
      }, 0);
      state.totalStoreValueByCost = totalValue;
    },
    CALC_SOLD_VALUE(state, action) {
      const sales = action.payload;
      // console.log("store value",sales);
      const array = [];
      sales.map((item) => {
        const { price, quantity } = item;
        if (price) {
          const productValue = price * quantity;
          return array.push(productValue);
        }
      });
      const totalValue = array.reduce((a, b) => {
        return a + b;
      }, 0);
      state.totalSalesValue = totalValue;
    },
    CALC_PROFIT_VALUE(state, action) {
      const sales = action.payload;
      const array = [];
      sales.map((item) => {
        const { cost, quantity, price } = item;
        if (price && cost) {
          const profit = price * quantity - cost * quantity;
          return array.push(profit);
        }
      });
      const totalValue = array.reduce((a, b) => {
        return a + b;
      }, 0);
      state.totalProfitValue = totalValue;
    },
    CALC_OUTOFSTOCK_SINGLE_PRODUCTS(state, action) {
      const products = action.payload;
      const array = [];
      products.map((item) => {
        const { quantity } = item;

        return array.push(quantity);
      });
      let count = 0;
      array.forEach((number) => {
        if (number === 0 || number === "0") {
          count += 1;
        }
      });
      state.outOfStockSingleProducts = count;
    },
    CALC_OUTOFSTOCK_GROUP_PRODUCTS(state, action) {
      const productGroups = action.payload;
      const array = [];
      productGroups.map((item) => {
        const { combinations, cost, price } = item;

        if (
          combinations.length === cost.length &&
          cost.length === price.length
        ) {
          return array.push(combinations);
        }
      });
      let count = 0;
      array.forEach((number) => {
        if (number.length === 0 || number.length === "0") {
          count += 1;
        }
      });
      state.outOfStockGroupProducts = count;
    },
    CALC_CATEGORY(state, action) {
      const products = action.payload;
      const array = [];
      products.map((item) => {
        const { category } = item;

        return array.push(category);
      });
      const uniqueCategory = [...new Set(array)];
      state.category = uniqueCategory;
    },

    addProduct(state, action) {
      // SAFETY: Ensure products is an array before operating
      if (!Array.isArray(state.products)) {
        console.error(
          "[ProductSlice] BUG: state.products is not an array in addProduct",
        );
        state.products = [];
      }

      // Add new product to the beginning of the list
      const newProduct = action.payload;
      if (newProduct && newProduct._id) {
        const exists = state.products.some((p) => p._id === newProduct._id);
        if (!exists) {
          state.products.unshift(newProduct);
          // Update pagination total
          if (state.productsPagination) {
            state.productsPagination.total += 1;
          }
        }
      }
    },

    updateProductInList(state, action) {
      // SAFETY: Ensure products is an array before operating
      if (!Array.isArray(state.products)) {
        console.error(
          "[ProductSlice] BUG: state.products is not an array in updateProductInList",
        );
        return;
      }

      const updatedProduct = action.payload;
      if (!updatedProduct || !updatedProduct._id) return;

      const index = state.products.findIndex(
        (p) => p._id === updatedProduct._id,
      );
      if (index !== -1) {
        // Merge updates into existing product
        state.products[index] = { ...state.products[index], ...updatedProduct };
      }
      // Also update single product if currently viewing
      if (state.product && state.product._id === updatedProduct._id) {
        state.product = { ...state.product, ...updatedProduct };
      }
    },

    removeProductFromList(state, action) {
      // SAFETY: Ensure products is an array before operating
      if (!Array.isArray(state.products)) {
        console.error(
          "[ProductSlice] BUG: state.products is not an array in removeProductFromList",
        );
        state.products = [];
        return;
      }

      const productId = action.payload;
      if (!productId) return;

      state.products = state.products.filter((p) => p._id !== productId);
      // Update pagination total
      if (state.productsPagination) {
        state.productsPagination.total = Math.max(
          0,
          state.productsPagination.total - 1,
        );
      }
    },

    updateProductGroupInList(state, action) {
      // SAFETY: Ensure allProductGroups is an array before operating
      if (!Array.isArray(state.allProductGroups)) {
        console.error(
          "[ProductSlice] BUG: state.allProductGroups is not an array in updateProductGroupInList",
        );
        return;
      }

      const updatedGroup = action.payload;
      if (!updatedGroup || !updatedGroup._id) return;

      const index = state.allProductGroups.findIndex(
        (g) => g._id === updatedGroup._id,
      );
      if (index !== -1) {
        state.allProductGroups[index] = {
          ...state.allProductGroups[index],
          ...updatedGroup,
        };
      }
    },

    removeProductGroupFromList(state, action) {
      // SAFETY: Ensure allProductGroups is an array before operating
      if (!Array.isArray(state.allProductGroups)) {
        console.error(
          "[ProductSlice] BUG: state.allProductGroups is not an array in removeProductGroupFromList",
        );
        state.allProductGroups = [];
        return;
      }

      const groupId = action.payload;
      if (!groupId) return;

      state.allProductGroups = state.allProductGroups.filter(
        (g) => g._id !== groupId,
      );
      if (state.productGroupsPagination) {
        state.productGroupsPagination.total = Math.max(
          0,
          state.productGroupsPagination.total - 1,
        );
      }
    },

    addSaleToList(state, action) {
      // SAFETY: Ensure sales is an array before operating
      if (!Array.isArray(state.sales)) {
        console.error(
          "[ProductSlice] BUG: state.sales is not an array in addSaleToList",
        );
        state.sales = [];
      }

      const newSale = action.payload;
      if (!newSale || !newSale._id) return;

      const exists = state.sales.some((s) => s._id === newSale._id);
      if (!exists) {
        state.sales.unshift(newSale);
        if (state.salesPagination) {
          state.salesPagination.total += 1;
        }
      }
    },

    // Set cache timestamp for freshness checking
    setCacheTimestamp(state, action) {
      const { key, timestamp } = action.payload;
      if (!state.cacheTimestamps) {
        state.cacheTimestamps = {};
      }
      state.cacheTimestamps[key] = timestamp;
    },

    forceClearProductLoading(state, action) {
      state.isLoading = false;
      if (action.payload?.error) {
        state.isError = true;
        state.message = action.payload.error;
      }
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(createMultipleProducts.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(createMultipleProducts.fulfilled, (state, action) => {
        state.isLoading = false;
        state.isSuccess = true;
        state.isError = false;
        // console.log(action.payload);
        state.allProductGroups.push(action.payload.data);
        toast.dismiss();
        toast.success("Product Group Created ...");
      })
      .addCase(createMultipleProducts.rejected, (state, action) => {
        state.isLoading = false;
        state.isError = true;
        state.message = action.payload;
        toast.dismiss();
        toast.error(action.payload);
      })
      .addCase(createProduct.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(createProduct.fulfilled, (state, action) => {
        state.isLoading = false;
        state.isSuccess = true;
        state.isError = false;
        // console.log(action.payload);
        state.products.push(action.payload);
        toast.dismiss();
        toast.success("Product added successfully");
      })
      .addCase(createProduct.rejected, (state, action) => {
        state.isLoading = false;
        state.isError = true;
        state.message = action.payload;
        toast.dismiss();
        toast.error(action.payload);
      })
      .addCase(sellProduct.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(sellProduct.fulfilled, (state, action) => {
        state.isLoading = false;
        state.isSuccess = true;
        state.isError = false;
        toast.dismiss();
        toast.success("Product sold out!");
      })
      .addCase(sellProduct.rejected, (state, action) => {
        state.isLoading = false;
        state.isError = true;
        state.message = action.payload;
        toast.dismiss();
        toast.error(action.payload);
      })
      .addCase(getAllProductGroups.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(getAllProductGroups.fulfilled, (state, action) => {
        state.isLoading = false;
        state.isSuccess = true;
        state.isError = false;

        // CRITICAL: Always extract array from response, never store raw payload
        const groupsArray = ensureArray(
          action.payload,
          "products",
          "productGroups",
          "groups",
        );
        state.allProductGroups = groupsArray;

        // Handle pagination metadata if present
        if (
          action.payload &&
          typeof action.payload === "object" &&
          !Array.isArray(action.payload)
        ) {
          state.productGroupsPagination = {
            currentPage: action.payload.currentPage || 1,
            totalPages:
              action.payload.totalPages || Math.ceil(groupsArray.length / 10),
            total: action.payload.total || groupsArray.length,
            hasMore: action.payload.hasMore || false,
          };
          if (action.payload.aggregatedStats) {
            state.productGroupsAggregatedStats = action.payload.aggregatedStats;
          }
        } else {
          state.productGroupsPagination = {
            currentPage: 1,
            totalPages: Math.ceil(groupsArray.length / 10),
            total: groupsArray.length,
            hasMore: false,
          };
        }
      })
      .addCase(getAllProductGroups.rejected, (state, action) => {
        state.isLoading = false;
        state.isError = true;
        state.message = action.payload;
        toast.dismiss();
        toast.error(action.payload);
      })
      .addCase(getProducts.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(getProducts.fulfilled, (state, action) => {
        state.isLoading = false;
        state.isSuccess = true;
        state.isError = false;

        // CRITICAL: Always extract array from response, never store raw payload
        const productsArray = ensureArray(action.payload, "products", "items");
        state.products = productsArray;

        console.log({ productsArray });

        // Handle pagination metadata if present
        if (
          action.payload &&
          typeof action.payload === "object" &&
          !Array.isArray(action.payload)
        ) {
          state.productsPagination = {
            currentPage: action.payload.currentPage || 1,
            totalPages:
              action.payload.totalPages || Math.ceil(productsArray.length / 10),
            total: action.payload.total || productsArray.length,
            hasMore: action.payload.hasMore || false,
          };
          if (action.payload.aggregatedStats) {
            state.productsAggregatedStats = action.payload.aggregatedStats;
          }
        } else {
          state.productsPagination = {
            currentPage: 1,
            totalPages: Math.ceil(productsArray.length / 10),
            total: productsArray.length,
            hasMore: false,
          };
        }
      })
      .addCase(getProducts.rejected, (state, action) => {
        state.isLoading = false;
        state.isError = true;
        state.message = action.payload;
        toast.dismiss();
        toast.error(action.payload);
      })
      .addCase(getFilterOptions.pending, (state) => {
        // No loading state needed for filter options
      })
      .addCase(getFilterOptions.fulfilled, (state, action) => {
        state.filterOptions = action.payload;
      })
      .addCase(getFilterOptions.rejected, (state, action) => {
        console.error("Failed to fetch filter options:", action.payload);
      })
      .addCase(getSalesByYear.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(getSalesByYear.fulfilled, (state, action) => {
        state.isLoading = false;
        state.isSuccess = true;
        state.isError = false;
        state.salesByYear = action.payload;
      })
      .addCase(getSalesByYear.rejected, (state, action) => {
        state.isLoading = false;
        state.isError = true;
        state.message = action.payload;
        toast.dismiss();
        toast.error(action.payload);
      })
      .addCase(getLowProducts.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(getLowProducts.fulfilled, (state, action) => {
        state.isLoading = false;
        state.isSuccess = true;
        state.isError = false;

        // CRITICAL: Always ensure products and productGroups are arrays
        const payload = action.payload || {};

        // Extract products array
        let productsArray = [];
        if (payload.products) {
          productsArray = ensureArray(
            payload.products.data || payload.products,
            "data",
            "items",
          );
        }

        // Extract productGroups array
        let groupsArray = [];
        if (payload.productGroups) {
          groupsArray = ensureArray(
            payload.productGroups.data || payload.productGroups,
            "data",
            "items",
          );
        }

        // CRITICAL: lowProducts must be an object with array properties, never a raw payload
        state.lowProducts = {
          products: productsArray,
          productGroups: groupsArray,
        };

        // Handle pagination metadata
        state.lowProductsPagination = {
          products: {
            currentPage: payload.products?.currentPage || 1,
            totalPages:
              payload.products?.totalPages ||
              Math.ceil(productsArray.length / 10),
            total: payload.products?.total || productsArray.length,
            hasMore: payload.products?.hasMore || false,
          },
          productGroups: {
            currentPage: payload.productGroups?.currentPage || 1,
            totalPages:
              payload.productGroups?.totalPages ||
              Math.ceil(groupsArray.length / 10),
            total: payload.productGroups?.total || groupsArray.length,
            hasMore: payload.productGroups?.hasMore || false,
          },
        };
      })
      .addCase(getLowProducts.rejected, (state, action) => {
        state.isLoading = false;
        state.isError = true;
        state.message = action.payload;
        toast.dismiss();
        toast.error(action.payload);
      })
      .addCase(getTopProducts.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(getTopProducts.fulfilled, (state, action) => {
        state.isLoading = false;
        state.isSuccess = true;
        state.isError = false;

        // CRITICAL: Always ensure products and productGroups are arrays
        const payload = action.payload || {};

        // Extract products array
        let productsArray = [];
        if (payload.products) {
          productsArray = ensureArray(
            payload.products.data || payload.products,
            "data",
            "items",
          );
        }

        // Extract productGroups array
        let groupsArray = [];
        if (payload.productGroups) {
          groupsArray = ensureArray(
            payload.productGroups.data || payload.productGroups,
            "data",
            "items",
          );
        }

        // CRITICAL: topProducts must be an object with array properties, never a raw payload
        state.topProducts = {
          products: productsArray,
          productGroups: groupsArray,
        };

        // Handle pagination metadata
        state.topProductsPagination = {
          products: {
            currentPage: payload.products?.currentPage || 1,
            totalPages:
              payload.products?.totalPages ||
              Math.ceil(productsArray.length / 10),
            total: payload.products?.total || productsArray.length,
            hasMore: payload.products?.hasMore || false,
          },
          productGroups: {
            currentPage: payload.productGroups?.currentPage || 1,
            totalPages:
              payload.productGroups?.totalPages ||
              Math.ceil(groupsArray.length / 10),
            total: payload.productGroups?.total || groupsArray.length,
            hasMore: payload.productGroups?.hasMore || false,
          },
        };
      })
      .addCase(getTopProducts.rejected, (state, action) => {
        state.isLoading = false;
        state.isError = true;
        state.message = action.payload;
        toast.dismiss();
        toast.error(action.payload);
      })
      .addCase(getOutOfStock.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(getOutOfStock.fulfilled, (state, action) => {
        state.isLoading = false;
        state.isSuccess = true;
        state.isError = false;

        // CRITICAL: Always ensure productsOutOfStock and productGroupOutOfStock are arrays
        const payload = action.payload || {};

        // Extract products array - handle both nested data and direct array
        let productsArray = [];
        if (payload.products) {
          if (payload.products.data) {
            productsArray = ensureArray(payload.products.data, "items");
          } else {
            productsArray = ensureArray(payload.products, "data", "items");
          }
        }

        // Extract productGroups array
        let groupsArray = [];
        if (payload.productGroups) {
          if (payload.productGroups.data) {
            groupsArray = ensureArray(payload.productGroups.data, "items");
          } else {
            groupsArray = ensureArray(payload.productGroups, "data", "items");
          }
        }

        state.productsOutOfStock = productsArray;
        state.productGroupOutOfStock = groupsArray;

        // Handle pagination metadata
        state.outOfStockPagination = {
          products: {
            currentPage: payload.products?.currentPage || 1,
            totalPages:
              payload.products?.totalPages ||
              Math.ceil(productsArray.length / 10),
            total: payload.products?.total || productsArray.length,
            hasMore: payload.products?.hasMore || false,
          },
          productGroups: {
            currentPage: payload.productGroups?.currentPage || 1,
            totalPages:
              payload.productGroups?.totalPages ||
              Math.ceil(groupsArray.length / 10),
            total: payload.productGroups?.total || groupsArray.length,
            hasMore: payload.productGroups?.hasMore || false,
          },
        };
      })
      .addCase(getOutOfStock.rejected, (state, action) => {
        state.isLoading = false;
        state.isError = true;
        state.message = action.payload;
        toast.dismiss();
        toast.error(action.payload);
      })
      .addCase(getSales.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(getSales.fulfilled, (state, action) => {
        state.isLoading = false;
        state.isSuccess = true;
        state.isError = false;

        // CRITICAL: Always extract array from response, never store raw payload
        const salesArray = ensureArray(
          action.payload,
          "sales",
          "data",
          "items",
        );
        state.sales = salesArray;

        // Handle pagination metadata if present
        if (
          action.payload &&
          typeof action.payload === "object" &&
          !Array.isArray(action.payload)
        ) {
          state.salesPagination = {
            currentPage: action.payload.currentPage || 1,
            totalPages:
              action.payload.totalPages || Math.ceil(salesArray.length / 10),
            total: action.payload.total || salesArray.length,
            hasMore: action.payload.hasMore || false,
          };
        } else {
          state.salesPagination = {
            currentPage: 1,
            totalPages: Math.ceil(salesArray.length / 10),
            total: salesArray.length,
            hasMore: false,
          };
        }
      })
      .addCase(getSales.rejected, (state, action) => {
        state.isLoading = false;
        state.isError = true;
        state.message = action.payload;
        toast.dismiss();
        toast.error(action.payload);
      })
      .addCase(deleteGroupItem.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(deleteGroupItem.fulfilled, (state, action) => {
        state.isLoading = false;
        state.isSuccess = true;
        state.isError = false;
        toast.dismiss();
        toast.success("Product Group Deleted");
      })
      .addCase(deleteGroupItem.rejected, (state, action) => {
        state.isLoading = false;
        state.isError = true;
        state.message = action.payload;
        toast.dismiss();
        toast.error(action.payload);
      })
      .addCase(deleteProduct.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(deleteProduct.fulfilled, (state, action) => {
        state.isLoading = false;
        state.isSuccess = true;
        state.isError = false;
        toast.dismiss();
        toast.success("Product deleted successfully");
      })
      .addCase(deleteProduct.rejected, (state, action) => {
        state.isLoading = false;
        state.isError = true;
        state.message = action.payload;
        toast.dismiss();
        toast.error(action.payload);
      })
      .addCase(batchDeleteProducts.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(batchDeleteProducts.fulfilled, (state, action) => {
        state.isLoading = false;
        state.isSuccess = true;
        state.isError = false;
        toast.dismiss();
        toast.success(action.payload.message || "Products deleted successfully");
      })
      .addCase(batchDeleteProducts.rejected, (state, action) => {
        state.isLoading = false;
        state.isError = true;
        state.message = action.payload;
        toast.dismiss();
        toast.error(action.payload);
      })
      .addCase(batchDeleteProductGroups.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(batchDeleteProductGroups.fulfilled, (state, action) => {
        state.isLoading = false;
        state.isSuccess = true;
        state.isError = false;
        toast.dismiss();
        const message = `Deleted ${action.payload.groupCount} group(s) and ${action.payload.variantCount} variant(s) successfully`;
        toast.success(message);
      })
      .addCase(batchDeleteProductGroups.rejected, (state, action) => {
        state.isLoading = false;
        state.isError = true;
        state.message = action.payload;
        toast.dismiss();
        toast.error(action.payload);
      })
      .addCase(batchToggleProducts.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(batchToggleProducts.fulfilled, (state, action) => {
        state.isLoading = false;
        state.isSuccess = true;
        state.isError = false;
        toast.dismiss();
        toast.success(action.payload.message || "Products updated successfully");
      })
      .addCase(batchToggleProducts.rejected, (state, action) => {
        state.isLoading = false;
        state.isError = true;
        state.message = action.payload;
        toast.dismiss();
        toast.error(action.payload);
      })
      .addCase(updateGroupListingOptions.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(updateGroupListingOptions.fulfilled, (state) => {
        state.isLoading = false;
        state.isSuccess = true;
        state.isError = false;
      })
      .addCase(updateGroupListingOptions.rejected, (state, action) => {
        state.isLoading = false;
        state.isError = true;
        state.message = action.payload;
      })
      .addCase(getProduct.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(getProduct.fulfilled, (state, action) => {
        state.isLoading = false;
        state.isSuccess = true;
        state.isError = false;
        state.product = action.payload;
      })
      .addCase(getProduct.rejected, (state, action) => {
        state.isLoading = false;
        state.isError = true;
        state.message = action.payload;
        toast.dismiss();
        toast.error(action.payload);
      })
      .addCase(getSale.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(getSale.fulfilled, (state, action) => {
        state.isLoading = false;
        state.isSuccess = true;
        state.isError = false;
        state.sale = action.payload;
      })
      .addCase(getSale.rejected, (state, action) => {
        state.isLoading = false;
        state.isError = true;
        state.message = action.payload;
        toast.dismiss();
        toast.error(action.payload);
      })
      .addCase(updateProduct.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(updateProduct.fulfilled, (state, action) => {
        state.isLoading = false;
        state.isSuccess = true;
        state.isError = false;
        toast.dismiss();
        toast.success("Product updated successfully");
      })
      .addCase(updateProduct.rejected, (state, action) => {
        state.isLoading = false;
        state.isError = true;
        state.message = action.payload;
        toast.dismiss();
        toast.error(action.payload);
      })
      .addCase(updateProductGroup.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(updateProductGroup.fulfilled, (state, action) => {
        state.isLoading = false;
        state.isSuccess = true;
        state.isError = false;
        toast.dismiss();
        toast.success("Product updated successfully");
      })
      .addCase(updateProductGroup.rejected, (state, action) => {
        state.isLoading = false;
        state.isError = true;
        state.message = action.payload;
        toast.dismiss();
        toast.error(action.payload);
      })
      .addCase(saveDraft.pending, (state) => {
        state.savingDraftStatus = "saving draft";
      })
      .addCase(saveDraft.fulfilled, (state, action) => {
        state.isSuccess = true;
        state.isError = false;
        state.savingDraftStatus = "saved draft";
        state.draft = action.payload;
      })
      .addCase(saveDraft.rejected, (state, action) => {
        state.isError = true;
        state.message = action.payload;
        state.savingDraftStatus = "error saving draft";
      })
      .addCase(getDraft.pending, (state) => {
        state.message = "pending";
      })
      .addCase(getDraft.fulfilled, (state, action) => {
        state.isSuccess = true;
        state.isError = false;
        state.draft = action.payload;
      })
      .addCase(getDraft.rejected, (state, action) => {
        state.isError = true;
        state.message = action.payload;
        state.draft = null;
      })
      .addCase(getDashboardStats.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(getDashboardStats.fulfilled, (state, action) => {
        state.isLoading = false;
        state.isSuccess = true;
        state.isError = false;
        state.dashboardStats = action.payload;
      })
      .addCase(getDashboardStats.rejected, (state, action) => {
        state.isLoading = false;
        state.isError = true;
        state.message = action.payload;
      });
  },
});

export const {
  setDashboardStats,
  CALC_STORE_VALUE_BY_PRICE,
  CALC_STORE_VALUE_BY_COST,
  CALC_OUTOFSTOCK_SINGLE_PRODUCTS,
  CALC_OUTOFSTOCK_GROUP_PRODUCTS,
  CALC_CATEGORY,
  CALC_PROFIT_VALUE,
  CALC_SOLD_VALUE,
  forceClearProductLoading,
} = productSlice.actions;

export const selectIsLoading = (state) => state.product.isLoading;
export const selectProduct = (state) => state.product.product;
export const selectFilterOptions = (state) => state.product.filterOptions;
export const selectTotalStoreValueByPrice = (state) =>
  state.product.totalStoreValueByPrice;
export const selectTotalStoreValueByCost = (state) =>
  state.product.totalStoreValueByCost;
export const selectOutOfStockSingleProducts = (state) =>
  state.product.outOfStockSingleProducts;
export const selectOutOfStockGroupProducts = (state) =>
  state.product.outOfStockGroupProducts;
export const selectCategory = (state) => state.product.category;
export const selectTotalSales = (state) => state.product.totalSalesValue;
export const selectTotalProfit = (state) => state.product.totalProfitValue;
export const selectDraft = (state) => state.product.draft;
export const selectSavedStatus = (state) => state.product.savingDraftStatus;
export const selectDashboardStats = (state) => state.product.dashboardStats;

export default productSlice.reducer;
