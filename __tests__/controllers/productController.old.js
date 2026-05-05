const Product = require('../../models/productModel');
const {
  mockRequest,
  mockResponse,
  mockProductData,
} = require('../helpers/testHelpers');
const { createProduct, getProducts, getProduct, deleteProduct, updateProduct } = require('../../controllers/productController');
const { uploadImageToS3 } = require('../../utils/fileDownload');

jest.mock('../../utils/fileDownload', () => ({
  uploadImageToS3: jest.fn(),
}));

// Mock the Product model
jest.mock('../../models/productModel');

describe('Product Controller Tests', () => {
  let mockBusiness;

  beforeEach(() => {
    mockBusiness = {
      _id: 'business123',
      id: 'business123',
      businessName: 'Test Business',
    };
    jest.clearAllMocks();
  });

  describe('createProduct', () => {
    it('should create a product successfully', async () => {
      const req = mockRequest(
        {
          name: 'Test Product',
          sku: 'TEST-001',
          category: 'Electronics',
          quantity: 10,
          cost: 50,
          price: 100,
          description: 'Test product description',
          warehouse: 'Main Warehouse',
        },
        {},
        {},
        null,
        mockBusiness
      );

      const res = mockResponse();

      await createProduct(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Test Product',
          sku: 'TEST-001',
          category: 'Electronics',
        })
      );
    });

    it('should fail if required fields are missing', async () => {
      const req = mockRequest(
        { name: 'Test Product' }, // Missing required fields
        {},
        {},
        null,
        mockBusiness
      );

      const res = mockResponse();

      await expect(createProduct(req, res)).rejects.toThrow(
        'Please fill in all fields'
      );
    });

    it('should upload image if file is provided', async () => {
      uploadImageToS3.mockResolvedValue({
        Location: 'https://s3.amazonaws.com/test-product.jpg',
      });

      const req = mockRequest(
        {
          name: 'Test Product',
          sku: 'TEST-001',
          category: 'Electronics',
          quantity: 10,
          cost: 50,
          price: 100,
          description: 'Test description',
          warehouse: 'Main',
        },
        {},
        {},
        null,
        mockBusiness
      );
      req.file = {
        path: '/tmp/test.jpg',
        originalname: 'test.jpg',
        mimetype: 'image/jpeg',
        size: 1024,
      };

      const res = mockResponse();

      await createProduct(req, res);

      expect(uploadImageToS3).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(201);
    });
  });

  describe('getProducts', () => {
    beforeEach(async () => {
      // Create test products
      await Product.create({
        name: 'Product 1',
        sku: 'SKU-001',
        category: 'Category A',
        quantity: 10,
        cost: 50,
        price: 100,
        description: 'Description 1',
        business: mockBusiness._id,
      });

      await Product.create({
        name: 'Product 2',
        sku: 'SKU-002',
        category: 'Category B',
        quantity: 5,
        cost: 30,
        price: 60,
        description: 'Description 2',
        business: mockBusiness._id,
      });
    });

    it('should get all products for a business', async () => {
      const req = mockRequest({}, {}, {}, null, mockBusiness);
      const res = mockResponse();

      await getProducts(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      const response = res.json.mock.calls[0][0];
      expect(Array.isArray(response)).toBe(true);
      expect(response.length).toBe(2);
    });

    it('should filter products by category', async () => {
      const req = mockRequest({}, {}, { category: 'Category A' }, null, mockBusiness);
      const res = mockResponse();

      await getProducts(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      const response = res.json.mock.calls[0][0];
      expect(response.length).toBe(1);
      expect(response[0].category).toBe('Category A');
    });
  });

  describe('getProduct', () => {
    it('should get a single product by id', async () => {
      const product = await Product.create({
        name: 'Test Product',
        sku: 'SKU-001',
        category: 'Electronics',
        quantity: 10,
        cost: 50,
        price: 100,
        description: 'Test description',
        business: mockBusiness._id,
      });

      const req = mockRequest({}, { id: product._id.toString() }, {}, null, mockBusiness);
      const res = mockResponse();

      await getProduct(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Test Product',
          sku: 'SKU-001',
        })
      );
    });

    it('should return 404 if product not found', async () => {
      const req = mockRequest(
        {},
        { id: '507f1f77bcf86cd799439011' }, // Valid ObjectId
        {},
        null,
        mockBusiness
      );
      const res = mockResponse();

      await expect(getProduct(req, res)).rejects.toThrow('Product not found');
    });
  });

  describe('updateProduct', () => {
    it('should update a product successfully', async () => {
      const product = await Product.create({
        name: 'Original Name',
        sku: 'SKU-001',
        category: 'Electronics',
        quantity: 10,
        cost: 50,
        price: 100,
        description: 'Original description',
        business: mockBusiness._id,
      });

      const req = mockRequest(
        {
          name: 'Updated Name',
          price: 150,
        },
        { id: product._id.toString() },
        {},
        null,
        mockBusiness
      );

      const res = mockResponse();

      await updateProduct(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Updated Name',
          price: 150,
        })
      );
    });
  });

  describe('deleteProduct', () => {
    it('should delete a product successfully', async () => {
      const product = await Product.create({
        name: 'Test Product',
        sku: 'SKU-001',
        category: 'Electronics',
        quantity: 10,
        cost: 50,
        price: 100,
        description: 'Test description',
        business: mockBusiness._id,
      });

      const req = mockRequest({}, { id: product._id.toString() }, {}, null, mockBusiness);
      const res = mockResponse();

      await deleteProduct(req, res);

      expect(res.status).toHaveBeenCalledWith(200);

      // Verify product was deleted
      const deletedProduct = await Product.findById(product._id);
      expect(deletedProduct).toBeNull();
    });

    it('should return 404 if product not found', async () => {
      const req = mockRequest(
        {},
        { id: '507f1f77bcf86cd799439011' },
        {},
        null,
        mockBusiness
      );
      const res = mockResponse();

      await expect(deleteProduct(req, res)).rejects.toThrow('Product not found');
    });
  });
});
