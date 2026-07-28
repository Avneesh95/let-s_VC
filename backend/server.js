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

const app = express();
const server = http.createServer(app);

// Falls back to the default local frontend URL if CLIENT_URL isn't set,
// so local dev works even if the .env file wasn't picked up correctly.
// CLIENT_URL can be a single origin or a comma-separated list, e.g.
// "http://localhost:5173,http://192.168.1.42:5173" — handy when testing
// from a phone on the same network alongside your desktop browser.
const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:5174",
  process.env.CLIENT_URL
].filter(Boolean);

const corsOptions = {
  origin: (origin, callback) => {
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
});

connectDB();

app.use(cors(corsOptions));
app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/upload", uploadRoutes);

app.get("/", (req, res) => res.send("Chat API is running"));

initSocket(io);

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Allowing requests from: ${allowedOrigins.join(", ")}`);
});
