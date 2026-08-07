require("dotenv").config();
const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");

const connectDB = require("./config/db");
const initSocket = require("./socket/socket");

const authRoutes = require("./routes/auth");
const userRoutes = require("./routes/users");
const messageRoutes = require("./routes/messages");
const uploadRoutes = require("./routes/upload");
const friendRoutes = require("./routes/friends");

// Fail fast on boot if required config is missing, rather than starting
// successfully and then failing confusingly on the first request that
// needs the missing value (e.g. every login failing with a cryptic JWT
// error because JWT_SECRET was never set).
const REQUIRED_ENV_VARS = ["MONGO_URI", "JWT_SECRET"];
const missingEnvVars = REQUIRED_ENV_VARS.filter((key) => !process.env[key]);
if (missingEnvVars.length > 0) {
  console.error(`Missing required environment variable(s): ${missingEnvVars.join(", ")}`);
  console.error("Check your .env file (see .env.example) or your host's environment settings.");
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
      callback(new Error("Not allowed by CORS"));
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
  // More tolerant of brief WiFi drops (e.g. phone screen lock, laptop sleep)
  // so presence doesn't flicker offline/online from a momentary blip.
  pingTimeout: 60000,
  pingInterval: 25000,
});

connectDB();

app.use(cors(corsOptions));
app.use(express.json());

// A handful of basic security headers without pulling in a dependency
// (helmet) for a project this size — the ones that matter most here.
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  next();
});

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/api/friends", friendRoutes);

app.get("/", (req, res) => res.send("Chat API is running"));

// Catch-all for unmatched API routes
app.use("/api", (req, res) => {
  res.status(404).json({ message: "Not found" });
});

// Centralized error handler — any route that calls next(err), or throws
// inside an async handler wrapped to forward its rejection, lands here
// instead of the request hanging or Express's default HTML error page
// leaking a stack trace to the client.
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ message: err.message || "Server error" });
});

initSocket(io);

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Allowing requests from: ${allowedOrigins.join(", ")}`);
});
