const jwt = require("jsonwebtoken");
const crypto = require("crypto");

// Short-lived — this is what's sent as `Authorization: Bearer <token>` on
// every request and what the socket handshake verifies. Short expiry limits
// the damage window if it's ever exfiltrated (XSS, a logged request, etc.).
const ACCESS_TOKEN_TTL = "15m";
// Long-lived — this is what survives a page reload / browser restart. It
// never leaves the server in a form JS can read (httpOnly cookie), so an
// XSS bug can steal the short-lived access token but not this one.
const REFRESH_TOKEN_TTL = "30d";
const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function signAccessToken(userId) {
  return jwt.sign({ id: userId, type: "access" }, process.env.JWT_SECRET, {
    expiresIn: ACCESS_TOKEN_TTL,
  });
}

function signRefreshToken(userId) {
  // A random jti (token id) is embedded so two refresh tokens issued in the
  // same second for the same user still hash to different values — needed
  // because the hash (not the JWT itself) is what's stored/compared in Mongo.
  const jti = crypto.randomBytes(16).toString("hex");
  const token = jwt.sign(
    { id: userId, type: "refresh", jti },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: REFRESH_TOKEN_TTL }
  );
  return token;
}

// Refresh tokens are stored server-side as a SHA-256 hash, never in
// plaintext — mirrors how you'd never store a password in plaintext. If the
// `refreshTokens` collection/field ever leaked, the hashes alone can't be
// replayed as valid tokens.
function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function verifyRefreshToken(token) {
  return jwt.verify(token, process.env.JWT_REFRESH_SECRET); // throws if invalid/expired
}

const REFRESH_COOKIE_NAME = "refreshToken";

// SameSite=None + Secure is required for the cookie to survive a
// cross-origin request at all (frontend on Netlify, backend on Render are
// different sites) — SameSite=Lax would silently stop sending it. Secure is
// only forced in production so local HTTP dev still works.
function refreshCookieOptions() {
  const isProd = process.env.NODE_ENV === "production";
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? "none" : "lax",
    maxAge: REFRESH_TOKEN_TTL_MS,
    path: "/api/auth", // only sent to auth routes — no reason for every request to carry it
  };
}

// res.clearCookie needs the same httpOnly/secure/sameSite/path attributes
// as the cookie was originally set with (the browser matches on those, not
// just the name) — but NOT maxAge, which Express deprecated for clearCookie
// specifically (it now always expires immediately regardless).
function clearRefreshCookieOptions() {
  const { maxAge, ...rest } = refreshCookieOptions();
  return rest;
}

module.exports = {
  signAccessToken,
  signRefreshToken,
  hashToken,
  verifyRefreshToken,
  REFRESH_COOKIE_NAME,
  refreshCookieOptions,
  clearRefreshCookieOptions,
};
