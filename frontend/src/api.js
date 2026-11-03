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

// Auto-cleanup on token revocation / 401 Unauthorized
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      const currentToken = localStorage.getItem("certchain_token");
      if (currentToken && !window.location.pathname.includes("/login")) {
        localStorage.removeItem("certchain_token");
        localStorage.removeItem("certchain_role");
        localStorage.removeItem("certchain_institution");
        localStorage.removeItem("certchain_student");
      }
    }
    return Promise.reject(error);
  }
);

export default api;
