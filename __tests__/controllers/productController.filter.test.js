const Product = require("../../models/productModel");
const ProductGroup = require("../../models/productGroupModel");
const Sales = require("../../models/salesModel");
const { mockRequest, mockResponse } = require("../helpers/testHelpers");
const {
  getFilterOptions,
  getProducts,
  getProductGroups,
  getOutOfStock,
  getSales,
} = require("../../controllers/productController");

jest.mock("../../models/productModel");
jest.mock("../../models/productGroupModel");
jest.mock("../../models/salesModel");

describe("Product Controller - Filtering Tests", () => {
  let mockBusiness;

  beforeEach(() => {
    mockBusiness = {
      _id: "business123",
      id: "business123",
      businessName: "Test Business",
    };
    jest.clearAllMocks();
  });

  describe("getFilterOptions", () => {
    it("should return all unique categories and warehouses", async () => {
      const mockCategories = ["Electronics", "Furniture", "Clothing"];
      const mockWarehouses = ["Warehouse A", "Warehouse B", "Main Storage"];

      Product.distinct = jest
        .fn()
        .mockResolvedValueOnce(mockCategories)
        .mockResolvedValueOnce(mockWarehouses);

      const req = mockRequest({}, {}, {}, null, mockBusiness);
      const res = mockResponse();

      await getFilterOptions(req, res);

      expect(Product.distinct).toHaveBeenCalledWith("category", {
        business: mockBusiness.id,
        category: { $exists: true, $ne: null, $ne: "" },
      });
      expect(Product.distinct).toHaveBeenCalledWith("warehouse", {
        business: mockBusiness.id,
        warehouse: { $exists: true, $ne: null, $ne: "" },
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        categories: mockCategories.sort(),
        warehouses: mockWarehouses.sort(),
      });
    });

    it("should filter out null and empty values", async () => {
      const mockCategories = ["Electronics", null, "", "Furniture"];
      const mockWarehouses = ["Warehouse A", null, ""];

      Product.distinct = jest
        .fn()
        .mockResolvedValueOnce(mockCategories)
        .mockResolvedValueOnce(mockWarehouses);

      const req = mockRequest({}, {}, {}, null, mockBusiness);
      const res = mockResponse();

      await getFilterOptions(req, res);

      expect(res.json).toHaveBeenCalledWith({
        categories: ["Electronics", "Furniture"],
        warehouses: ["Warehouse A"],
      });
    });
  });

  describe("getProducts with filters", () => {
    beforeEach(() => {
      const mockChain = {
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([]),
        select: jest.fn().mockResolvedValue([]),
      };
      Product.find = jest.fn(() => mockChain);
      Product.countDocuments = jest.fn().mockResolvedValue(0);
    });

    it("should filter products by category", async () => {
      const mockProducts = [
        {
          _id: "product1",
          name: "Laptop",
          category: "Electronics",
          warehouse: "Main",
          price: 1000,
          cost: 800,
          quantity: 5,
        },
      ];

      const mockChain = {
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue(mockProducts),
        select: jest.fn().mockResolvedValue(mockProducts),
      };

      Product.find = jest.fn(() => mockChain);
      Product.countDocuments = jest.fn().mockResolvedValue(1);

      const req = mockRequest(
        {},
        {},
        { page: "1", limit: "10", category: "Electronics" },
        null,
        mockBusiness
      );
      const res = mockResponse();

      await getProducts(req, res);

      expect(Product.find).toHaveBeenCalledWith(
        expect.objectContaining({
          business: mockBusiness.id,
          category: { $in: ["Electronics"] },
        })
      );
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it("should filter products by warehouse", async () => {
      const req = mockRequest(
        {},
        {},
        { page: "1", limit: "10", warehouse: "Main,Secondary" },
        null,
        mockBusiness
      );
      const res = mockResponse();

      await getProducts(req, res);

      expect(Product.find).toHaveBeenCalledWith(
        expect.objectContaining({
          business: mockBusiness.id,
          warehouse: { $in: ["Main", "Secondary"] },
        })
      );
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it("should filter products by price range", async () => {
      const req = mockRequest(
        {},
        {},
        { page: "1", limit: "10", priceRange: "100-500" },
        null,
        mockBusiness
      );
      const res = mockResponse();

      await getProducts(req, res);

      expect(Product.find).toHaveBeenCalledWith(
        expect.objectContaining({
          business: mockBusiness.id,
          $and: [
            {
              $or: [{ price: { $gte: 100, $lte: 500 } }],
            },
          ],
        })
      );
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it("should filter products by search term", async () => {
      const req = mockRequest(
        {},
        {},
        { page: "1", limit: "10", search: "laptop" },
        null,
        mockBusiness
      );
      const res = mockResponse();

      await getProducts(req, res);

      expect(Product.find).toHaveBeenCalledWith(
        expect.objectContaining({
          business: mockBusiness.id,
          $or: expect.arrayContaining([
            { name: { $regex: "laptop", $options: "i" } },
            { category: { $regex: "laptop", $options: "i" } },
            { sku: { $regex: "laptop", $options: "i" } },
            { warehouse: { $regex: "laptop", $options: "i" } },
          ]),
        })
      );
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it("should apply multiple filters simultaneously", async () => {
      const req = mockRequest(
        {},
        {},
        {
          page: "1",
          limit: "10",
          search: "laptop",
          category: "Electronics",
          warehouse: "Main",
          priceRange: "100-500",
        },
        null,
        mockBusiness
      );
      const res = mockResponse();

      await getProducts(req, res);

      expect(Product.find).toHaveBeenCalledWith(
        expect.objectContaining({
          business: mockBusiness.id,
          category: { $in: ["Electronics"] },
          warehouse: { $in: ["Main"] },
          $or: expect.any(Array),
          $and: expect.any(Array),
        })
      );
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it("should return aggregated stats for filtered products", async () => {
      const mockProducts = [
        {
          _id: "p1",
          name: "Product 1",
          price: 100,
          cost: 80,
          quantity: 5,
        },
        {
          _id: "p2",
          name: "Product 2",
          price: 200,
          cost: 150,
          quantity: 3,
        },
      ];

      const mockChain = {
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue(mockProducts),
        select: jest.fn().mockResolvedValue(mockProducts),
      };

      Product.find = jest.fn(() => mockChain);
      Product.countDocuments = jest.fn().mockResolvedValue(2);

      const req = mockRequest(
        {},
        {},
        { page: "1", limit: "10" },
        null,
        mockBusiness
      );
      const res = mockResponse();

      await getProducts(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          products: expect.arrayContaining([
            expect.objectContaining(mockProducts[0]),
            expect.objectContaining(mockProducts[1]),
          ]),
          aggregatedStats: expect.objectContaining({
            totalValue: expect.any(Number),
            totalCost: expect.any(Number),
            totalQuantity: expect.any(Number),
            totalProducts: 2,
          }),
        })
      );
    });
  });

  describe("getProductGroups with filters", () => {
    beforeEach(() => {
      const mockChain = {
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([]),
        select: jest.fn().mockResolvedValue([]),
      };
      ProductGroup.find = jest.fn(() => mockChain);
      ProductGroup.countDocuments = jest.fn().mockResolvedValue(0);
    });

    it("should filter product groups by category", async () => {
      const req = mockRequest(
        {},
        {},
        { page: "1", limit: "10", category: "Electronics" },
        null,
        mockBusiness
      );
      const res = mockResponse();

      await getProductGroups(req, res);

      expect(ProductGroup.find).toHaveBeenCalledWith(
        expect.objectContaining({
          business: mockBusiness.id,
          category: { $in: ["Electronics"] },
        })
      );
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it("should filter product groups by warehouse array", async () => {
      const req = mockRequest(
        {},
        {},
        { page: "1", limit: "10", warehouse: "Main,Secondary" },
        null,
        mockBusiness
      );
      const res = mockResponse();

      await getProductGroups(req, res);

      expect(ProductGroup.find).toHaveBeenCalledWith(
        expect.objectContaining({
          business: mockBusiness.id,
          warehouse: { $elemMatch: { $in: ["Main", "Secondary"] } },
        })
      );
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it("should search product groups by name or category", async () => {
      const req = mockRequest(
        {},
        {},
        { page: "1", limit: "10", search: "combo" },
        null,
        mockBusiness
      );
      const res = mockResponse();

      await getProductGroups(req, res);

      expect(ProductGroup.find).toHaveBeenCalledWith(
        expect.objectContaining({
          business: mockBusiness.id,
          $or: expect.arrayContaining([
            { groupName: { $regex: "combo", $options: "i" } },
            { category: { $regex: "combo", $options: "i" } },
            { description: { $regex: "combo", $options: "i" } },
          ]),
        })
      );
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe("getOutOfStock with filters", () => {
    beforeEach(() => {
      const mockChain = {
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([]),
      };
      Product.find = jest.fn(() => mockChain);
      ProductGroup.find = jest.fn(() => mockChain);
      Product.countDocuments = jest.fn().mockResolvedValue(0);
      ProductGroup.countDocuments = jest.fn().mockResolvedValue(0);
    });

    it("should get out of stock products with category filter", async () => {
      const req = mockRequest(
        {},
        {},
        { page: "1", limit: "10", category: "Electronics" },
        null,
        mockBusiness
      );
      const res = mockResponse();

      await getOutOfStock(req, res);

      expect(Product.find).toHaveBeenCalledWith(
        expect.objectContaining({
          quantity: 0,
          business: mockBusiness.id,
          category: { $in: ["Electronics"] },
        })
      );
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it("should get out of stock products with warehouse filter", async () => {
      const req = mockRequest(
        {},
        {},
        { page: "1", limit: "10", warehouse: "Main" },
        null,
        mockBusiness
      );
      const res = mockResponse();

      await getOutOfStock(req, res);

      expect(Product.find).toHaveBeenCalledWith(
        expect.objectContaining({
          quantity: 0,
          business: mockBusiness.id,
          warehouse: { $in: ["Main"] },
        })
      );
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it("should search out of stock products", async () => {
      const req = mockRequest(
        {},
        {},
        { page: "1", limit: "10", search: "laptop" },
        null,
        mockBusiness
      );
      const res = mockResponse();

      await getOutOfStock(req, res);

      expect(Product.find).toHaveBeenCalledWith(
        expect.objectContaining({
          quantity: 0,
          business: mockBusiness.id,
          $or: expect.arrayContaining([
            { name: { $regex: "laptop", $options: "i" } },
            { category: { $regex: "laptop", $options: "i" } },
            { sku: { $regex: "laptop", $options: "i" } },
          ]),
        })
      );
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe("getSales with search", () => {
    beforeEach(() => {
      const mockChain = {
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([]),
      };
      Sales.find = jest.fn(() => mockChain);
      Sales.countDocuments = jest.fn().mockResolvedValue(0);
    });

    it("should get sales within date range", async () => {
      const req = mockRequest(
        {},
        {},
        { query: "7d", page: "1", limit: "10" },
        null,
        mockBusiness
      );
      const res = mockResponse();

      await getSales(req, res);

      expect(Sales.find).toHaveBeenCalledWith(
        expect.objectContaining({
          business: mockBusiness.id,
          createdAt: expect.objectContaining({
            $gte: expect.any(Date),
            $lt: expect.any(Date),
          }),
        })
      );
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it("should search sales by product name", async () => {
      const req = mockRequest(
        {},
        {},
        { query: "7d", page: "1", limit: "10", search: "laptop" },
        null,
        mockBusiness
      );
      const res = mockResponse();

      await getSales(req, res);

      expect(Sales.find).toHaveBeenCalledWith(
        expect.objectContaining({
          business: mockBusiness.id,
          $or: expect.arrayContaining([
            { "products.name": { $regex: "laptop", $options: "i" } },
            { customer: { $regex: "laptop", $options: "i" } },
            { paymentMethod: { $regex: "laptop", $options: "i" } },
          ]),
        })
      );
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it("should search sales by customer name", async () => {
      const req = mockRequest(
        {},
        {},
        { query: "30d", page: "1", limit: "10", search: "John Doe" },
        null,
        mockBusiness
      );
      const res = mockResponse();

      await getSales(req, res);

      expect(Sales.find).toHaveBeenCalledWith(
        expect.objectContaining({
          $or: expect.arrayContaining([
            { customer: { $regex: "John Doe", $options: "i" } },
          ]),
        })
      );
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });
});
