import productService from "../redux/features/product/productService";
import axios from "axios";

jest.mock("axios");

describe("Product Service", () => {
  const API_URL = "/api/products/";

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("getProducts", () => {
    it("should fetch products without filters", async () => {
      const mockResponse = {
        data: {
          products: [{ _id: "1", name: "Product 1" }],
          currentPage: 1,
          totalPages: 1,
          total: 1,
        },
      };

      axios.get.mockResolvedValue(mockResponse);

      const result = await productService.getProducts({
        page: 1,
        limit: 10,
      });

      expect(axios.get).toHaveBeenCalledWith(
        expect.stringContaining(`${API_URL}?page=1&limit=10`)
      );
      expect(result).toEqual(mockResponse.data);
    });

    it("should fetch products with search", async () => {
      const mockResponse = {
        data: {
          products: [{ _id: "1", name: "Laptop" }],
          currentPage: 1,
          totalPages: 1,
          total: 1,
        },
      };

      axios.get.mockResolvedValue(mockResponse);

      await productService.getProducts({
        page: 1,
        limit: 10,
        search: "laptop",
      });

      expect(axios.get).toHaveBeenCalledWith(
        expect.stringContaining("search=laptop")
      );
    });

    it("should fetch products with category filter", async () => {
      const mockResponse = {
        data: {
          products: [{ _id: "1", name: "Laptop", category: "Electronics" }],
          currentPage: 1,
          totalPages: 1,
          total: 1,
        },
      };

      axios.get.mockResolvedValue(mockResponse);

      await productService.getProducts({
        page: 1,
        limit: 10,
        category: ["Electronics"],
      });

      expect(axios.get).toHaveBeenCalledWith(
        expect.stringContaining("category=Electronics")
      );
    });

    it("should fetch products with warehouse filter", async () => {
      const mockResponse = {
        data: {
          products: [{ _id: "1", name: "Product 1", warehouse: "Main" }],
          currentPage: 1,
          totalPages: 1,
          total: 1,
        },
      };

      axios.get.mockResolvedValue(mockResponse);

      await productService.getProducts({
        page: 1,
        limit: 10,
        warehouse: ["Main", "Secondary"],
      });

      expect(axios.get).toHaveBeenCalledWith(
        expect.stringContaining("warehouse=Main%2CSecondary")
      );
    });

    it("should fetch products with price range filter", async () => {
      const mockResponse = {
        data: {
          products: [{ _id: "1", name: "Product 1", price: 150 }],
          currentPage: 1,
          totalPages: 1,
          total: 1,
        },
      };

      axios.get.mockResolvedValue(mockResponse);

      await productService.getProducts({
        page: 1,
        limit: 10,
        priceRange: ["100-500"],
      });

      expect(axios.get).toHaveBeenCalledWith(
        expect.stringContaining("priceRange=100-500")
      );
    });

    it("should fetch products with multiple filters", async () => {
      const mockResponse = {
        data: {
          products: [{ _id: "1", name: "Laptop" }],
          currentPage: 1,
          totalPages: 1,
          total: 1,
        },
      };

      axios.get.mockResolvedValue(mockResponse);

      await productService.getProducts({
        page: 1,
        limit: 10,
        search: "laptop",
        category: ["Electronics"],
        warehouse: ["Main"],
        priceRange: ["100-500"],
      });

      const callUrl = axios.get.mock.calls[0][0];
      expect(callUrl).toContain("search=laptop");
      expect(callUrl).toContain("category=Electronics");
      expect(callUrl).toContain("warehouse=Main");
      expect(callUrl).toContain("priceRange=100-500");
    });

    it("should handle API errors", async () => {
      const mockError = {
        response: {
          data: { message: "Server error" },
        },
      };

      axios.get.mockRejectedValue(mockError);

      await expect(
        productService.getProducts({ page: 1, limit: 10 })
      ).rejects.toEqual(mockError);
    });
  });

  describe("getFilterOptions", () => {
    it("should fetch all filter options", async () => {
      const mockResponse = {
        data: {
          categories: ["Electronics", "Furniture", "Clothing"],
          warehouses: ["Main", "Secondary", "Storage"],
        },
      };

      axios.get.mockResolvedValue(mockResponse);

      const result = await productService.getFilterOptions();

      expect(axios.get).toHaveBeenCalledWith(`${API_URL}filter-options`);
      expect(result).toEqual(mockResponse.data);
    });

    it("should handle empty filter options", async () => {
      const mockResponse = {
        data: {
          categories: [],
          warehouses: [],
        },
      };

      axios.get.mockResolvedValue(mockResponse);

      const result = await productService.getFilterOptions();

      expect(result).toEqual(mockResponse.data);
      expect(result.categories).toHaveLength(0);
      expect(result.warehouses).toHaveLength(0);
    });
  });

  describe("getProductGroups", () => {
    it("should fetch product groups with filters", async () => {
      const mockResponse = {
        data: {
          products: [{ _id: "1", groupName: "Combo 1" }],
          currentPage: 1,
          totalPages: 1,
          total: 1,
        },
      };

      axios.get.mockResolvedValue(mockResponse);

      await productService.getProductGroups({
        page: 1,
        limit: 10,
        search: "combo",
        category: ["Electronics"],
        warehouse: ["Main"],
      });

      const callUrl = axios.get.mock.calls[0][0];
      expect(callUrl).toContain("product-group");
      expect(callUrl).toContain("search=combo");
      expect(callUrl).toContain("category=Electronics");
      expect(callUrl).toContain("warehouse=Main");
    });
  });

  describe("getOutOfStock", () => {
    it("should fetch out of stock items with filters", async () => {
      const mockResponse = {
        data: {
          products: [{ _id: "1", name: "Product 1", quantity: 0 }],
          productGroups: [],
          outOfStockPagination: {
            products: { currentPage: 1, totalPages: 1 },
            productGroups: { currentPage: 1, totalPages: 1 },
          },
        },
      };

      axios.get.mockResolvedValue(mockResponse);

      await productService.getOutOfStock({
        page: 1,
        limit: 10,
        search: "laptop",
        category: ["Electronics"],
        warehouse: ["Main"],
      });

      const callUrl = axios.get.mock.calls[0][0];
      expect(callUrl).toContain("outofstock");
      expect(callUrl).toContain("search=laptop");
      expect(callUrl).toContain("category=Electronics");
      expect(callUrl).toContain("warehouse=Main");
    });
  });

  describe("getSales", () => {
    it("should fetch sales with search", async () => {
      const mockResponse = {
        data: {
          sales: [{ _id: "1", products: [{ name: "Laptop" }] }],
          currentPage: 1,
          totalPages: 1,
          total: 1,
        },
      };

      axios.get.mockResolvedValue(mockResponse);

      await productService.getSales("7d", 1, 10, "laptop");

      const callUrl = axios.get.mock.calls[0][0];
      expect(callUrl).toContain("getsales");
      expect(callUrl).toContain("query=7d");
      expect(callUrl).toContain("search=laptop");
    });

    it("should fetch sales without search", async () => {
      const mockResponse = {
        data: {
          sales: [{ _id: "1" }],
          currentPage: 1,
          totalPages: 1,
          total: 1,
        },
      };

      axios.get.mockResolvedValue(mockResponse);

      await productService.getSales("30d", 1, 10, "");

      const callUrl = axios.get.mock.calls[0][0];
      expect(callUrl).toContain("query=30d");
      expect(callUrl).not.toContain("search=");
    });
  });

  describe("createProduct", () => {
    it("should create a product", async () => {
      const mockProduct = {
        name: "New Product",
        category: "Electronics",
        price: 100,
      };

      const mockResponse = {
        data: { _id: "newId", ...mockProduct },
      };

      axios.post.mockResolvedValue(mockResponse);

      const result = await productService.createProduct(mockProduct);

      expect(axios.post).toHaveBeenCalledWith(API_URL, mockProduct);
      expect(result).toEqual(mockResponse.data);
    });
  });

  describe("updateProduct", () => {
    it("should update a product", async () => {
      const productId = "product123";
      const updateData = { name: "Updated Name", price: 150 };

      const mockResponse = {
        data: { _id: productId, ...updateData },
      };

      axios.patch.mockResolvedValue(mockResponse);

      const result = await productService.updateProduct(productId, updateData);

      expect(axios.patch).toHaveBeenCalledWith(
        `${API_URL}${productId}`,
        updateData
      );
      expect(result).toEqual(mockResponse.data);
    });
  });

  describe("deleteProduct", () => {
    it("should delete a product", async () => {
      const productId = "product123";

      const mockResponse = {
        data: { message: "Product deleted successfully" },
      };

      axios.delete.mockResolvedValue(mockResponse);

      const result = await productService.deleteProduct(productId);

      expect(axios.delete).toHaveBeenCalledWith(API_URL + productId);
      expect(result).toEqual(mockResponse.data);
    });
  });

  describe("getProduct", () => {
    it("should fetch a single product", async () => {
      const productId = "product123";
      const mockProduct = {
        _id: productId,
        name: "Test Product",
        category: "Electronics",
      };

      const mockResponse = {
        data: mockProduct,
      };

      axios.get.mockResolvedValue(mockResponse);

      const result = await productService.getProduct(productId);

      expect(axios.get).toHaveBeenCalledWith(API_URL + productId);
      expect(result).toEqual(mockProduct);
    });
  });
});
