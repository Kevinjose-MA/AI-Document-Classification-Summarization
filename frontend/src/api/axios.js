// src/api/axios.js
// ─────────────────────────────────────────────────────────────
// Centralised axios instance.
// Base URL reads from VITE_API_URL env var, falls back to localhost.
// Set VITE_API_URL=https://your-api.com/api/v1 in .env.production
// ─────────────────────────────────────────────────────────────
import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:8000/api/v1",
});

// Attach JWT token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Auto-logout on 401
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem("token");
      window.location.href = "/login";
    }
    return Promise.reject(err);
  }
);

export default api;

// ── Also export base URL so DocumentViewer can build file URLs ──
export const API_BASE =
  import.meta.env.VITE_API_URL || "http://localhost:8000/api/v1";