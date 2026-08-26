const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const Message = require("../models/Message");
const User = require("../models/User");
const { webpush, pushEnabled } = require("../config/webpush");

// In-memory map of userId -> Set of socketIds.
// Using a Set (not a single socketId) means a user with multiple tabs/
// devices connected stays "online" even if one connection drops.
// This is fine for a single server instance / resume project. In production
// at scale you'd back this with Redis so it works across multiple server
// instances.
const onlineUsers = new Map();

// Captured once initSocket(io) runs in server.js — lets relayCallDeclined
// (called from routes/calls.js, a plain REST route with no socket of its
// own) reach the same io instance instead of needing it passed around.
let ioInstance = null;

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
  if (!mongoose.isValidObjectId(userId) || !mongoose.isValidObjectId(otherUserId)) {
    return false;
  }
  const me = await User.findById(userId).select("friends");
  const myFriends = Array.isArray(me?.friends) ? me.friends : [];
  return myFriends.some((id) => id && id.toString() === otherUserId);
}

// Actually delivers a push payload to every device a user has subscribed
// from, and prunes any subscription the push service reports as dead
// (expired/revoked — a 404/410 response) so we stop wasting an attempt on
// it every time. Shared by calls and messages — the only difference
// between them is what goes in the payload.
async function sendWebPush(userId, payloadObj) {
  if (!pushEnabled || !mongoose.isValidObjectId(userId)) return false;

  const user = await User.findById(userId).select("pushSubscriptions");
  if (!user?.pushSubscriptions?.length) return false;

  const payload = JSON.stringify(payloadObj);
  const results = await Promise.allSettled(
    user.pushSubscriptions.map((sub) => webpush.sendNotification(sub, payload))
  );

  const deadEndpoints = [];
  results.forEach((result, i) => {
    if (result.status === "rejected" && [404, 410].includes(result.reason?.statusCode)) {
      deadEndpoints.push(user.pushSubscriptions[i].endpoint);
    }
  });
  if (deadEndpoints.length) {
    await User.findByIdAndUpdate(userId, {
      $pull: { pushSubscriptions: { endpoint: { $in: deadEndpoints } } },
    });
  }

  return results.some((r) => r.status === "fulfilled");
}

// Sends a "you're being called" push notification to every device the
// callee has enabled background call notifications on. Returns true if at
// least one subscription got a notification, so the caller side can still
// say "offline" when there's truly no way to reach them.
async function sendCallPush(userId, { from, roomCode, callerName, callerAvatarColor, callerAvatarUrl }) {
  const declineToken = jwt.sign(
    { purpose: "call-decline", roomCode, from },
    process.env.JWT_SECRET,
    { expiresIn: "5m" }
  );

  return sendWebPush(userId, {
    type: "incoming-call",
    from,
    roomCode,
    callerName,
    callerAvatarColor,
    callerAvatarUrl,
    declineToken,
  });
}

// Sends a "new message" push notification for a message that arrived while
// the recipient had no live socket at all (app fully closed).
async function sendMessagePush(userId, { senderId, senderName, senderAvatarUrl, preview }) {
  return sendWebPush(userId, {
    type: "new-message",
    senderId,
    senderName,
    senderAvatarUrl,
    preview,
  });
}

// Relays a decline back to the caller when it comes from a device that has
// no live socket of its own — used by routes/calls.js after verifying the token.
function relayCallDeclined(callerId, roomCode) {
  pendingInvites.delete(roomCode);
  const targetSocketId = getSocketId(callerId);
  if (!targetSocketId || !ioInstance) return false;
  ioInstance.to(targetSocketId).emit("call-invite-response", { roomCode, accepted: false });
  return true;
}

// --- Pending call invites ---
// roomCode -> { callerId, calleeId }
const pendingInvites = new Map();

// --- Video rooms ---
// roomCode -> Map<userId, { socketId, username }>
const rooms = new Map();

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

// Room membership grace period
const pendingRoomLeaves = new Map();
const ROOM_LEAVE_GRACE_MS = 8000;
const DIRECT_CALL_LEAVE_GRACE_MS = 1500;

function roomLeaveKey(roomCode, userId) {
  return `${roomCode}:${userId}`;
}

function cancelPendingRoomLeave(roomCode, userId) {
  const key = roomLeaveKey(roomCode, userId);
  const timer = pendingRoomLeaves.get(key);
  if (timer) {
    clearTimeout(timer);
    pendingRoomLeaves.delete(key);
  }
}

function initSocket(io) {
  ioInstance = io;

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
      if (typeof receiverId !== "string" || !mongoose.isValidObjectId(receiverId)) return;
      if (type === "text" && (!text || typeof text !== "string" || !text.trim())) return;
      if (type === "image" && (!mediaUrl || typeof mediaUrl !== "string")) return;

      const isFriend = await areFriends(socket.userId, receiverId);
      if (!isFriend) {
        socket.emit("message-error", { message: "You can only message friends" });
        return;
      }

      try {
        const cleanText = (typeof text === "string" ? text.trim() : "").slice(0, 2000);
        const cleanMediaUrl = typeof mediaUrl === "string" ? mediaUrl.trim() : null;

        const message = await Message.create({
          sender: socket.userId,
          receiver: receiverId,
          type: type === "image" ? "image" : "text",
          text: cleanText,
          mediaUrl: cleanMediaUrl,
        });

        const receiverSocketId = getSocketId(receiverId);
        if (receiverSocketId) {
          io.to(receiverSocketId).emit("receive-message", message);
        } else {
          // No live socket at all — fall back to web push
          let sender = null;
          if (mongoose.isValidObjectId(socket.userId)) {
            sender = await User.findById(socket.userId).select("username avatarUrl");
          }
          sendMessagePush(receiverId, {
            senderId: socket.userId,
            senderName: sender?.username || "Someone",
            senderAvatarUrl: sender?.avatarUrl,
            preview: type === "image" ? "📷 Photo" : message.text.slice(0, 120),
          }).catch((err) => console.error("sendMessagePush failed:", err.message));
        }

        // Echo back to sender
        socket.emit("message-sent", message);
      } catch (err) {
        socket.emit("message-error", { message: "Failed to send message" });
      }
    });

    // --- Typing indicator ---
    socket.on("typing", ({ receiverId }) => {
      if (!receiverId) return;
      const receiverSocketId = getSocketId(receiverId);
      if (receiverSocketId) {
        io.to(receiverSocketId).emit("typing", { senderId: socket.userId });
      }
    });

    socket.on("stop-typing", ({ receiverId }) => {
      if (!receiverId) return;
      const receiverSocketId = getSocketId(receiverId);
      if (receiverSocketId) {
        io.to(receiverSocketId).emit("stop-typing", { senderId: socket.userId });
      }
    });

    // --- Message reactions ---
    socket.on("react-message", async ({ messageId, emoji, otherUserId }) => {
      try {
        if (!mongoose.isValidObjectId(messageId) || typeof emoji !== "string" || emoji.length > 16) return;
        const message = await Message.findById(messageId);
        if (!message) return;
        const participantIds = [message.sender.toString(), message.receiver.toString()];
        if (!participantIds.includes(socket.userId)) return;

        const existingIndex = message.reactions.findIndex((r) => r.user && r.user.toString() === socket.userId);
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
    socket.on("call-invite", async ({ to, roomCode, callerNameHint }) => {
      if (!to || !roomCode) return;
      const isFriend = await areFriends(socket.userId, to);
      if (!isFriend) {
        socket.emit("call-error", { message: "You can only call friends" });
        return;
      }

      let caller = null;
      if (mongoose.isValidObjectId(socket.userId)) {
        caller = await User.findById(socket.userId).select("username avatarColor avatarUrl");
      }
      const callerInfo = {
        callerName: caller?.username || callerNameHint || "Someone",
        callerAvatarColor: caller?.avatarColor,
        callerAvatarUrl: caller?.avatarUrl,
      };

      const targetSocketId = getSocketId(to);
      if (targetSocketId) {
        io.to(targetSocketId).emit("call-invite", { from: socket.userId, roomCode, ...callerInfo });
        pendingInvites.set(roomCode, { callerId: socket.userId, calleeId: to });
        return;
      }

      // No live socket — callee app fully closed
      const pushed = await sendCallPush(to, { from: socket.userId, roomCode, ...callerInfo });
      if (pushed) {
        pendingInvites.set(roomCode, { callerId: socket.userId, calleeId: to });
      } else {
        socket.emit("call-error", { message: "That user is offline" });
      }
    });

    socket.on("call-invite-response", ({ to, roomCode, accepted }) => {
      if (!roomCode) return;
      pendingInvites.delete(roomCode);
      const targetSocketId = getSocketId(to);
      if (targetSocketId) {
        io.to(targetSocketId).emit("call-invite-response", { roomCode, accepted: !!accepted });
      }
    });

    // --- Video rooms ---
    socket.on("join-room", ({ roomCode, username }) => {
      if (!roomCode || typeof roomCode !== "string") return;
      const cleanRoomCode = roomCode.trim().toUpperCase();
      const cleanUsername = (typeof username === "string" ? username.trim() : "").slice(0, 30) || "Participant";

      const room = rooms.get(cleanRoomCode);
      if (room && room.size >= MAX_ROOM_SIZE) {
        socket.emit("room-error", { message: `Room is full (max ${MAX_ROOM_SIZE} participants)` });
        return;
      }

      cancelPendingRoomLeave(cleanRoomCode, socket.userId);

      socket.currentRoom = cleanRoomCode;
      const existingParticipants = getRoomParticipants(cleanRoomCode, socket.userId);
      joinRoom(cleanRoomCode, socket.userId, cleanUsername, socket.id);
      socket.join(cleanRoomCode);

      socket.emit("existing-participants", existingParticipants);
      socket.to(cleanRoomCode).emit("user-joined-room", { userId: socket.userId, username: cleanUsername });
    });

    socket.on("leave-room", () => {
      if (!socket.currentRoom) return;
      const roomCode = socket.currentRoom;
      cancelPendingRoomLeave(roomCode, socket.userId);
      leaveRoom(roomCode, socket.userId);
      socket.to(roomCode).emit("user-left-room", { userId: socket.userId });
      socket.leave(roomCode);
      socket.currentRoom = null;
    });

    socket.on("room-offer", ({ to, offer }) => {
      const targetSocketId = getSocketId(to);
      if (targetSocketId && offer) {
        io.to(targetSocketId).emit("room-offer", { from: socket.userId, offer });
      }
    });

    socket.on("room-answer", ({ to, answer }) => {
      const targetSocketId = getSocketId(to);
      if (targetSocketId && answer) {
        io.to(targetSocketId).emit("room-answer", { from: socket.userId, answer });
      }
    });

    socket.on("room-ice-candidates", ({ to, candidates }) => {
      const targetSocketId = getSocketId(to);
      if (targetSocketId && Array.isArray(candidates) && candidates.length) {
        io.to(targetSocketId).emit("room-ice-candidates", { from: socket.userId, candidates });
      }
    });

    socket.on("room-chat-message", ({ roomCode, text }) => {
      if (!text || typeof text !== "string" || !text.trim() || socket.currentRoom !== roomCode) return;
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
        const roomCode = socket.currentRoom;
        const userId = socket.userId;
        cancelPendingRoomLeave(roomCode, userId);
        const room = rooms.get(roomCode);
        const graceMs = room && room.size <= 2 ? DIRECT_CALL_LEAVE_GRACE_MS : ROOM_LEAVE_GRACE_MS;
        const timer = setTimeout(() => {
          pendingRoomLeaves.delete(roomLeaveKey(roomCode, userId));
          leaveRoom(roomCode, userId);
          io.to(roomCode).emit("user-left-room", { userId });
        }, graceMs);
        pendingRoomLeaves.set(roomLeaveKey(roomCode, userId), timer);
      }

      if (!onlineUsers.has(socket.userId)) {
        for (const [roomCode, invite] of pendingInvites.entries()) {
          if (invite.callerId === socket.userId) {
            pendingInvites.delete(roomCode);
            const calleeSocketId = getSocketId(invite.calleeId);
            if (calleeSocketId) io.to(calleeSocketId).emit("call-cancelled", { roomCode });
          } else if (invite.calleeId === socket.userId) {
            pendingInvites.delete(roomCode);
            const callerSocketId = getSocketId(invite.callerId);
            if (callerSocketId) {
              io.to(callerSocketId).emit("call-invite-response", { roomCode, accepted: false });
            }
          }
        }
      }
    });
  });
}

module.exports = initSocket;
module.exports.relayCallDeclined = relayCallDeclined;
