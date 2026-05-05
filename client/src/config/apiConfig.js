/**
 * API Configuration
 *
 * Automatically detects environment and sets correct backend URL
 * - Development: http://localhost:4000 (backend on separate port)
 * - Production: "" (empty string for relative URLs to same origin)
 */

import axios from "axios";
import { getAccessToken } from "../utils/authSession";

const isDevelopment =
  process.env.NODE_ENV === "development" &&
  typeof window !== "undefined" &&
  window.location.hostname === "localhost";

export const BACKEND_URL = isDevelopment ? "http://localhost:4000" : "";

axios.defaults.baseURL = BACKEND_URL;
axios.defaults.withCredentials = true;

axios.interceptors.request.use((config) => {
  const token = getAccessToken();

  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

console.log("[ApiConfig] Environment:", process.env.NODE_ENV);
console.log("[ApiConfig] Backend URL:", BACKEND_URL);
