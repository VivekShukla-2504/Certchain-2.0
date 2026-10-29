import axios from "axios";

export const API_ORIGIN = (process.env.REACT_APP_API_URL || "")
  .replace(/\/api\/?$/, "")
  || (process.env.NODE_ENV === "production" ? "https://certchain-q0y1.onrender.com" : "http://localhost:5000");

const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || (process.env.NODE_ENV === "production" ? "https://certchain-q0y1.onrender.com/api" : "http://localhost:5000/api")
});

// Attach the saved JWT token to every request, if present
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("certchain_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export default api;
