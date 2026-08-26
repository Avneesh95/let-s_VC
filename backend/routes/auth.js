const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const rateLimit = require("express-rate-limit");
const User = require("../models/User");
const {
  signAccessToken,
  signRefreshToken,
  hashToken,
  verifyRefreshToken,
  REFRESH_COOKIE_NAME,
  refreshCookieOptions,
  clearRefreshCookieOptions,
} = require("../utils/tokens");

const router = express.Router();

// Issues a fresh access+refresh pair for a user, persists the refresh
// token's hash on the user doc (overwriting any previous one — this is
// what makes it single-active-session-per-device rather than an
// ever-growing list; logging in on a new device silently invalidates the
// previous refresh token, which is the behavior most users expect), and
// sets the refresh cookie on the response. Shared by register/login/refresh
// so the three don't drift out of sync on how a session gets established.
async function issueSession(res, user) {
  const accessToken = signAccessToken(user._id);
  const refreshToken = signRefreshToken(user._id);
  user.refreshTokenHash = hashToken(refreshToken);
  await user.save();
  res.cookie(REFRESH_COOKIE_NAME, refreshToken, refreshCookieOptions());
  return accessToken;
}

// Applies to login/register/guest: 20 attempts per IP per 15 minutes.
// Loose enough not to bother a real user retyping a password, tight
// enough to make credential-stuffing/brute-force impractical.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many attempts. Please try again in a few minutes." },
});

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// express-mongo-sanitize (see server.js) strips any "$"-prefixed key out of
// a request body to stop NoSQL-operator injection — e.g. a login payload of
// {"email": {"$gt": ""}, "password": {"$gt": ""}} would otherwise match
// against Mongo's query operators and log in as the first user in the
// collection. What it leaves behind, though, is an *emptied object* where a
// string was expected ({} instead of undefined), which crashed every
// `.trim()` call below with a raw 500 before this check existed. Requiring
// the field to actually be a string closes both the injection route (an
// object can never reach a `$or`/`$eq` query as a string) and this crash.
const isNonEmptyString = (val) => typeof val === "string" && val.trim().length > 0;

// @route  POST /api/auth/register
router.post("/register", authLimiter, async (req, res) => {
  try {
    let { username, email, password } = req.body;

    if (!isNonEmptyString(username) || !isNonEmptyString(email) || !isNonEmptyString(password)) {
      return res.status(400).json({ message: "All fields are required" });
    }

    // Normalize before any query/comparison — the User model lowercases
    // email on save (see models/User.js), but a query built from the raw
    // request body doesn't get that same treatment. Without this, "New@Example.com"
    // sails past the duplicate-email check (a case-different existing row
    // doesn't match), then fails at the unique-index level once Mongoose
    // lowercases it right before saving — surfacing as a confusing generic
    // "Server error" instead of "already in use". Trimming guards the same
    // mismatch for a value with stray leading/trailing whitespace (e.g. a
    // mobile keyboard's autocomplete or a pasted value).
    username = username.trim();
    email = email.trim().toLowerCase();

    if (username.length < 2) {
      return res.status(400).json({ message: "Username must be at least 2 characters" });
    }
    if (!EMAIL_RE.test(email)) {
      return res.status(400).json({ message: "Enter a valid email address" });
    }
    if (password.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters" });
    }

    const existing = await User.findOne({ $or: [{ email }, { username }] });
    if (existing) {
      return res.status(400).json({ message: "Username or email already in use" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({ username, email, password: hashedPassword });

    const accessToken = await issueSession(res, user);
    res.status(201).json({
      token: accessToken,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        avatarColor: user.avatarColor,
        avatarUrl: user.avatarUrl,
      },
    });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// @route  POST /api/auth/login
router.post("/login", authLimiter, async (req, res) => {
  try {
    let { email, password } = req.body;

    if (!isNonEmptyString(email) || !isNonEmptyString(password)) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    // Same normalization as register — without it, an account created
    // (or previously logged into) with different casing/whitespace than
    // what's typed this time fails to match with a misleading "Invalid
    // credentials", even though the password is actually correct.
    email = email.trim().toLowerCase();

    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: "Invalid credentials" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: "Invalid credentials" });

    const accessToken = await issueSession(res, user);
    res.json({
      token: accessToken,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        avatarColor: user.avatarColor,
        avatarUrl: user.avatarUrl,
      },
    });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// @route  POST /api/auth/refresh
// @desc   Exchange the httpOnly refresh cookie for a new short-lived access
//         token — this is what makes "close the tab, come back tomorrow,
//         still logged in" work without keeping a 30-day token sitting in
//         localStorage where any XSS bug could read it. Called automatically
//         by the frontend's axios interceptor whenever an access token has
//         expired (see frontend/src/api/axios.js), and once on app boot to
//         restore a session silently.
router.post("/refresh", async (req, res) => {
  const incomingToken = req.cookies?.[REFRESH_COOKIE_NAME];
  if (!incomingToken) {
    return res.status(401).json({ message: "No refresh token" });
  }

  let decoded;
  try {
    decoded = verifyRefreshToken(incomingToken);
  } catch {
    res.clearCookie(REFRESH_COOKIE_NAME, clearRefreshCookieOptions());
    return res.status(401).json({ message: "Session expired, please log in again" });
  }

  try {
    const user = await User.findById(decoded.id).select("+refreshTokenHash");
    // The hash comparison (not just JWT signature verification) is what
    // catches a *stolen but already-rotated* token — every successful
    // refresh rotates the token and overwrites the stored hash, so a token
    // that was copied out of a cookie jar earlier and reused later won't
    // match anymore, even though it's still a validly-signed, unexpired JWT.
    if (!user || !user.refreshTokenHash || user.refreshTokenHash !== hashToken(incomingToken)) {
      if (user) {
        // Reused/stolen token detected — kill the session server-side too,
        // not just this response, so the legitimate device also gets
        // logged out next time it tries to refresh (forces a fresh login).
        user.refreshTokenHash = null;
        await user.save();
      }
      res.clearCookie(REFRESH_COOKIE_NAME, clearRefreshCookieOptions());
      return res.status(401).json({ message: "Session expired, please log in again" });
    }

    const accessToken = await issueSession(res, user);
    res.json({
      token: accessToken,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        avatarColor: user.avatarColor,
        avatarUrl: user.avatarUrl,
      },
    });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// @route  POST /api/auth/logout
// @desc   Clears the refresh cookie and invalidates it server-side, so a
//         token copied out of the browser before logout can't be replayed.
router.post("/logout", async (req, res) => {
  const incomingToken = req.cookies?.[REFRESH_COOKIE_NAME];
  if (incomingToken) {
    try {
      const decoded = verifyRefreshToken(incomingToken);
      await User.findByIdAndUpdate(decoded.id, { refreshTokenHash: null });
    } catch {
      // Token already invalid/expired — nothing to invalidate, fall through
      // and clear the cookie anyway.
    }
  }
  res.clearCookie(REFRESH_COOKIE_NAME, clearRefreshCookieOptions());
  res.json({ message: "Logged out" });
});

// @route  POST /api/auth/guest
// @desc   Quick guest access for joining a video room only — no account,
//         no DB row. Just a short-lived token carrying a random id and
//         whatever name they typed. Guests can join rooms but have no
//         friends/chat history, since there's no persistent User behind them.
//         Deliberately NOT part of the access/refresh flow above — there's
//         no User document to store a refresh-token hash on, and a guest
//         session is meant to be disposable (12h, single token), not a
//         long-lived one worth silently renewing.
router.post("/guest", authLimiter, (req, res) => {
  const { name } = req.body;
  if (!isNonEmptyString(name)) {
    return res.status(400).json({ message: "Name is required" });
  }

  const guestId = `guest_${Math.random().toString(36).slice(2, 10)}`;
  const token = jwt.sign({ id: guestId }, process.env.JWT_SECRET, { expiresIn: "12h" });

  res.json({
    token,
    user: { id: guestId, username: name.trim().slice(0, 30), isGuest: true },
  });
});

module.exports = router;
