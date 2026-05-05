const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');
const cookieParser = require('cookie-parser');
const blogRoute = require('../../routes/blogRoute');
const BlogPost = require('../../models/blogModel');
const BusinessRegistration = require('../../models/businessRegistration');
const jwt = require('jsonwebtoken');

// Setup Express app for testing
const app = express();
app.use(express.json());
app.use(cookieParser());
app.use('/api/blog', blogRoute);

describe('Blog API Integration Tests', () => {
  let authToken;
  let business;
  let blogPost;

  beforeAll(async () => {
    // Create a test business
    business = await BusinessRegistration.create({
      businessName: 'Test Business',
      businessEmail: 'integration@test.com',
      businessPhone: '+1234567890',
      businessAddress: '123 Test St',
      password: 'TestPass123!',
      firstName: 'John',
      lastName: 'Doe',
      gender: 'male',
    });

    // Generate auth token
    authToken = jwt.sign({ id: business._id }, process.env.JWT_SECRET || 'test_secret');
  });

  describe('POST /api/blog', () => {
    it('should create a new blog post', async () => {
      const response = await request(app)
        .post('/api/blog')
        .set('Cookie', [`token=${authToken}`, `loggedInUser=user123`])
        .send({
          title: 'Integration Test Post',
          subtitle: 'Test Subtitle',
          content: 'This is integration test content',
          readTime: '5 min read',
          published: true,
          tags: JSON.stringify(['test', 'integration']),
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('_id');
      expect(response.body.title).toBe('Integration Test Post');

      blogPost = response.body;
    });

    it('should fail without authentication', async () => {
      const response = await request(app)
        .post('/api/blog')
        .send({
          title: 'Test Post',
          subtitle: 'Test',
          content: 'Test content',
        });

      expect(response.status).toBe(401);
    });

    it('should fail with missing required fields', async () => {
      const response = await request(app)
        .post('/api/blog')
        .set('Cookie', [`token=${authToken}`, `loggedInUser=user123`])
        .send({
          title: 'Test Post',
          // Missing subtitle and content
        });

      expect(response.status).toBe(400);
    });
  });

  describe('GET /api/blog', () => {
    beforeAll(async () => {
      // Create some test blog posts
      await BlogPost.create([
        {
          title: 'Published Post 1',
          subtitle: 'Subtitle 1',
          content: 'Content 1',
          author: business._id,
          published: true,
        },
        {
          title: 'Published Post 2',
          subtitle: 'Subtitle 2',
          content: 'Content 2',
          author: business._id,
          published: true,
        },
        {
          title: 'Draft Post',
          subtitle: 'Draft Subtitle',
          content: 'Draft Content',
          author: business._id,
          published: false,
        },
      ]);
    });

    it('should get all published blog posts', async () => {
      const response = await request(app).get('/api/blog').query({ page: 1, limit: 10 });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('blogPosts');
      expect(Array.isArray(response.body.blogPosts)).toBe(true);
      expect(response.body.blogPosts.length).toBeGreaterThan(0);
      
      // Should only return published posts
      response.body.blogPosts.forEach((post) => {
        expect(post.published).toBe(true);
      });
    });

    it('should search blog posts', async () => {
      const response = await request(app)
        .get('/api/blog')
        .query({ search: 'Published Post 1', page: 1, limit: 10 });

      expect(response.status).toBe(200);
      expect(response.body.blogPosts.length).toBeGreaterThan(0);
      expect(response.body.blogPosts[0].title).toContain('Published Post 1');
    });

    it('should handle pagination', async () => {
      const response = await request(app).get('/api/blog').query({ page: 1, limit: 2 });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('totalPages');
      expect(response.body).toHaveProperty('currentPage', 1);
      expect(response.body).toHaveProperty('totalPosts');
    });
  });

  describe('GET /api/blog/:id', () => {
    it('should get a single blog post', async () => {
      const post = await BlogPost.create({
        title: 'Single Post Test',
        subtitle: 'Test Subtitle',
        content: 'Test Content',
        author: business._id,
        published: true,
      });

      const response = await request(app).get(`/api/blog/${post._id}`);

      expect(response.status).toBe(200);
      expect(response.body.title).toBe('Single Post Test');
      expect(response.body.views).toBe(1); // Should increment views
    });

    it('should increment views on each request', async () => {
      const post = await BlogPost.create({
        title: 'Views Test',
        subtitle: 'Test',
        content: 'Content',
        author: business._id,
        published: true,
      });

      await request(app).get(`/api/blog/${post._id}`);
      const response = await request(app).get(`/api/blog/${post._id}`);

      expect(response.body.views).toBe(2);
    });

    it('should return 404 for non-existent post', async () => {
      const response = await request(app).get('/api/blog/507f1f77bcf86cd799439011');

      expect(response.status).toBe(404);
    });
  });

  describe('PATCH /api/blog/:id', () => {
    it('should update a blog post', async () => {
      const post = await BlogPost.create({
        title: 'Original Title',
        subtitle: 'Original Subtitle',
        content: 'Original Content',
        author: business._id,
      });

      const response = await request(app)
        .patch(`/api/blog/${post._id}`)
        .set('Cookie', [`token=${authToken}`, `loggedInUser=user123`])
        .send({
          title: 'Updated Title',
          subtitle: 'Updated Subtitle',
          content: 'Updated Content',
          imageChanged: 'false',
        });

      expect(response.status).toBe(200);
      expect(response.body.title).toBe('Updated Title');
    });

    it('should fail if user is not the author', async () => {
      const otherBusiness = await BusinessRegistration.create({
        businessName: 'Other Business',
        businessEmail: 'other@test.com',
        businessPhone: '+9876543210',
        businessAddress: '456 Other St',
        password: 'OtherPass123!',
        firstName: 'Jane',
        lastName: 'Smith',
        gender: 'female',
      });

      const post = await BlogPost.create({
        title: 'Other User Post',
        subtitle: 'Test',
        content: 'Content',
        author: otherBusiness._id,
      });

      const response = await request(app)
        .patch(`/api/blog/${post._id}`)
        .set('Cookie', [`token=${authToken}`, `loggedInUser=user123`])
        .send({
          title: 'Hacked Title',
        });

      expect(response.status).toBe(403);
    });
  });

  describe('DELETE /api/blog/:id', () => {
    it('should delete a blog post', async () => {
      const post = await BlogPost.create({
        title: 'Delete Test',
        subtitle: 'Test',
        content: 'Content',
        author: business._id,
      });

      const response = await request(app)
        .delete(`/api/blog/${post._id}`)
        .set('Cookie', [`token=${authToken}`, `loggedInUser=user123`]);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Blog post deleted successfully');

      // Verify deletion
      const deletedPost = await BlogPost.findById(post._id);
      expect(deletedPost).toBeNull();
    });

    it('should fail if user is not authenticated', async () => {
      const post = await BlogPost.create({
        title: 'Delete Test',
        subtitle: 'Test',
        content: 'Content',
        author: business._id,
      });

      const response = await request(app).delete(`/api/blog/${post._id}`);

      expect(response.status).toBe(401);
    });
  });
});
