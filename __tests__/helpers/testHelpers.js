const jwt = require('jsonwebtoken');

/**
 * Generate a test JWT token
 */
const generateTestToken = (userId, businessId) => {
  return jwt.sign(
    { id: userId },
    process.env.JWT_SECRET || 'test_secret',
    { expiresIn: '1h' }
  );
};

/**
 * Create a mock request object
 */
const mockRequest = (body = {}, params = {}, query = {}, user = null, business = null) => {
  return {
    body,
    params,
    query,
    user,
    business,
    file: null,
    files: null,
    headers: {},
    cookies: {},
  };
};

/**
 * Create a mock response object
 */
const mockResponse = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.send = jest.fn().mockReturnValue(res);
  res.cookie = jest.fn().mockReturnValue(res);
  res.clearCookie = jest.fn().mockReturnValue(res);
  return res;
};

/**
 * Create a mock next function
 */
const mockNext = () => jest.fn();

/**
 * Create mock business data
 */
const mockBusinessData = {
  businessName: 'Test Business',
  businessEmail: 'test@business.com',
  businessPhone: '+1234567890',
  businessAddress: '123 Test St',
  password: 'TestPass123!',
  firstName: 'John',
  lastName: 'Doe',
  gender: 'male',
};

/**
 * Create mock product data
 */
const mockProductData = {
  name: 'Test Product',
  sku: 'TEST-SKU-001',
  category: 'Electronics',
  quantity: 10,
  price: 99.99,
  description: 'A test product',
};

/**
 * Create mock blog data
 */
const mockBlogData = {
  title: 'Test Blog Post',
  content: 'This is test blog content',
  author: 'Test Author',
  image: 'https://example.com/image.jpg',
};

module.exports = {
  generateTestToken,
  mockRequest,
  mockResponse,
  mockNext,
  mockBusinessData,
  mockProductData,
  mockBlogData,
};
