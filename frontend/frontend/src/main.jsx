import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import { AuthProvider } from "./context/AuthContext.jsx";
import { ThemeProvider } from "./context/ThemeContext.jsx";
import ErrorBoundary from "./components/ErrorBoundary.jsx";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ErrorBoundary>
      <ThemeProvider>
        <BrowserRouter>
          <AuthProvider>
            <App />
          </AuthProvider>
        </BrowserRouter>
      </ThemeProvider>
    </ErrorBoundary>
  </React.StrictMode>
);

// Production only — a service worker in dev mode fights with Vite's own
// hot-module-reload caching and causes more confusion than it's worth.
if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => {
        // The service worker needs to know the backend's API base URL to
        // relay a call decline via REST when the app is fully closed (see
        // sw.js) — it can't read import.meta.env itself, since it's a
        // plain static file, not part of the Vite bundle. Sent on every
        // load (cheap, idempotent) rather than only once, so it's always
        // current even after an env var change + redeploy.
        const rawBase = import.meta.env.VITE_API_URL || "http://localhost:5000";
        const apiBaseUrl = `${rawBase.replace(/\/+$/, "")}/api`;
        const sendConfig = (worker) => worker?.postMessage({ type: "SET_API_BASE_URL", apiBaseUrl });
        sendConfig(registration.active);
        navigator.serviceWorker.ready.then((reg) => sendConfig(reg.active));
      })
      .catch((err) => {
        console.warn("Service worker registration failed:", err);
      });
  });
}
