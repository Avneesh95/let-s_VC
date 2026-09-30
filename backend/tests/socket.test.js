require("dotenv").config();
const http = require("http");
const mongoose = require("mongoose");
const express = require("express");
const cors = require("cors");
const { Server } = require("socket.io");
const { io: Client } = require("../../frontend/node_modules/socket.io-client");

const initSocket = require("../socket/socket");
const authRoutes = require("../routes/auth");
const friendRoutes = require("../routes/friends");
const User = require("../models/User");
const FriendRequest = require("../models/FriendRequest");
const Message = require("../models/Message");
const { signAccessToken } = require("../utils/tokens");

const app = express();
app.use(cors());
app.use(express.json());
app.use("/api/auth", authRoutes);
app.use("/api/friends", friendRoutes);

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*", credentials: true },
  transports: ["polling", "websocket"],
});
initSocket(io);

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

async function runSocketTests() {
  console.log("Starting Socket.IO & Real-time Integration Tests...");
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to MongoDB.");

  let port;
  await new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      port = server.address().port;
      console.log(`Socket test server running on port ${port}`);
      resolve();
    });
  });

  const timestamp = Date.now();
  const u1 = await User.create({
    username: `sock_u1_${timestamp}`,
    email: `sock_u1_${timestamp}@example.com`,
    password: "hashedpassword123",
  });
  const u2 = await User.create({
    username: `sock_u2_${timestamp}`,
    email: `sock_u2_${timestamp}@example.com`,
    password: "hashedpassword123",
  });

  // Make them friends
  u1.friends.push(u2._id);
  u2.friends.push(u1._id);
  await u1.save();
  await u2.save();

  const token1 = signAccessToken(u1._id.toString());
  const token2 = signAccessToken(u2._id.toString());

  let client1;
  let client2;

  try {
    // 1. Connection with Auth
    console.log("\n[1] Socket Authentication");
    const badClient = Client(`http://127.0.0.1:${port}`, {
      auth: { token: "bad.jwt.token" },
      transports: ["polling"],
    });

    const badConnErr = await new Promise((resolve) => {
      badClient.on("connect_error", (err) => {
        resolve(err.message);
      });
    });
    assert(badConnErr === "Invalid token", "Unauthenticated socket rejected with 'Invalid token'");
    badClient.disconnect();

    client1 = Client(`http://127.0.0.1:${port}`, {
      auth: { token: token1 },
      transports: ["polling"],
    });
    await new Promise((resolve) => client1.on("connect", resolve));
    assert(client1.connected, "User 1 connected successfully to Socket.IO");

    client2 = Client(`http://127.0.0.1:${port}`, {
      auth: { token: token2 },
      transports: ["polling"],
    });
    await new Promise((resolve) => client2.on("connect", resolve));
    assert(client2.connected, "User 2 connected successfully to Socket.IO");

    // 2. Real-time Messaging
    console.log("\n[2] Real-time Messaging");
    const testMsgText = "Hello from User 1!";

    const [sentMsg, receivedMsg] = await Promise.all([
      new Promise((resolve) => {
        client1.on("message-sent", (msg) => resolve(msg));
      }),
      new Promise((resolve) => {
        client2.on("receive-message", (msg) => resolve(msg));
      }),
      new Promise((resolve) => {
        client1.emit("send-message", {
          receiverId: u2._id.toString(),
          text: testMsgText,
          type: "text",
        });
        resolve();
      }),
    ]);

    assert(sentMsg.text === testMsgText, "Sender receives 'message-sent' echo");
    assert(receivedMsg.text === testMsgText && receivedMsg.sender === u1._id.toString(), "Receiver gets 'receive-message'");

    // Verify in MongoDB
    const dbMsg = await Message.findById(sentMsg._id);
    assert(dbMsg !== null && dbMsg.text === testMsgText, "Message persisted in MongoDB collection");

    // 3. Typing Indicators
    console.log("\n[3] Typing Indicators");
    const typingPromise = new Promise((resolve) => {
      client2.on("typing", (data) => resolve(data));
    });
    client1.emit("typing", { receiverId: u2._id.toString() });
    const typingData = await typingPromise;
    assert(typingData.senderId === u1._id.toString(), "Receiver gets 'typing' event with sender ID");

    const stopTypingPromise = new Promise((resolve) => {
      client2.on("stop-typing", (data) => resolve(data));
    });
    client1.emit("stop-typing", { receiverId: u2._id.toString() });
    const stopTypingData = await stopTypingPromise;
    assert(stopTypingData.senderId === u1._id.toString(), "Receiver gets 'stop-typing' event with sender ID");

    // 4. Message Reaction
    console.log("\n[4] Message Reactions");
    const reactPromise = new Promise((resolve) => {
      client2.on("message-reaction-updated", (data) => resolve(data));
    });
    client1.emit("react-message", {
      messageId: sentMsg._id,
      emoji: "❤️",
      otherUserId: u2._id.toString(),
    });
    const reactData = await reactPromise;
    assert(
      reactData.messageId === sentMsg._id && reactData.reactions.some((r) => r.emoji === "❤️"),
      "Message reaction broadcasted to participants"
    );

    // 5. Call Signaling & Video Rooms
    console.log("\n[5] Call Signaling & Video Rooms");
    const callInvitePromise = new Promise((resolve) => {
      client2.on("call-invite", (data) => resolve(data));
    });
    const testRoomCode = "TEST99";
    client1.emit("call-invite", {
      to: u2._id.toString(),
      roomCode: testRoomCode,
      callerNameHint: "sock_u1",
    });
    const inviteData = await callInvitePromise;
    assert(inviteData.roomCode === testRoomCode && inviteData.from === u1._id.toString(), "Callee receives 'call-invite'");

    const callResponsePromise = new Promise((resolve) => {
      client1.on("call-invite-response", (data) => resolve(data));
    });
    client2.emit("call-invite-response", {
      to: u1._id.toString(),
      roomCode: testRoomCode,
      accepted: true,
    });
    const responseData = await callResponsePromise;
    assert(responseData.roomCode === testRoomCode && responseData.accepted === true, "Caller receives 'call-invite-response' (accepted: true)");

    // Join room
    console.log("\n[6] WebRTC Video Room Mesh Events");
    client1.emit("join-room", { roomCode: testRoomCode, username: u1.username });

    const userJoinedPromise = new Promise((resolve) => {
      client1.on("user-joined-room", (data) => resolve(data));
    });
    const existingParticipantsPromise = new Promise((resolve) => {
      client2.on("existing-participants", (data) => resolve(data));
    });

    client2.emit("join-room", { roomCode: testRoomCode, username: u2.username });

    const joinedUser = await userJoinedPromise;
    const existingList = await existingParticipantsPromise;

    assert(joinedUser.userId === u2._id.toString(), "Room members receive 'user-joined-room'");
    assert(existingList.some((p) => p.userId === u1._id.toString()), "New participant receives 'existing-participants'");

    // Room ICE candidate relay
    const iceCandidatePromise = new Promise((resolve) => {
      client2.on("room-ice-candidates", (data) => resolve(data));
    });
    client1.emit("room-ice-candidates", {
      to: u2._id.toString(),
      candidates: [{ candidate: "test-candidate", sdpMid: "0" }],
    });
    const iceData = await iceCandidatePromise;
    assert(iceData.from === u1._id.toString() && iceData.candidates.length === 1, "ICE candidate batch relayed successfully");

    // Room In-call Chat
    const roomChatPromise = new Promise((resolve) => {
      client2.on("room-chat-message", (data) => resolve(data));
    });
    client1.emit("room-chat-message", {
      roomCode: testRoomCode,
      text: "Hello in video room!",
    });
    const roomChatData = await roomChatPromise;
    assert(roomChatData.text === "Hello in video room!" && roomChatData.senderId === u1._id.toString(), "In-room chat message broadcasted to room");

    console.log("\n==========================================");
    console.log(`  Socket Tests completed: ${passed} passed, ${failed} failed`);
    console.log("==========================================\n");
  } finally {
    console.log("Cleaning up test records...");
    if (client1) client1.disconnect();
    if (client2) client2.disconnect();
    await User.findByIdAndDelete(u1._id);
    await User.findByIdAndDelete(u2._id);
    await Message.deleteMany({ $or: [{ sender: u1._id }, { receiver: u1._id }] });
    await mongoose.disconnect();
    server.close();

    if (failed > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  }
}

runSocketTests().catch((err) => {
  console.error("Socket test failure:", err);
  process.exit(1);
});
