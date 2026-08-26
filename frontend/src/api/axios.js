import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL + "/api",
  // The refresh token lives in an httpOnly cookie set by the backend (see
  // backend/utils/tokens.js) — without withCredentials the browser never
  // sends or accepts it, silently breaking the whole refresh flow below on
  // a cross-origin deploy (frontend on Netlify, backend on Render).
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Endpoints where a 401 means exactly what it says ("that login/refresh
// attempt failed") rather than "your session expired mid-use" — retrying
// these through the refresh flow would either be nonsensical (retrying a
// failed login) or a recursive loop (retrying a failed refresh with another
// refresh).
const AUTH_ENDPOINTS = ["/auth/login", "/auth/register", "/auth/refresh", "/auth/guest"];

let refreshPromise = null; // de-dupes concurrent refreshes if several requests 401 at once

function performRefresh() {
  if (!refreshPromise) {
    refreshPromise = api
      .post("/auth/refresh")
      .then((res) => {
        localStorage.setItem("token", res.data.token);
        localStorage.setItem("user", JSON.stringify(res.data.user));
        return res.data.token;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

// A 401 means the access token is missing/invalid/expired (see
// backend/middleware/auth.js). Since access tokens are now short-lived
// (15 minutes — see backend/utils/tokens.js) this is expected to happen
// routinely during normal use, not just at the end of a session: try one
// silent refresh-and-retry before treating it as a real logout. Every
// protected route hits this same logic for free instead of each call site
// needing its own "session expired" handling.
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    const isAuthEndpoint = AUTH_ENDPOINTS.some((path) => original?.url?.includes(path));
    const isGuest = JSON.parse(localStorage.getItem("user") || "null")?.isGuest;

    if (error.response?.status === 401 && !isAuthEndpoint && !original?._retry && !isGuest) {
      original._retry = true;
      try {
        const newToken = await performRefresh();
        original.headers.Authorization = `Bearer ${newToken}`;
        return api(original);
      } catch {
        // Refresh itself failed (refresh token expired/invalid/reused) —
        // fall through to the hard logout below.
      }
    }

    if (error.response?.status === 401 && (localStorage.getItem("token") || isGuest)) {
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
export { performRefresh };
