const Product = require("../../models/productModel");
const {
  mockRequest,
  mockResponse,
  mockProductData,
} = require("../helpers/testHelpers");
const {
  createProduct,
  getProducts,
  getProduct,
  deleteProduct,
  updateProduct,
} = require("../../controllers/productController");
const { uploadImageToS3 } = require("../../utils/fileDownload");

jest.mock("../../utils/fileDownload", () => ({
  uploadImageToS3: jest.fn(),
}));

// Mock the Product model
jest.mock("../../models/productModel");

describe("Product Controller Tests", () => {
  let mockBusiness;

  beforeEach(() => {
    mockBusiness = {
      _id: "business123",
      id: "business123",
      businessName: "Test Business",
    };
    jest.clearAllMocks();

    // Setup default mock implementations with full chain
    const mockChain = {
      sort: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue([]),
      select: jest.fn().mockResolvedValue([]),
    };

    Product.find = jest.fn(() => mockChain);
    Product.findById = jest.fn().mockResolvedValue(null);
    Product.findByIdAndUpdate = jest.fn().mockResolvedValue(null);
    Product.findByIdAndDelete = jest.fn().mockResolvedValue(null);
    Product.countDocuments = jest.fn().mockResolvedValue(0);
    Product.create = jest.fn();
  });

  describe("createProduct", () => {
    it("should create a product successfully", async () => {
      const mockProduct = {
        _id: "product123",
        name: "Test Product",
        sku: "TEST-001",
        category: "Electronics",
        quantity: 10,
        cost: 50,
        price: 100,
        description: "Test product description",
        warehouse: "Main Warehouse",
        business: mockBusiness._id,
      };

      Product.create.mockResolvedValue(mockProduct);

      const req = mockRequest(
        {
          name: "Test Product",
          sku: "TEST-001",
          category: "Electronics",
          quantity: 10,
          cost: 50,
          price: 100,
          description: "Test product description",
          warehouse: "Main Warehouse",
        },
        {},
        {},
        null,
        mockBusiness
      );

      const res = mockResponse();

      await createProduct(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(mockProduct);
      expect(Product.create).toHaveBeenCalled();
    });

    it("should fail if required fields are missing", async () => {
      const req = mockRequest(
        { name: "Test Product" }, // Missing required fields
        {},
        {},
        null,
        mockBusiness
      );

      const res = mockResponse();

      await expect(createProduct(req, res)).rejects.toThrow(
        "Please fill in all fields"
      );
    });

    it("should upload image if file is provided", async () => {
      uploadImageToS3.mockResolvedValue({
        Location: "https://s3.amazonaws.com/test-product.jpg",
      });

      const req = mockRequest(
        {
          name: "Test Product",
          sku: "TEST-001",
          category: "Electronics",
          quantity: 10,
          cost: 50,
          price: 100,
          description: "Test description",
          warehouse: "Main",
        },
        {},
        {},
        null,
        mockBusiness
      );
      req.file = {
        fieldname: "image",
        path: "/tmp/test.jpg",
        originalname: "test.jpg",
        mimetype: "image/jpeg",
        size: 1024,
      };

      const res = mockResponse();

      await createProduct(req, res);

      expect(uploadImageToS3).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(201);
    });
  });

  describe("getProducts", () => {
    it("should get all products for a business", async () => {
      const mockProducts = [
        {
          _id: "product1",
          name: "Product 1",
          sku: "SKU-001",
          category: "Category A",
          quantity: 10,
          cost: 50,
          price: 100,
          description: "Description 1",
          business: mockBusiness._id,
        },
        {
          _id: "product2",
          name: "Product 2",
          sku: "SKU-002",
          category: "Category B",
          quantity: 5,
          cost: 30,
          price: 60,
          description: "Description 2",
          business: mockBusiness._id,
        },
      ];

      const mockChain = {
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue(mockProducts),
        select: jest.fn().mockResolvedValue(mockProducts),
      };

      Product.find.mockReturnValue(mockChain);
      Product.countDocuments.mockResolvedValue(2);

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
      const response = res.json.mock.calls[0][0];
      expect(response.products).toBeDefined();
      expect(Array.isArray(response.products)).toBe(true);
    });

    it("should filter products by category", async () => {
      const mockProducts = [
        {
          _id: "product1",
          name: "Product 1",
          sku: "SKU-001",
          category: "Category A",
          quantity: 10,
          cost: 50,
          price: 100,
          description: "Description 1",
          business: mockBusiness._id,
        },
      ];

      const mockChain = {
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue(mockProducts),
        select: jest.fn().mockResolvedValue(mockProducts),
      };

      Product.find.mockReturnValue(mockChain);
      Product.countDocuments.mockResolvedValue(1);

      const req = mockRequest(
        {},
        {},
        { category: "Category A", page: "1", limit: "10" },
        null,
        mockBusiness
      );
      const res = mockResponse();

      await getProducts(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      const response = res.json.mock.calls[0][0];
      expect(response.products).toBeDefined();
    });
  });

  describe("getProduct", () => {
    it("should get a single product by id", async () => {
      const mockProduct = {
        _id: "product123",
        name: "Test Product",
        sku: "SKU-001",
        category: "Electronics",
        quantity: 10,
        cost: 50,
        price: 100,
        description: "Test description",
        business: mockBusiness._id,
      };

      Product.findById.mockResolvedValue(mockProduct);

      const req = mockRequest({}, { id: "product123" }, {}, null, mockBusiness);
      const res = mockResponse();

      await getProduct(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Test Product",
          sku: "SKU-001",
        })
      );
    });

    it("should return 404 if product not found", async () => {
      const req = mockRequest(
        {},
        { id: "507f1f77bcf86cd799439011" }, // Valid ObjectId
        {},
        null,
        mockBusiness
      );
      const res = mockResponse();

      await expect(getProduct(req, res)).rejects.toThrow("Product not found");
    });
  });

  describe("updateProduct", () => {
    it("should update a product successfully", async () => {
      const mockProduct = {
        _id: "product123",
        name: "Original Name",
        sku: "SKU-001",
        category: "Electronics",
        quantity: 10,
        cost: 50,
        price: 100,
        description: "Original description",
        business: mockBusiness._id,
      };

      const mockUpdatedProduct = {
        _id: "product123",
        name: "Updated Name",
        sku: "SKU-001",
        category: "Electronics",
        quantity: 10,
        cost: 50,
        price: 150,
        description: "Updated description",
        business: mockBusiness._id,
      };

      // Mock findById to return the product first
      Product.findById.mockResolvedValue(mockProduct);
      Product.findByIdAndUpdate.mockResolvedValue(mockUpdatedProduct);

      const req = mockRequest(
        {
          name: "Updated Name",
          price: 150,
        },
        { id: "product123" },
        {},
        null,
        mockBusiness
      );

      const res = mockResponse();

      await updateProduct(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Updated Name",
          price: 150,
        })
      );
    });
  });

  describe("deleteProduct", () => {
    it("should delete a product successfully", async () => {
      const mockProduct = {
        _id: "product123",
        name: "Test Product",
        sku: "SKU-001",
        category: "Electronics",
        quantity: 10,
        cost: 50,
        price: 100,
        description: "Test description",
        business: mockBusiness._id,
        remove: jest.fn().mockResolvedValue(true),
      };

      // Mock findById to return the product first
      Product.findById.mockResolvedValue(mockProduct);

      const req = mockRequest({}, { id: "product123" }, {}, null, mockBusiness);
      const res = mockResponse();

      await deleteProduct(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining("deleted"),
        })
      );
      expect(mockProduct.remove).toHaveBeenCalled();
    });

    it("should return 404 if product not found", async () => {
      const req = mockRequest(
        {},
        { id: "507f1f77bcf86cd799439011" },
        {},
        null,
        mockBusiness
      );
      const res = mockResponse();

      await expect(deleteProduct(req, res)).rejects.toThrow(
        "Product not found"
      );
    });
  });
});
