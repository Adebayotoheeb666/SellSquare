const BlogPost = require('../../models/blogModel');
const {
  mockRequest,
  mockResponse,
  mockNext,
  mockBlogData,
} = require('../helpers/testHelpers');
const {
  createBlogPost,
  getBlogPosts,
  getBlogPost,
  updateBlogPost,
  deleteBlogPost,
} = require('../../controllers/blogController');
const { uploadImageToS3 } = require('../../utils/fileDownload');

// Mock the S3 upload utility
jest.mock('../../utils/fileDownload', () => ({
  uploadImageToS3: jest.fn(),
}));

// Mock the BlogPost model
jest.mock('../../models/blogModel');

describe('Blog Controller Tests', () => {
  let mockBusiness;

  beforeEach(() => {
    mockBusiness = {
      _id: 'business123',
      businessName: 'Test Business',
      businessEmail: 'test@business.com',
    };
    jest.clearAllMocks();
    
    // Setup default mock implementations
    const mockChain = {
      populate: jest.fn().mockReturnThis(),
      sort: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      skip: jest.fn().mockResolvedValue([]),
      exec: jest.fn().mockResolvedValue([]),
    };
    
    BlogPost.find = jest.fn(() => mockChain);
    BlogPost.findById = jest.fn(() => ({
      populate: jest.fn().mockResolvedValue(null),
    }));
    BlogPost.findByIdAndUpdate = jest.fn().mockResolvedValue(null);
    BlogPost.findByIdAndDelete = jest.fn().mockResolvedValue(null);
    BlogPost.countDocuments = jest.fn().mockResolvedValue(0);
    BlogPost.create = jest.fn();
  });

  describe('createBlogPost', () => {
    it('should create a blog post successfully', async () => {
      const mockBlogPost = {
        _id: 'blog123',
        title: 'Test Blog',
        subtitle: 'Test Subtitle',
        content: 'Test Content',
        readTime: '5 min read',
        published: true,
        tags: ['test', 'blog'],
      };

      BlogPost.create.mockResolvedValue(mockBlogPost);

      const req = mockRequest(
        {
          title: 'Test Blog',
          subtitle: 'Test Subtitle',
          content: 'Test Content',
          readTime: '5 min read',
          published: true,
          tags: JSON.stringify(['test', 'blog']),
        },
        {},
        {},
        null,
        mockBusiness
      );
      req.loggedInUser = { id: 'user123' };

      const res = mockResponse();

      await createBlogPost(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(mockBlogPost);
      expect(BlogPost.create).toHaveBeenCalled();
    });

    it('should fail if user is not authenticated', async () => {
      const req = mockRequest(
        { title: 'Test', subtitle: 'Test', content: 'Test' },
        {},
        {},
        null,
        mockBusiness
      );
      req.loggedInUser = null;

      const res = mockResponse();

      await expect(createBlogPost(req, res)).rejects.toThrow('User not authenticated');
    });

    it('should fail if required fields are missing', async () => {
      const req = mockRequest(
        { title: 'Test' }, // Missing subtitle and content
        {},
        {},
        null,
        mockBusiness
      );
      req.loggedInUser = { id: 'user123' };

      const res = mockResponse();

      await expect(createBlogPost(req, res)).rejects.toThrow(
        'Please fill in all required fields'
      );
    });

    it('should upload image if file is provided', async () => {
      uploadImageToS3.mockResolvedValue({
        Location: 'https://s3.amazonaws.com/test-image.jpg',
      });

      const req = mockRequest(
        {
          title: 'Test Blog',
          subtitle: 'Test Subtitle',
          content: 'Test Content',
        },
        {},
        {},
        null,
        mockBusiness
      );
      req.loggedInUser = { id: 'user123' };
      req.file = {
        path: '/tmp/test.jpg',
        originalname: 'test.jpg',
      };

      const res = mockResponse();

      await createBlogPost(req, res);

      expect(uploadImageToS3).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          coverImage: 'https://s3.amazonaws.com/test-image.jpg',
        })
      );
    });
  });

  describe('getBlogPosts', () => {
    it('should get all published blog posts', async () => {
      const mockBlogPosts = [
        {
          _id: 'blog1',
          title: 'Published Post',
          subtitle: 'Subtitle 1',
          content: 'Content 1',
          published: true,
        },
      ];

      const mockChain = {
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        skip: jest.fn().mockResolvedValue(mockBlogPosts),
      };

      BlogPost.find.mockReturnValue(mockChain);
      BlogPost.countDocuments.mockResolvedValue(1);

      const req = mockRequest({}, {}, { page: 1, limit: 9 });
      const res = mockResponse();

      await getBlogPosts(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          blogPosts: expect.any(Array),
          totalPages: expect.any(Number),
          currentPage: 1,
          totalPosts: expect.any(Number),
        })
      );
    });

    it('should search blog posts by title', async () => {
      const mockBlogPosts = [
        {
          _id: 'blog1',
          title: 'Published Post',
          subtitle: 'Subtitle 1',
          content: 'Content 1',
          published: true,
        },
      ];

      const mockChain = {
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        skip: jest.fn().mockResolvedValue(mockBlogPosts),
      };

      BlogPost.find.mockReturnValue(mockChain);
      BlogPost.countDocuments.mockResolvedValue(1);

      const req = mockRequest({}, {}, { search: 'Published', page: 1, limit: 9 });
      const res = mockResponse();

      await getBlogPosts(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(BlogPost.find).toHaveBeenCalled();
    });
  });

  describe('getBlogPost', () => {
    it('should get a single blog post by id', async () => {
      const blogPost = await BlogPost.create({
        title: 'Test Post',
        subtitle: 'Test Subtitle',
        content: 'Test Content',
        author: mockBusiness._id,
        published: true,
      });

      const req = mockRequest({}, { id: blogPost._id.toString() });
      const res = mockResponse();

      await getBlogPost(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Test Post',
          views: 1, // Should increment views
        })
      );
    });

    it('should return 404 if blog post not found', async () => {
      const req = mockRequest({}, { id: '507f1f77bcf86cd799439011' }); // Valid ObjectId
      const res = mockResponse();

      await expect(getBlogPost(req, res)).rejects.toThrow('Blog post not found');
    });
  });

  describe('updateBlogPost', () => {
    it('should update a blog post successfully', async () => {
      const blogPost = await BlogPost.create({
        title: 'Original Title',
        subtitle: 'Original Subtitle',
        content: 'Original Content',
        author: mockBusiness._id,
        published: true,
      });

      const req = mockRequest(
        {
          title: 'Updated Title',
          subtitle: 'Updated Subtitle',
          content: 'Updated Content',
          imageChanged: 'false',
        },
        { id: blogPost._id.toString() },
        {},
        null,
        mockBusiness
      );
      req.loggedInUser = { id: 'user123' };

      const res = mockResponse();

      await updateBlogPost(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Updated Title',
          subtitle: 'Updated Subtitle',
        })
      );
    });

    it('should not update image if imageChanged is false', async () => {
      const blogPost = await BlogPost.create({
        title: 'Test Post',
        subtitle: 'Test Subtitle',
        content: 'Test Content',
        author: mockBusiness._id,
        coverImage: 'https://old-image.jpg',
      });

      const req = mockRequest(
        {
          title: 'Updated Title',
          subtitle: 'Test Subtitle',
          content: 'Test Content',
          imageChanged: 'false',
        },
        { id: blogPost._id.toString() },
        {},
        null,
        mockBusiness
      );
      req.loggedInUser = { id: 'user123' };
      req.file = { path: '/tmp/new.jpg', originalname: 'new.jpg' };

      const res = mockResponse();

      await updateBlogPost(req, res);

      expect(uploadImageToS3).not.toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          coverImage: 'https://old-image.jpg', // Old image preserved
        })
      );
    });

    it('should update image if imageChanged is true', async () => {
      uploadImageToS3.mockResolvedValue({
        Location: 'https://s3.amazonaws.com/new-image.jpg',
      });

      const blogPost = await BlogPost.create({
        title: 'Test Post',
        subtitle: 'Test Subtitle',
        content: 'Test Content',
        author: mockBusiness._id,
        coverImage: 'https://old-image.jpg',
      });

      const req = mockRequest(
        {
          title: 'Updated Title',
          subtitle: 'Test Subtitle',
          content: 'Test Content',
          imageChanged: 'true',
        },
        { id: blogPost._id.toString() },
        {},
        null,
        mockBusiness
      );
      req.loggedInUser = { id: 'user123' };
      req.file = { path: '/tmp/new.jpg', originalname: 'new.jpg' };

      const res = mockResponse();

      await updateBlogPost(req, res);

      expect(uploadImageToS3).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          coverImage: 'https://s3.amazonaws.com/new-image.jpg',
        })
      );
    });

    it('should fail if user is not the author', async () => {
      const blogPost = await BlogPost.create({
        title: 'Test Post',
        subtitle: 'Test Subtitle',
        content: 'Test Content',
        author: 'differentBusinessId',
      });

      const req = mockRequest(
        { title: 'Updated Title' },
        { id: blogPost._id.toString() },
        {},
        null,
        mockBusiness
      );
      req.loggedInUser = { id: 'user123' };

      const res = mockResponse();

      await expect(updateBlogPost(req, res)).rejects.toThrow(
        'Not authorized to update this post'
      );
    });
  });

  describe('deleteBlogPost', () => {
    it('should delete a blog post successfully', async () => {
      const blogPost = await BlogPost.create({
        title: 'Test Post',
        subtitle: 'Test Subtitle',
        content: 'Test Content',
        author: mockBusiness._id,
      });

      const req = mockRequest(
        {},
        { id: blogPost._id.toString() },
        {},
        null,
        mockBusiness
      );
      req.loggedInUser = { id: 'user123' };

      const res = mockResponse();

      await deleteBlogPost(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Blog post deleted successfully',
      });

      // Verify post was actually deleted
      const deletedPost = await BlogPost.findById(blogPost._id);
      expect(deletedPost).toBeNull();
    });

    it('should fail if user is not authenticated', async () => {
      const blogPost = await BlogPost.create({
        title: 'Test Post',
        subtitle: 'Test Subtitle',
        content: 'Test Content',
        author: mockBusiness._id,
      });

      const req = mockRequest({}, { id: blogPost._id.toString() }, {}, null, mockBusiness);
      req.loggedInUser = null;

      const res = mockResponse();

      await expect(deleteBlogPost(req, res)).rejects.toThrow('User not authenticated');
    });

    it('should fail if blog post not found', async () => {
      const req = mockRequest(
        {},
        { id: '507f1f77bcf86cd799439011' },
        {},
        null,
        mockBusiness
      );
      req.loggedInUser = { id: 'user123' };

      const res = mockResponse();

      await expect(deleteBlogPost(req, res)).rejects.toThrow('Blog post not found');
    });
  });
});
