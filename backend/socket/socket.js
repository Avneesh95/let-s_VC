const jwt = require("jsonwebtoken");
const Message = require("../models/Message");


// In-memory map of userId -> socketId.
// This is the simplest possible "online presence" system: fine for a
// single server instance / resume project. In production at scale
// you'd back this with Redis so it works across multiple server instances.
const onlineUsers = new Map();

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
    onlineUsers.set(socket.userId, socket.id);
    io.emit("online-users", Array.from(onlineUsers.keys()));

    // --- Sending a message (text or image) ---
    socket.on("send-message", async ({ receiverId, text, type = "text", mediaUrl }) => {
      if (type === "text" && !text?.trim()) return;
      if (type === "image" && !mediaUrl) return;

      try {
        const message = await Message.create({
          sender: socket.userId,
          receiver: receiverId,
          type,
          text: text?.trim() || "",
          mediaUrl: mediaUrl || null,
        });

        // Send to receiver if they're online
        const receiverSocketId = onlineUsers.get(receiverId);
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
      const receiverSocketId = onlineUsers.get(receiverId);
      if (receiverSocketId) {
        io.to(receiverSocketId).emit("typing", { senderId: socket.userId });
      }
    });

    socket.on("stop-typing", ({ receiverId }) => {
      const receiverSocketId = onlineUsers.get(receiverId);
      if (receiverSocketId) {
        io.to(receiverSocketId).emit("stop-typing", { senderId: socket.userId });
      }
    });

    // --- WebRTC call signaling ---
    // The server never touches audio/video data — it only relays the
    // handshake messages (offer/answer/ICE candidates) between the two
    // peers so their browsers can negotiate a direct connection.
    socket.on("call-user", ({ to, offer, callerName }) => {
      const targetSocketId = onlineUsers.get(to);
      if (targetSocketId) {
        io.to(targetSocketId).emit("incoming-call", {
          from: socket.userId,
          offer,
          callerName,
        });
      }
    });

    socket.on("answer-call", ({ to, answer }) => {
      const targetSocketId = onlineUsers.get(to);
      if (targetSocketId) {
        io.to(targetSocketId).emit("call-answered", { answer });
      }
    });

    socket.on("ice-candidate", ({ to, candidate }) => {
      const targetSocketId = onlineUsers.get(to);
      if (targetSocketId) {
        io.to(targetSocketId).emit("ice-candidate", { candidate });
      }
    });

    socket.on("end-call", ({ to }) => {
      const targetSocketId = onlineUsers.get(to);
      if (targetSocketId) {
        io.to(targetSocketId).emit("call-ended");
      }
    });

    socket.on("decline-call", ({ to }) => {
      const targetSocketId = onlineUsers.get(to);
      if (targetSocketId) {
        io.to(targetSocketId).emit("call-declined");
      }
    });

    // --- Disconnect ---
    socket.on("disconnect", () => {
      onlineUsers.delete(socket.userId);
      io.emit("online-users", Array.from(onlineUsers.keys()));
    });
  });
}

module.exports = initSocket;
