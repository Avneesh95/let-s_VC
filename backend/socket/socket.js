const jwt = require("jsonwebtoken");
const Message = require("../models/Message");
const User = require("../models/User");

// In-memory map of userId -> Set of socketIds.
// Using a Set (not a single socketId) means a user with multiple tabs/
// devices connected stays "online" even if one connection drops.
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

// Shared by messaging, calling, and room invites — the friends-only rule
// is the same authorization check applied at every entry point that needs it.
async function areFriends(userId, otherUserId) {
  const me = await User.findById(userId).select("friends");
  return !!me?.friends.some((id) => id.toString() === otherUserId);
}

// --- Video rooms ---
// Rooms are the single video-calling primitive in this app — a 1-1 "call"
// is just a friend-only invite into a private room, and a group call is
// the same room shared via a code. One mesh WebRTC implementation serves
// both cases instead of maintaining two separate signaling paths.
//
// Rooms are ephemeral and live only in memory — no database model needed,
// since a room is really just "whoever currently has the link open." A
// room is created implicitly the moment the first person joins its code,
// and disappears once the last person leaves.
// roomCode -> Map<userId, { socketId, username }>
const rooms = new Map();

// Mesh WebRTC (every participant connects directly to every other
// participant) scales badly past a handful of people — each participant
// has to *upload* their video separately to everyone else. This cap keeps
// that upload fan-out manageable; going higher would need an SFU media
// server instead of peer-to-peer mesh.
const MAX_ROOM_SIZE = 6;

function joinRoom(roomCode, userId, username, socketId) {
  if (!rooms.has(roomCode)) rooms.set(roomCode, new Map());
  rooms.get(roomCode).set(userId, { socketId, username });
}

function leaveRoom(roomCode, userId) {
  const room = rooms.get(roomCode);
  if (!room) return;
  room.delete(userId);
  if (room.size === 0) rooms.delete(roomCode);
}

function getRoomParticipants(roomCode, excludeUserId) {
  const room = rooms.get(roomCode);
  if (!room) return [];
  return Array.from(room.entries())
    .filter(([userId]) => userId !== excludeUserId)
    .map(([userId, info]) => ({ userId, username: info.username }));
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

    // --- Message reactions ---
    // One reaction per user per message: tapping the same emoji again
    // removes it, tapping a different one switches it. Authorization here
    // is "you're one of the two people in this conversation" — reusing
    // sender/receiver on the message itself rather than a separate
    // friends check, since only participants can ever see the message.
    socket.on("react-message", async ({ messageId, emoji, otherUserId }) => {
      try {
        const message = await Message.findById(messageId);
        if (!message) return;
        const participantIds = [message.sender.toString(), message.receiver.toString()];
        if (!participantIds.includes(socket.userId)) return;

        const existingIndex = message.reactions.findIndex((r) => r.user.toString() === socket.userId);
        if (existingIndex !== -1 && message.reactions[existingIndex].emoji === emoji) {
          message.reactions.splice(existingIndex, 1);
        } else if (existingIndex !== -1) {
          message.reactions[existingIndex].emoji = emoji;
        } else {
          message.reactions.push({ emoji, user: socket.userId });
        }
        await message.save();

        const payload = { messageId, reactions: message.reactions };
        const receiverSocketId = getSocketId(otherUserId);
        if (receiverSocketId) io.to(receiverSocketId).emit("message-reaction-updated", payload);
        socket.emit("message-reaction-updated", payload);
      } catch (err) {
        console.error("react-message error:", err.message);
      }
    });

    // --- Call invite (1-1 "call" = a friend-only invite into a room) ---
    // No WebRTC signaling lives here at all — this just notifies the friend
    // and hands both people off to the room-joining flow below, which is
    // the same code path group calls use.
    socket.on("call-invite", async ({ to, roomCode, callerName }) => {
      const isFriend = await areFriends(socket.userId, to);
      if (!isFriend) {
        socket.emit("call-error", { message: "You can only call friends" });
        return;
      }

      const targetSocketId = getSocketId(to);
      if (!targetSocketId) {
        socket.emit("call-error", { message: "That user is offline" });
        return;
      }

      io.to(targetSocketId).emit("call-invite", { from: socket.userId, roomCode, callerName });
    });

    socket.on("call-invite-response", ({ to, roomCode, accepted }) => {
      const targetSocketId = getSocketId(to);
      if (targetSocketId) {
        io.to(targetSocketId).emit("call-invite-response", { roomCode, accepted });
      }
    });

    // --- Video rooms ---
    // Server only relays offer/answer/ICE — it never touches the actual
    // media. The joining user always initiates the connection to everyone
    // already in the room; that keeps "who offers to whom" simple and
    // avoids two peers both offering to each other at once (glare).
    socket.on("join-room", ({ roomCode, username }) => {
      const room = rooms.get(roomCode);
      if (room && room.size >= MAX_ROOM_SIZE) {
        socket.emit("room-error", { message: `Room is full (max ${MAX_ROOM_SIZE} participants)` });
        return;
      }

      socket.currentRoom = roomCode;
      const existingParticipants = getRoomParticipants(roomCode, socket.userId);
      joinRoom(roomCode, socket.userId, username, socket.id);
      socket.join(roomCode);

      // Tell the newcomer who's already here — they'll create offers to each
      socket.emit("existing-participants", existingParticipants);
      // Tell everyone already here that someone new arrived (for UI only —
      // they don't initiate anything, they just wait for the newcomer's offer)
      socket.to(roomCode).emit("user-joined-room", { userId: socket.userId, username });
    });

    socket.on("leave-room", () => {
      if (!socket.currentRoom) return;
      const roomCode = socket.currentRoom;
      leaveRoom(roomCode, socket.userId);
      socket.to(roomCode).emit("user-left-room", { userId: socket.userId });
      socket.leave(roomCode);
      socket.currentRoom = null;
    });

    socket.on("room-offer", ({ to, offer }) => {
      const targetSocketId = getSocketId(to);
      if (targetSocketId) {
        io.to(targetSocketId).emit("room-offer", { from: socket.userId, offer });
      }
    });

    socket.on("room-answer", ({ to, answer }) => {
      const targetSocketId = getSocketId(to);
      if (targetSocketId) {
        io.to(targetSocketId).emit("room-answer", { from: socket.userId, answer });
      }
    });

    socket.on("room-ice-candidate", ({ to, candidate }) => {
      const targetSocketId = getSocketId(to);
      if (targetSocketId) {
        io.to(targetSocketId).emit("room-ice-candidate", { from: socket.userId, candidate });
      }
    });

    // Lightweight in-room text chat. No persistence (matches how rooms
    // themselves work — ephemeral, in-memory only) and no friendship check
    // needed, since being in the room at all is the only authorization this
    // needs. Using io.to (not socket.to) so the sender also gets their own
    // message echoed back, keeping the client's message list a single
    // source of truth.
    socket.on("room-chat-message", ({ roomCode, text }) => {
      if (!text?.trim() || socket.currentRoom !== roomCode) return;
      const room = rooms.get(roomCode);
      const senderInfo = room?.get(socket.userId);
      io.to(roomCode).emit("room-chat-message", {
        senderId: socket.userId,
        username: senderInfo?.username || "Unknown",
        text: text.trim().slice(0, 500),
        timestamp: Date.now(),
      });
    });

    // --- Disconnect ---
    socket.on("disconnect", () => {
      removeSocket(socket.userId, socket.id);
      io.emit("online-users", Array.from(onlineUsers.keys()));

      if (socket.currentRoom) {
        leaveRoom(socket.currentRoom, socket.userId);
        socket.to(socket.currentRoom).emit("user-left-room", { userId: socket.userId });
      }
    });
  });
}

module.exports = initSocket;
