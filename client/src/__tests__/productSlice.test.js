import productReducer, {
  getProducts,
  getFilterOptions,
  getAllProductGroups,
  getOutOfStock,
  getSales,
  selectFilterOptions,
} from "../redux/features/product/productSlice";
import productService from "../redux/features/product/productService";

jest.mock("../redux/features/product/productService");
jest.mock("sonner", () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
    dismiss: jest.fn(),
  },
}));

describe("Product Slice", () => {
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
    salesPagination: {
      currentPage: 1,
      totalPages: 1,
      total: 0,
      hasMore: false,
    },
    outOfStockPagination: {
      products: { currentPage: 1, totalPages: 1, total: 0, hasMore: false },
      productGroups: {
        currentPage: 1,
        totalPages: 1,
        total: 0,
        hasMore: false,
      },
    },
    topProductsPagination: {
      products: { currentPage: 1, totalPages: 1, total: 0, hasMore: false },
      productGroups: {
        currentPage: 1,
        totalPages: 1,
        total: 0,
        hasMore: false,
      },
    },
    lowProductsPagination: {
      products: { currentPage: 1, totalPages: 1, total: 0, hasMore: false },
      productGroups: {
        currentPage: 1,
        totalPages: 1,
        total: 0,
        hasMore: false,
      },
    },
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

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("getProducts thunk", () => {
    it("should handle getProducts.pending", () => {
      const action = { type: getProducts.pending.type };
      const state = productReducer(initialState, action);
      expect(state.isLoading).toBe(true);
    });

    it("should handle getProducts.fulfilled without filters", () => {
      const mockData = {
        products: [
          { _id: "1", name: "Product 1", price: 100 },
          { _id: "2", name: "Product 2", price: 200 },
        ],
        currentPage: 1,
        totalPages: 2,
        total: 10,
        hasMore: true,
        aggregatedStats: {
          totalValue: 1000,
          totalCost: 800,
          totalQuantity: 50,
          totalProducts: 10,
        },
      };

      const action = {
        type: getProducts.fulfilled.type,
        payload: mockData,
      };

      const state = productReducer(initialState, action);

      expect(state.isLoading).toBe(false);
      expect(state.isSuccess).toBe(true);
      expect(state.products).toEqual(mockData.products);
      expect(state.productsPagination.currentPage).toBe(1);
      expect(state.productsPagination.totalPages).toBe(2);
      expect(state.productsPagination.total).toBe(10);
      expect(state.productsPagination.hasMore).toBe(true);
      expect(state.productsAggregatedStats).toEqual(mockData.aggregatedStats);
    });

    it("should handle getProducts.rejected", () => {
      const action = {
        type: getProducts.rejected.type,
        payload: "Error fetching products",
      };

      const state = productReducer(initialState, action);

      expect(state.isLoading).toBe(false);
      expect(state.isError).toBe(true);
      expect(state.message).toBe("Error fetching products");
    });
  });

  describe("getFilterOptions thunk", () => {
    it("should handle getFilterOptions.fulfilled", () => {
      const mockData = {
        categories: ["Electronics", "Furniture", "Clothing"],
        warehouses: ["Main Warehouse", "Storage A", "Storage B"],
      };

      const action = {
        type: getFilterOptions.fulfilled.type,
        payload: mockData,
      };

      const state = productReducer(initialState, action);

      expect(state.filterOptions.categories).toEqual(mockData.categories);
      expect(state.filterOptions.warehouses).toEqual(mockData.warehouses);
    });
  });

  describe("getAllProductGroups thunk", () => {
    it("should handle getAllProductGroups.fulfilled with filters", () => {
      const mockData = {
        products: [
          { _id: "1", groupName: "Group 1", category: "Electronics" },
          { _id: "2", groupName: "Group 2", category: "Electronics" },
        ],
        currentPage: 1,
        totalPages: 1,
        total: 2,
        hasMore: false,
        aggregatedStats: {
          totalValue: 500,
          totalCost: 400,
          totalVariants: 10,
          totalGroups: 2,
        },
      };

      const action = {
        type: getAllProductGroups.fulfilled.type,
        payload: mockData,
      };

      const state = productReducer(initialState, action);

      expect(state.isLoading).toBe(false);
      expect(state.allProductGroups).toEqual(mockData.products);
      expect(state.productGroupsPagination.currentPage).toBe(1);
      expect(state.productGroupsAggregatedStats).toEqual(
        mockData.aggregatedStats
      );
    });
  });

  describe("getOutOfStock thunk", () => {
    it("should handle getOutOfStock.fulfilled", () => {
      const mockData = {
        products: [{ _id: "1", name: "Product 1", quantity: 0 }],
        productGroups: [{ _id: "2", groupName: "Group 1", combinations: [] }],
        outOfStockPagination: {
          products: { currentPage: 1, totalPages: 1, total: 1, hasMore: false },
          productGroups: {
            currentPage: 1,
            totalPages: 1,
            total: 1,
            hasMore: false,
          },
        },
      };

      const action = {
        type: getOutOfStock.fulfilled.type,
        payload: mockData,
      };

      const state = productReducer(initialState, action);

      expect(state.isLoading).toBe(false);
      expect(state.productsOutOfStock).toEqual(mockData.products);
      expect(state.productGroupOutOfStock).toEqual(mockData.productGroups);
    });
  });

  describe("getSales thunk", () => {
    it("should handle getSales.fulfilled with search", () => {
      const mockData = {
        sales: [
          { _id: "1", customer: "John Doe", products: [{ name: "Laptop" }] },
          { _id: "2", customer: "Jane Smith", products: [{ name: "Phone" }] },
        ],
        currentPage: 1,
        totalPages: 1,
        total: 2,
        hasMore: false,
      };

      const action = {
        type: getSales.fulfilled.type,
        payload: mockData,
      };

      const state = productReducer(initialState, action);

      expect(state.isLoading).toBe(false);
      expect(state.sales).toEqual(mockData.sales);
      expect(state.salesPagination.currentPage).toBe(1);
      expect(state.salesPagination.total).toBe(2);
    });
  });

  describe("selectFilterOptions selector", () => {
    it("should select filter options from state", () => {
      const mockState = {
        product: {
          ...initialState,
          filterOptions: {
            categories: ["Electronics", "Furniture"],
            warehouses: ["Main", "Secondary"],
          },
        },
      };

      const result = selectFilterOptions(mockState);

      expect(result).toEqual({
        categories: ["Electronics", "Furniture"],
        warehouses: ["Main", "Secondary"],
      });
    });

    it("should return empty arrays if no filter options", () => {
      const mockState = {
        product: initialState,
      };

      const result = selectFilterOptions(mockState);

      expect(result.categories).toEqual([]);
      expect(result.warehouses).toEqual([]);
    });
  });

  describe("Integration: Multiple filters", () => {
    it("should handle products with multiple filters applied", async () => {
      const mockFilteredData = {
        products: [
          {
            _id: "1",
            name: "Laptop",
            category: "Electronics",
            warehouse: "Main",
            price: 1000,
          },
        ],
        currentPage: 1,
        totalPages: 1,
        total: 1,
        hasMore: false,
        aggregatedStats: {
          totalValue: 1000,
          totalCost: 800,
          totalQuantity: 1,
          totalProducts: 1,
        },
      };

      productService.getProducts.mockResolvedValue(mockFilteredData);

      const dispatch = jest.fn();
      const thunk = getProducts({
        page: 1,
        limit: 10,
        search: "laptop",
        category: ["Electronics"],
        warehouse: ["Main"],
        priceRange: ["100-500"],
      });

      await thunk(dispatch, () => ({}), undefined);

      expect(productService.getProducts).toHaveBeenCalledWith({
        page: 1,
        limit: 10,
        search: "laptop",
        category: ["Electronics"],
        warehouse: ["Main"],
        priceRange: ["100-500"],
      });
    });
  });
});
