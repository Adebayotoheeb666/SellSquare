const BlogPost = require("../../models/blogModel");
const { mockRequest, mockResponse } = require("../helpers/testHelpers");
const {
  createBlogPost,
  getBlogPosts,
} = require("../../controllers/blogController");
const { uploadImageToS3 } = require("../../utils/fileDownload");

// Mock the S3 upload utility
jest.mock("../../utils/fileDownload", () => ({
  uploadImageToS3: jest.fn(),
}));

// Mock the BlogPost model
jest.mock("../../models/blogModel");

describe("Blog Controller - Simple Tests", () => {
  let mockBusiness;

  beforeEach(() => {
    mockBusiness = {
      _id: "business123",
      businessName: "Test Business",
      businessEmail: "test@business.com",
    };
    jest.clearAllMocks();
  });

  describe("createBlogPost", () => {
    it("should create a blog post successfully", async () => {
      const mockBlogPost = {
        _id: "blog123",
        title: "Test Blog",
        subtitle: "Test Subtitle",
        content: "Test Content",
        readTime: "5 min read",
        published: true,
        tags: ["test", "blog"],
      };

      // Mock BlogPost.create to return the mock blog post
      BlogPost.create.mockResolvedValue(mockBlogPost);

      const req = mockRequest(
        {
          title: "Test Blog",
          subtitle: "Test Subtitle",
          content: "Test Content",
          readTime: "5 min read",
          published: true,
          tags: JSON.stringify(["test", "blog"]),
        },
        {},
        {},
        null,
        mockBusiness
      );
      req.loggedInUser = { id: "user123" };

      const res = mockResponse();

      await createBlogPost(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(mockBlogPost);
      expect(BlogPost.create).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Test Blog",
          subtitle: "Test Subtitle",
          content: "Test Content",
        })
      );
    });

    it("should fail if user is not authenticated", async () => {
      const req = mockRequest(
        {
          title: "Test Blog",
          subtitle: "Test Subtitle",
          content: "Test Content",
        },
        {},
        {},
        null,
        mockBusiness
      );
      req.loggedInUser = null;

      const res = mockResponse();

      await expect(createBlogPost(req, res)).rejects.toThrow(
        "User not authenticated"
      );
      expect(res.status).toHaveBeenCalledWith(401);
    });

    it("should fail if required fields are missing", async () => {
      const req = mockRequest(
        {
          title: "Test Blog",
          // Missing subtitle and content
        },
        {},
        {},
        null,
        mockBusiness
      );
      req.loggedInUser = { id: "user123" };

      const res = mockResponse();

      await expect(createBlogPost(req, res)).rejects.toThrow(
        "Please fill in all required fields"
      );
      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe("getBlogPosts", () => {
    it("should get all published blog posts", async () => {
      const mockBlogPosts = [
        {
          _id: "blog1",
          title: "Published Post 1",
          subtitle: "Subtitle 1",
          content: "Content 1",
          published: true,
        },
        {
          _id: "blog2",
          title: "Published Post 2",
          subtitle: "Subtitle 2",
          content: "Content 2",
          published: true,
        },
      ];

      // Mock the Mongoose query chain
      const mockChain = {
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        skip: jest.fn().mockResolvedValue(mockBlogPosts),
      };

      BlogPost.find = jest.fn().mockReturnValue(mockChain);
      BlogPost.countDocuments = jest.fn().mockResolvedValue(2);

      const req = mockRequest({}, {}, { page: "1", limit: "9" });
      const res = mockResponse();

      await getBlogPosts(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        blogPosts: mockBlogPosts,
        totalPages: 1,
        currentPage: 1,
        totalPosts: 2,
      });
      expect(BlogPost.find).toHaveBeenCalledWith({ published: true });
    });

    it("should handle search query", async () => {
      const mockBlogPosts = [
        {
          _id: "blog1",
          title: "Test Blog",
          subtitle: "Test Subtitle",
          content: "Test Content",
          published: true,
        },
      ];

      const mockChain = {
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        skip: jest.fn().mockResolvedValue(mockBlogPosts),
      };

      BlogPost.find = jest.fn().mockReturnValue(mockChain);
      BlogPost.countDocuments = jest.fn().mockResolvedValue(1);

      const req = mockRequest(
        {},
        {},
        { page: "1", limit: "9", search: "test" }
      );
      const res = mockResponse();

      await getBlogPosts(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(BlogPost.find).toHaveBeenCalledWith(
        expect.objectContaining({
          published: true,
          $or: expect.any(Array),
        })
      );
    });
  });
});
