import { createContext, useContext, useEffect, useRef, useState } from "react";
import api, { performRefresh } from "../api/axios";

const AuthContext = createContext(null);

// Access tokens expire after 15 minutes (see backend/utils/tokens.js) —
// refresh at 12 to renew comfortably before that, so a socket reconnect or
// API call never lands in the ~3-minute expired-but-not-yet-refreshed gap
// that only reactive (401-triggered) refreshing would leave open.
const REFRESH_INTERVAL_MS = 12 * 60 * 1000;

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem("user");
    if (!saved) return null;
    try {
      return JSON.parse(saved);
    } catch {
      // Corrupted localStorage (manual edit, partial write, an old/
      // incompatible shape from a previous version of the app) would
      // otherwise throw on every single app load — caught by the
      // ErrorBoundary, but that just traps the user in an unrecoverable
      // reload loop since the bad value never gets cleared. Treat it the
      // same as "not logged in" and drop the bad entry instead.
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      return null;
    }
  });
  const userRef = useRef(user);
  userRef.current = user;

  // Silent auto-login: a real (non-guest) account's session is meant to
  // survive closing the tab entirely, via the httpOnly refresh cookie —
  // not just a reload with a still-valid localStorage token. On mount,
  // proactively trade the cookie for a fresh access token so a session
  // that outlived its last access token (e.g. laptop was closed overnight)
  // still comes back silently instead of dropping to the login screen.
  useEffect(() => {
    if (!userRef.current || userRef.current.isGuest) return;
    performRefresh().catch(() => {
      // No valid refresh cookie (expired, cleared, or a different device) —
      // the existing localStorage token, if any, will simply 401 on its
      // next use and the axios interceptor's normal logout path handles it.
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep the access token continuously fresh for as long as a real account
  // stays logged in — see REFRESH_INTERVAL_MS above.
  useEffect(() => {
    if (!user || user.isGuest) return;
    const id = setInterval(() => {
      performRefresh().catch(() => {
        // Refresh token itself has expired/been invalidated — let the next
        // API call's 401 drive the actual logout instead of duplicating
        // that logic here.
      });
    }, REFRESH_INTERVAL_MS);
    return () => clearInterval(id);
  }, [user?.id, user?.isGuest]); // eslint-disable-line react-hooks/exhaustive-deps

  const login = async (email, password) => {
    const { data } = await api.post("/auth/login", { email, password });
    localStorage.setItem("token", data.token);
    localStorage.setItem("user", JSON.stringify(data.user));
    setUser(data.user);
  };

  const register = async (username, email, password) => {
    const { data } = await api.post("/auth/register", { username, email, password });
    localStorage.setItem("token", data.token);
    localStorage.setItem("user", JSON.stringify(data.user));
    setUser(data.user);
  };

  const guestLogin = async (name) => {
    const { data } = await api.post("/auth/guest", { name });
    localStorage.setItem("token", data.token);
    localStorage.setItem("user", JSON.stringify(data.user));
    setUser(data.user);
  };

  const logout = () => {
    // Fire-and-forget — invalidates the refresh cookie server-side so a
    // copy of it made before logout can't be replayed later. Local state
    // clears immediately either way; there's nothing useful to do in the
    // UI if this network call happens to fail (offline, server hiccup).
    if (!user?.isGuest) api.post("/auth/logout").catch(() => {});
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setUser(null);
  };

  // Merges profile changes (new username, new avatar) into the stored
  // user object — used after settings updates so the change reflects
  // immediately everywhere the user's own identity is shown, without
  // needing a full re-login.
  const updateUser = (partial) => {
    setUser((prev) => {
      const next = { ...prev, ...partial };
      localStorage.setItem("user", JSON.stringify(next));
      return next;
    });
  };

  return (
    <AuthContext.Provider value={{ user, login, register, guestLogin, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
