const jwt = require("jsonwebtoken");
const Message = require("../models/Message");
const User = require("../models/User");

// In-memory map of userId -> Set of socketIds.
// Using a Set (not a single socketId) means a user with multiple tabs/
// devices connected stays "online" even if one connection drops — this
// is what was causing the online/offline flickering.
// This is fine for a single server instance / resume project. In production
// at scale you'd back this with Redis so it works across multiple server
// instances.
const onlineUsers = new Map();

function addSocket(userId, socketId) {
  if (!onlineUsers.has(userId)) onlineUsers.set(userId, new Set());
  onlineUsers.get(userId).add(socketId);
}

function removeSocket(userId, socketId) {
  const sockets = onlineUsers.get(userId);
  if (!sockets) return;
  sockets.delete(socketId);
  if (sockets.size === 0) onlineUsers.delete(userId);
}

function getSocketId(userId) {
  const sockets = onlineUsers.get(userId);
  return sockets ? sockets.values().next().value : undefined;
}

// Shared by both messaging and calling — the friends-only rule is the same
// authorization check either way, just applied at two different entry points.
async function areFriends(userId, otherUserId) {
  const me = await User.findById(userId).select("friends");
  return !!me?.friends.some((id) => id.toString() === otherUserId);
}

function initSocket(io) {
  // Every socket connection must present a valid JWT before we let it in.
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error("No token provided"));
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = decoded.id;
      next();
    } catch (err) {
      next(new Error("Invalid token"));
    }
  });

  io.on("connection", (socket) => {
    addSocket(socket.userId, socket.id);
    io.emit("online-users", Array.from(onlineUsers.keys()));

    // --- Sending a message (text or image) ---
    socket.on("send-message", async ({ receiverId, text, type = "text", mediaUrl }) => {
      if (type === "text" && !text?.trim()) return;
      if (type === "image" && !mediaUrl) return;

      const isFriend = await areFriends(socket.userId, receiverId);
      if (!isFriend) {
        socket.emit("message-error", { message: "You can only message friends" });
        return;
      }

      try {
        const message = await Message.create({
          sender: socket.userId,
          receiver: receiverId,
          type,
          text: text?.trim() || "",
          mediaUrl: mediaUrl || null,
        });

        // Send to receiver if they're online
        const receiverSocketId = getSocketId(receiverId);
        if (receiverSocketId) {
          io.to(receiverSocketId).emit("receive-message", message);
        }

        // Echo back to sender so their own UI updates (and confirms it saved)
        socket.emit("message-sent", message);
      } catch (err) {
        socket.emit("message-error", { message: "Failed to send message" });
      }
    });

    // --- Typing indicator ---
    socket.on("typing", ({ receiverId }) => {
      const receiverSocketId = getSocketId(receiverId);
      if (receiverSocketId) {
        io.to(receiverSocketId).emit("typing", { senderId: socket.userId });
      }
    });

    socket.on("stop-typing", ({ receiverId }) => {
      const receiverSocketId = getSocketId(receiverId);
      if (receiverSocketId) {
        io.to(receiverSocketId).emit("stop-typing", { senderId: socket.userId });
      }
    });

    // --- WebRTC call signaling ---
    // The server never touches audio/video data — it only relays the
    // handshake messages (offer/answer/ICE candidates) between the two
    // peers so their browsers can negotiate a direct connection.
    socket.on("call-user", async ({ to, offer, callerName }) => {
      // Authorization check happens here, server-side — disabling the call
      // button in the UI is a nice-to-have, but the actual rule (only
      // friends can call each other) has to be enforced where it can't be
      // bypassed by editing client code.
      const isFriend = await areFriends(socket.userId, to);
      if (!isFriend) {
        socket.emit("call-error", { message: "You can only call friends" });
        return;
      }

      const targetSocketId = getSocketId(to);
      if (targetSocketId) {
        io.to(targetSocketId).emit("incoming-call", {
          from: socket.userId,
          offer,
          callerName,
        });
      }
    });

    socket.on("answer-call", ({ to, answer }) => {
      const targetSocketId = getSocketId(to);
      if (targetSocketId) {
        io.to(targetSocketId).emit("call-answered", { answer });
      }
    });

    socket.on("ice-candidate", ({ to, candidate }) => {
      const targetSocketId = getSocketId(to);
      if (targetSocketId) {
        io.to(targetSocketId).emit("ice-candidate", { candidate });
      }
    });

    socket.on("end-call", ({ to }) => {
      const targetSocketId = getSocketId(to);
      if (targetSocketId) {
        io.to(targetSocketId).emit("call-ended");
      }
    });

    socket.on("decline-call", ({ to }) => {
      const targetSocketId = getSocketId(to);
      if (targetSocketId) {
        io.to(targetSocketId).emit("call-declined");
      }
    });

    // --- Disconnect ---
    socket.on("disconnect", () => {
      removeSocket(socket.userId, socket.id);
      io.emit("online-users", Array.from(onlineUsers.keys()));
    });
  });
}

module.exports = initSocket;
