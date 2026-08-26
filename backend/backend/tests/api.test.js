require("dotenv").config();
const http = require("http");
const mongoose = require("mongoose");
const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");

const authRoutes = require("../routes/auth");
const userRoutes = require("../routes/users");
const messageRoutes = require("../routes/messages");
const friendRoutes = require("../routes/friends");
const pushRoutes = require("../routes/push");
const callRoutes = require("../routes/calls");
const User = require("../models/User");
const FriendRequest = require("../models/FriendRequest");
const Message = require("../models/Message");

const app = express();
app.use(cors());
app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/friends", friendRoutes);
app.use("/api/push", pushRoutes);
app.use("/api/calls", callRoutes);
app.get("/", (req, res) => res.send("Chat API is running"));
app.use("/api", (req, res) => res.status(404).json({ message: "Not found" }));

app.use((err, req, res, next) => {
  if (err.name === "CastError") return res.status(400).json({ message: "Invalid ID" });
  res.status(err.status || 500).json({ message: err.message || "Server error" });
});

let server;
let baseUrl;

function request(method, path, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, baseUrl);
    const options = {
      method,
      hostname: "127.0.0.1",
      port: url.port,
      path: url.pathname + url.search,
      headers: {
        "Content-Type": "application/json",
      },
    };
    if (token) options.headers["Authorization"] = `Bearer ${token}`;

    const req = http.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        let json = null;
        try {
          json = JSON.parse(data);
        } catch {
          json = data;
        }
        resolve({ status: res.statusCode, body: json });
      });
    });
    req.on("error", reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ PASS: ${message}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    failed++;
  }
}

async function runTests() {
  console.log("Starting test run...");
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to MongoDB for testing.");

  await new Promise((resolve) => {
    server = app.listen(0, "127.0.0.1", () => {
      const port = server.address().port;
      baseUrl = `http://127.0.0.1:${port}`;
      console.log(`Test server listening on ${baseUrl}\n`);
      resolve();
    });
  });

  const timestamp = Date.now();
  const testUser1 = {
    username: `testuser1_${timestamp}`,
    email: `testuser1_${timestamp}@example.com`,
    password: "password123",
  };
  const testUser2 = {
    username: `testuser2_${timestamp}`,
    email: `testuser2_${timestamp}@example.com`,
    password: "password456",
  };

  let token1 = null;
  let user1Id = null;
  let token2 = null;
  let user2Id = null;

  try {
    // 1. Health check & 404
    console.log("[1] Root & Error Endpoints");
    const health = await request("GET", "/");
    assert(health.status === 200 && health.body === "Chat API is running", "Root endpoint returns 200");

    const notFound = await request("GET", "/api/nonexistent");
    assert(notFound.status === 404, "Catch-all /api 404 handler works");

    // 2. Guest Login
    console.log("\n[2] Guest Login");
    const guestEmpty = await request("POST", "/api/auth/guest", { name: "" });
    assert(guestEmpty.status === 400, "Empty guest name rejected with 400");

    const guestValid = await request("POST", "/api/auth/guest", { name: "GuestAlice" });
    assert(
      guestValid.status === 200 && guestValid.body.token && guestValid.body.user.isGuest === true,
      "Valid guest receives JWT and guest user payload"
    );

    // 3. User Registration & Validations
    console.log("\n[3] User Registration & Validation Edge Cases");
    const regShortPass = await request("POST", "/api/auth/register", {
      username: "userabc",
      email: "abc@test.com",
      password: "123",
    });
    assert(regShortPass.status === 400, "Password under 6 chars rejected");

    const regBadEmail = await request("POST", "/api/auth/register", {
      username: "userabc",
      email: "notanemail",
      password: "password123",
    });
    assert(regBadEmail.status === 400, "Malformed email rejected");

    const regObjInjection = await request("POST", "/api/auth/register", {
      username: { $gt: "" },
      email: { $gt: "" },
      password: "password123",
    });
    assert(regObjInjection.status === 400, "NoSQL object injection rejected");

    const regUser1 = await request("POST", "/api/auth/register", testUser1);
    assert(regUser1.status === 201 && regUser1.body.token, "User 1 registered successfully (201)");
    token1 = regUser1.body.token;
    user1Id = regUser1.body.user.id;

    const regDup = await request("POST", "/api/auth/register", testUser1);
    assert(regDup.status === 400, "Duplicate registration rejected with 400");

    const regUser2 = await request("POST", "/api/auth/register", testUser2);
    assert(regUser2.status === 201 && regUser2.body.token, "User 2 registered successfully (201)");
    token2 = regUser2.body.token;
    user2Id = regUser2.body.user.id;

    // 4. User Login
    console.log("\n[4] User Login & Credential Checking");
    const badLogin = await request("POST", "/api/auth/login", {
      email: testUser1.email,
      password: "wrongpassword",
    });
    assert(badLogin.status === 400, "Wrong password rejected with 400");

    const goodLogin = await request("POST", "/api/auth/login", {
      email: testUser1.email.toUpperCase(), // Test case normalization
      password: testUser1.password,
    });
    assert(goodLogin.status === 200 && goodLogin.body.token, "Case-insensitive email login succeeds (200)");

    // 5. Auth Middleware Protection
    console.log("\n[5] Auth Protection Middleware");
    const unauthUsers = await request("GET", "/api/users");
    assert(unauthUsers.status === 401, "Protected route rejects missing token with 401");

    const badTokenUsers = await request("GET", "/api/users", null, "invalid.jwt.token");
    assert(badTokenUsers.status === 401, "Protected route rejects invalid token with 401");

    const authUsers = await request("GET", "/api/users", null, token1);
    assert(
      authUsers.status === 200 && Array.isArray(authUsers.body) && authUsers.body.some((u) => u._id === user2Id),
      "User 1 retrieves contact list containing User 2"
    );

    // 6. Friend Requests & Mutual Friendship Lifecycle
    console.log("\n[6] Friend Requests & Friendship Lifecycle");
    const selfAdd = await request("POST", `/api/friends/request/${user1Id}`, null, token1);
    assert(selfAdd.status === 400, "Adding self as friend rejected with 400");

    const invalidIdAdd = await request("POST", "/api/friends/request/invalid-object-id", null, token1);
    assert(invalidIdAdd.status === 400, "Invalid ObjectId in friend request rejected with 400");

    const nonExistentAdd = await request("POST", `/api/friends/request/${new mongoose.Types.ObjectId()}`, null, token1);
    assert(nonExistentAdd.status === 404, "Non-existent user in friend request returns 404");

    const sendReq = await request("POST", `/api/friends/request/${user2Id}`, null, token1);
    assert(sendReq.status === 201 && sendReq.body._id, "Friend request sent from User 1 to User 2 (201)");
    const requestId = sendReq.body._id;

    const dupReq = await request("POST", `/api/friends/request/${user2Id}`, null, token1);
    assert(dupReq.status === 400, "Duplicate friend request returns 400");

    const user1View = await request("GET", "/api/users", null, token1);
    const u2InU1 = user1View.body.find((u) => u._id === user2Id);
    assert(u2InU1?.friendStatus === "request-sent", "User 1 sees friendStatus as 'request-sent'");

    const user2View = await request("GET", "/api/users", null, token2);
    const u1InU2 = user2View.body.find((u) => u._id === user1Id);
    assert(u1InU2?.friendStatus === "request-received", "User 2 sees friendStatus as 'request-received'");

    const acceptReq = await request("POST", `/api/friends/accept/${requestId}`, null, token2);
    assert(acceptReq.status === 200, "User 2 accepts friend request (200)");

    const user1AfterAccept = await request("GET", "/api/users", null, token1);
    const u2After = user1AfterAccept.body.find((u) => u._id === user2Id);
    assert(u2After?.friendStatus === "friends", "User 1 and User 2 are now mutual friends ('friends')");

    // 7. Messaging Authorization
    console.log("\n[7] Messaging Authorization & Guarding");
    const randomUserId = new mongoose.Types.ObjectId();
    const nonFriendMsgs = await request("GET", `/api/messages/${randomUserId}`, null, token1);
    assert(nonFriendMsgs.status === 403, "Accessing messages with non-friend returns 403 Forbidden");

    const friendMsgs = await request("GET", `/api/messages/${user2Id}`, null, token1);
    assert(friendMsgs.status === 200 && Array.isArray(friendMsgs.body), "Accessing messages with friend returns 200");

    // 8. User Settings & Password Update
    console.log("\n[8] User Settings & Profile Updates");
    const updatedUsername = `newname_${timestamp}`;
    const updateName = await request("PUT", "/api/users/me", { username: updatedUsername }, token1);
    assert(updateName.status === 200 && updateName.body.username === updatedUsername, "Username update succeeds");

    const badPassUpdate = await request(
      "PUT",
      "/api/users/me/password",
      { currentPassword: "wrong", newPassword: "newpassword123" },
      token1
    );
    assert(badPassUpdate.status === 400, "Password update with wrong current password rejected");

    const goodPassUpdate = await request(
      "PUT",
      "/api/users/me/password",
      { currentPassword: testUser1.password, newPassword: "newpassword123" },
      token1
    );
    assert(goodPassUpdate.status === 200, "Password update succeeds");

    console.log("\n==========================================");
    console.log(`  Tests completed: ${passed} passed, ${failed} failed`);
    console.log("==========================================\n");
  } finally {
    console.log("Cleaning up test data from MongoDB...");
    if (user1Id) {
      await User.findByIdAndDelete(user1Id);
      await FriendRequest.deleteMany({ $or: [{ sender: user1Id }, { receiver: user1Id }] });
      await Message.deleteMany({ $or: [{ sender: user1Id }, { receiver: user1Id }] });
    }
    if (user2Id) {
      await User.findByIdAndDelete(user2Id);
      await FriendRequest.deleteMany({ $or: [{ sender: user2Id }, { receiver: user2Id }] });
      await Message.deleteMany({ $or: [{ sender: user2Id }, { receiver: user2Id }] });
    }
    await mongoose.disconnect();
    if (server) server.close();

    if (failed > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  }
}

runTests().catch((err) => {
  console.error("Test runner encountered error:", err);
  process.exit(1);
});
