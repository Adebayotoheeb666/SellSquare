const protect = require("../../middleWare/authMiddleware");
const BusinessRegistration = require("../../models/businessRegistration");
const jwt = require("jsonwebtoken");
const {
  mockRequest,
  mockResponse,
  mockNext,
} = require("../helpers/testHelpers");

jest.mock("jsonwebtoken");
// Mock the BusinessRegistration model
jest.mock("../../models/businessRegistration");

describe("Auth Middleware Tests", () => {
  let mockBusiness;

  beforeEach(() => {
    mockBusiness = {
      _id: "business123",
      businessName: "Test Business",
      businessEmail: "test@business.com",
      select: jest.fn().mockReturnThis(),
    };
    jest.clearAllMocks();

    // Setup default BusinessRegistration mock
    BusinessRegistration.findById = jest.fn();
  });

  describe("protect middleware", () => {
    it("should authenticate user with valid token", async () => {
      // Mock JWT verification
      jwt.verify.mockReturnValue({ id: "business123" });

      // Mock finding the business
      const mockBusinessWithSelect = {
        ...mockBusiness,
        select: jest.fn().mockResolvedValue(mockBusiness),
      };
      BusinessRegistration.findById.mockReturnValue(mockBusinessWithSelect);

      const req = mockRequest();
      req.cookies = {
        token: "valid-jwt-token",
        loggedInUser: "user123",
      };
      const res = mockResponse();
      const next = mockNext();

      await protect(req, res, next);

      expect(jwt.verify).toHaveBeenCalledWith(
        "valid-jwt-token",
        process.env.JWT_SECRET
      );
      expect(req.business).toBeDefined();
      expect(req.business.businessEmail).toBe("test@business.com");
      expect(req.loggedInUser).toBe("user123");
      expect(next).toHaveBeenCalled();
    });

    it("should fail if no token is provided", async () => {
      const req = mockRequest();
      req.cookies = {}; // No token
      const res = mockResponse();
      const next = mockNext();

      try {
        await protect(req, res, next);
      } catch (error) {
        // Error is expected
      }

      expect(res.status).toHaveBeenCalledWith(401);
    });

    it("should fail if token is invalid", async () => {
      jwt.verify.mockImplementation(() => {
        throw new Error("Invalid token");
      });

      const req = mockRequest();
      req.cookies = { token: "invalid-token" };
      const res = mockResponse();
      const next = mockNext();

      try {
        await protect(req, res, next);
      } catch (error) {
        // Error is expected
      }

      expect(res.status).toHaveBeenCalledWith(401);
    });

    it("should fail if business not found", async () => {
      jwt.verify.mockReturnValue({ id: "nonexistent-business-id" });

      // Mock finding no business
      const mockBusinessWithSelect = {
        select: jest.fn().mockResolvedValue(null),
      };
      BusinessRegistration.findById.mockReturnValue(mockBusinessWithSelect);

      const req = mockRequest();
      req.cookies = { token: "valid-token" };
      const res = mockResponse();
      const next = mockNext();

      try {
        await protect(req, res, next);
      } catch (error) {
        // Error is expected
      }

      expect(res.status).toHaveBeenCalledWith(401);
    });
  });
});
