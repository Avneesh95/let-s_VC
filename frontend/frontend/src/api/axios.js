import axios from "axios";

const rawBaseUrl = import.meta.env.VITE_API_URL || "http://localhost:5000";
const cleanBaseUrl = rawBaseUrl.replace(/\/+$/, "");

const api = axios.create({
  baseURL: `${cleanBaseUrl}/api`,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// A 401 means the token is missing/invalid/expired — every protected route
// returns this the same way (see backend/middleware/auth.js), so handling
// it once here means every API call gets graceful recovery for free,
// instead of each call site needing its own "session expired" logic.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && localStorage.getItem("token")) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      // Hard redirect (not React Router navigation) since this runs
      // outside any component — reloading is also a clean way to reset
      // all app state (socket connection, in-memory chat state) at once.
      window.location.href = "/";
    }
    return Promise.reject(error);
  }
);

export default api;
