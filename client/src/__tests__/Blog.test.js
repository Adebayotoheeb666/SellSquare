import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { Provider } from "react-redux";
import configureStore from "redux-mock-store";
import Blog from "../pages/web/Blog/Blog";
import blogService from "../services/blogService";
import * as authService from "../services/authService";

// Mock dependencies
jest.mock("../services/blogService");
jest.mock("../services/authService");
jest.mock("../components/header/SiteNav", () => () => <div>SiteNav</div>);
jest.mock("../components/footer/Footer", () => () => <div>Footer</div>);
jest.mock("sonner", () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

const mockStore = configureStore([]);

describe("Blog Component", () => {
  let store;

  beforeEach(() => {
    store = mockStore({
      auth: {
        user: null,
        isLoggedIn: false,
      },
    });

    // Mock service responses
    authService.getLoginStatus.mockResolvedValue(false);
    blogService.getPosts.mockResolvedValue({
      blogPosts: [
        {
          _id: "1",
          title: "Test Blog Post",
          subtitle: "Test Subtitle",
          content: "Test content",
          coverImage: "test.jpg",
          author: { name: "Test Author" },
          createdAt: new Date().toISOString(),
          readTime: "5 min read",
          tags: ["test"],
        },
      ],
      totalPages: 1,
      currentPage: 1,
      totalPosts: 1,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const renderBlog = () => {
    return render(
      <Provider store={store}>
        <BrowserRouter>
          <Blog />
        </BrowserRouter>
      </Provider>
    );
  };

  it("should render blog component", async () => {
    renderBlog();

    await waitFor(() => {
      expect(screen.getByText("SiteNav")).toBeInTheDocument();
      expect(screen.getByText("Footer")).toBeInTheDocument();
    });
  });

  it("should load and display blog posts", async () => {
    renderBlog();

    await waitFor(() => {
      expect(screen.getByText("Test Blog Post")).toBeInTheDocument();
      expect(screen.getByText("Test Subtitle")).toBeInTheDocument();
    });

    expect(blogService.getPosts).toHaveBeenCalled();
  });

  it('should display "Latest Articles" heading', () => {
    renderBlog();

    expect(screen.getByText("Latest Articles")).toBeInTheDocument();
  });
});
