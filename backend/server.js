require("dotenv").config();
const express = require("express");
const http = require("http");
const cors = require("cors");
const helmet = require("helmet");
const compression = require("compression");
const morgan = require("morgan");
const cookieParser = require("cookie-parser");
const mongoSanitize = require("express-mongo-sanitize");
const rateLimit = require("express-rate-limit");
const { Server } = require("socket.io");

const connectDB = require("./config/db");
const initSocket = require("./socket/socket");
const logger = require("./utils/logger");

const authRoutes = require("./routes/auth");
const userRoutes = require("./routes/users");
const messageRoutes = require("./routes/messages");
const uploadRoutes = require("./routes/upload");
const friendRoutes = require("./routes/friends");
const pushRoutes = require("./routes/push");
const callRoutes = require("./routes/calls");

// Fail fast on boot if required config is missing, rather than starting
// successfully and then failing confusingly on the first request that
// needs the missing value (e.g. every login failing with a cryptic JWT
// error because JWT_SECRET was never set).
const REQUIRED_ENV_VARS = ["MONGO_URI", "JWT_SECRET", "JWT_REFRESH_SECRET"];
const missingEnvVars = REQUIRED_ENV_VARS.filter((key) => !process.env[key]);
if (missingEnvVars.length > 0) {
  console.error(`Missing required environment variable(s): ${missingEnvVars.join(", ")}`);
  console.error("Check your .env file (see .env.example) or your host's environment settings.");
  process.exit(1);
}
if (process.env.JWT_SECRET === process.env.JWT_REFRESH_SECRET) {
  // Not just style — the access/refresh split's entire security value
  // depends on a token signed for one purpose being unable to verify as
  // the other. If someone copy-pastes the same value into both env vars,
  // a leaked access token becomes a usable refresh token too.
  console.error("JWT_SECRET and JWT_REFRESH_SECRET must be different values.");
  process.exit(1);
}

const app = express();
const server = http.createServer(app);

// Falls back to the default local frontend URL if CLIENT_URL isn't set,
// so local dev works even if the .env file wasn't picked up correctly.
// CLIENT_URL can be a single origin or a comma-separated list, e.g.
// "http://localhost:5173,http://192.168.1.42:5173" — handy when testing
// from a phone on the same network alongside your desktop browser.
const allowedOrigins = (process.env.CLIENT_URL || "http://localhost:5173")
  .split(",")
  .map((url) => url.trim());

const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (e.g. curl, mobile apps) and any listed origin
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      const err = new Error("Not allowed by CORS");
      err.status = 403;
      err.isOperational = true;
      callback(err);
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};

const io = new Server(server, {
  cors: { origin: allowedOrigins, credentials: true },
  // Matches the client's transports restriction — see the comment in
  // frontend/src/context/SocketContext.jsx for why WebSocket upgrade was
  // disabled in favor of staying on HTTP long-polling.
  transports: ["polling"],
  // Tolerant of brief WiFi drops (e.g. phone screen lock, laptop sleep) so
  // presence doesn't flicker offline/online from a momentary blip, but not
  // so tolerant that an actually-ended call sits there looking "connected"
  // for ages. The previous values here (60000/25000) meant a hard drop —
  // app force-closed, signal lost, battery died — could take up to ~85s
  // (pingInterval + pingTimeout) for the server to notice and tell the
  // other side the call had ended; that delay is exactly what showed up as
  // "disconnecting takes time" on 1-1 calls. 10s/20s still rides out a
  // normal screen-lock or a few seconds of dead wifi (reconnection is
  // automatic — see SocketContext.jsx), while capping the worst case at
  // ~30s. The graceful-exit path (closing the tab, hitting Leave) is
  // already instant via the explicit "leave-room" emit — see the
  // `pagehide` handler in GroupCall.jsx — so this timeout only matters for
  // genuinely abrupt drops.
  pingTimeout: 20000,
  pingInterval: 10000,
});

connectDB();

app.use(cors(corsOptions));
app.use(
  helmet({
    // This is a pure JSON API — no HTML/inline scripts are ever served
    // from it — so the default CSP (meant for a page that renders HTML)
    // just adds noise without protecting anything here. The frontend
    // (a separate static site) is where a CSP actually matters.
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" }, // uploaded avatars/images are fetched cross-origin by the frontend
  })
);
app.use(compression());
app.use(cookieParser());
app.use(express.json({ limit: "1mb" })); // small cap — this API never expects a legitimately huge JSON body (file uploads go through multer, not JSON)
// Strips any request key starting with "$" or containing "." — the
// operators Mongo/Mongoose would otherwise interpret as query operators
// (e.g. a login body of {"email": {"$gt": ""}, "password": {"$gt": ""}}
// matching the first user in the collection instead of failing auth).
app.use(mongoSanitize());

if (process.env.NODE_ENV !== "production") {
  app.use(morgan("dev"));
} else {
  // "combined" includes response time and status, piped through the
  // shared logger so it's timestamped consistently with everything else.
  app.use(morgan("combined", { stream: { write: (msg) => logger.info(msg.trim()) } }));
}

// A general ceiling across the whole API on top of the tighter,
// endpoint-specific limiters below (auth, messaging, uploads) — this one
// exists to blunt broad scraping/abuse rather than any single attack.
app.use(
  "/api",
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
  })
);

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/api/friends", friendRoutes);
app.use("/api/push", pushRoutes);
app.use("/api/calls", callRoutes);

app.get("/", (req, res) => res.send("Chat API is running"));

// Health check for Render/uptime monitors/load balancers — deliberately
// does NOT touch the database, so it stays fast and keeps reporting "the
// process is alive" even during a brief Mongo hiccup, which a DB-backed
// health check would misreport as the whole service being down.
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", uptime: process.uptime(), timestamp: new Date().toISOString() });
});

// Catch-all for unmatched API routes
app.use("/api", (req, res) => {
  res.status(404).json({ message: "Not found" });
});

// Centralized error handler — any route that calls next(err), or throws
// inside an async handler wrapped to forward its rejection, lands here
// instead of the request hanging or Express's default HTML error page
// leaking a stack trace to the client.
app.use((err, req, res, next) => {
  // Operational errors (ApiError, or anything with a deliberate .status)
  // are expected traffic — log at info/warn, not error, so real bugs
  // aren't buried in a sea of routine 400s. Anything unmarked is treated
  // as a genuine bug and logged at error level with the full stack.
  if (err.isOperational) {
    logger.warn(`${req.method} ${req.originalUrl} -> ${err.status || 400}: ${err.message}`);
  } else {
    logger.error(`${req.method} ${req.originalUrl}`, err);
  }

  // A malformed :id param (e.g. a guest's non-ObjectId token id hitting a
  // route that expects a real Mongo user) throws a Mongoose CastError with
  // a technical message — surface a clean 400 instead of leaking it.
  if (err.name === "CastError") {
    return res.status(400).json({ message: "Invalid ID" });
  }

  const status = err.status || err.statusCode || 500;
  res.status(status).json({
    message: err.message || "Server error",
    ...(err.details ? { details: err.details } : {}),
  });
});

initSocket(io);

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  logger.info(`Server running on port ${PORT} (${process.env.NODE_ENV || "development"})`);
  logger.info(`Allowing requests from: ${allowedOrigins.join(", ")}`);
});
