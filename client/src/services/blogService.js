import axios from "axios";

const BACKEND_URL = "";
const API_URL = `${BACKEND_URL}/api/blog/`;

// Get all blog posts with pagination and search
const getPosts = async (page = 1, limit = 9, search = "") => {
  const params = new URLSearchParams({ page, limit });
  if (search) params.append("search", search);

  const response = await axios.get(`${API_URL}?${params.toString()}`, {
    withCredentials: true,
  });
  return response.data;
};

// Get single blog post by ID
const getPost = async (id) => {
  const response = await axios.get(`${API_URL}${id}`, {
    withCredentials: true,
  });
  return response.data;
};

// Create new blog post (protected)
const createPost = async (formData) => {
  // Debug: Log FormData contents
  console.log("Creating post with data:");
  for (let pair of formData.entries()) {
    console.log(pair[0] + ": ", pair[1]);
  }

  const response = await axios.post(API_URL, formData, {
    withCredentials: true,
    headers: { "Content-Type": "multipart/form-data" },
  });

  console.log("Create post response:", response);
  return response.data;
};

// Update blog post (protected)
const updatePost = async (id, formData) => {
  const response = await axios.patch(`${API_URL}${id}`, formData, {
    withCredentials: true,
    headers: { "Content-Type": "multipart/form-data" },
  });
  return response.data;
};

// Delete blog post (protected)
const deletePost = async (id) => {
  const response = await axios.delete(`${API_URL}${id}`, {
    withCredentials: true,
  });
  return response.data;
};

const blogService = {
  getPosts,
  getPost,
  createPost,
  updatePost,
  deletePost,
};

export default blogService;
