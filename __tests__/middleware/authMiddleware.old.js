const protect = require('../../middleWare/authMiddleware');
const BusinessRegistration = require('../../models/businessRegistration');
const jwt = require('jsonwebtoken');
const { mockRequest, mockResponse, mockNext } = require('../helpers/testHelpers');

jest.mock('jsonwebtoken');
// Mock the BusinessRegistration model
jest.mock('../../models/businessRegistration');

describe('Auth Middleware Tests', () => {
  let mockBusiness;

  beforeEach(() => {
    mockBusiness = {
      _id: 'business123',
      businessName: 'Test Business',
      businessEmail: 'test@business.com',
    };
    jest.clearAllMocks();
  });

  describe('protect middleware', () => {
    it('should authenticate user with valid token', async () => {
      // Create a test business
      const business = await BusinessRegistration.create({
        businessName: 'Test Business',
        businessEmail: 'test@business.com',
        businessPhone: '+1234567890',
        businessAddress: '123 Test St',
        password: 'TestPass123!',
        firstName: 'John',
        lastName: 'Doe',
        gender: 'male',
      });

      // Mock JWT verification
      jwt.verify.mockReturnValue({ id: business._id.toString() });

      const req = mockRequest();
      req.cookies = {
        token: 'valid-jwt-token',
        loggedInUser: 'user123',
      };
      const res = mockResponse();
      const next = mockNext();

      await protect(req, res, next);

      expect(jwt.verify).toHaveBeenCalledWith('valid-jwt-token', process.env.JWT_SECRET);
      expect(req.business).toBeDefined();
      expect(req.business.businessEmail).toBe('test@business.com');
      expect(req.loggedInUser).toBe('user123');
      expect(next).toHaveBeenCalled();
    });

    it('should fail if no token is provided', async () => {
      const req = mockRequest();
      req.cookies = {}; // No token
      const res = mockResponse();
      const next = mockNext();

      await expect(protect(req, res, next)).rejects.toThrow(
        'Not authorized, please login'
      );
      expect(res.status).toHaveBeenCalledWith(401);
    });

    it('should fail if token is invalid', async () => {
      jwt.verify.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      const req = mockRequest();
      req.cookies = { token: 'invalid-token' };
      const res = mockResponse();
      const next = mockNext();

      await expect(protect(req, res, next)).rejects.toThrow(
        'Not authorized, please login'
      );
      expect(res.status).toHaveBeenCalledWith(401);
    });

    it('should fail if business not found', async () => {
      jwt.verify.mockReturnValue({ id: 'nonexistent-business-id' });

      const req = mockRequest();
      req.cookies = { token: 'valid-token' };
      const res = mockResponse();
      const next = mockNext();

      await expect(protect(req, res, next)).rejects.toThrow('Business not found');
      expect(res.status).toHaveBeenCalledWith(401);
    });
  });
});
