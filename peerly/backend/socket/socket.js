const jwt = require("jsonwebtoken");
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
  const me = await User.findById(userId).select("friends");
  return !!me?.friends.some((id) => id.toString() === otherUserId);
}

// Sends a "you're being called" push notification to every device the
// callee has enabled background call notifications on. Returns true if at
// least one subscription got a notification, so the caller side can still
// say "offline" when there's truly no way to reach them.
async function sendCallPush(userId, { from, roomCode, callerName, callerAvatarColor, callerAvatarUrl }) {
  if (!pushEnabled) return false;

  const user = await User.findById(userId).select("pushSubscriptions");
  if (!user?.pushSubscriptions?.length) return false;

  // The service worker handling this notification has no live socket
  // connection (the app is fully closed) and can't read the page's
  // localStorage-stored JWT either — a service worker runs in a separate
  // context with no access to it. So "Decline" can't authenticate the
  // normal way. Instead, this one-purpose token is scoped to exactly this
  // call (which room, which caller) and expires with the ring window —
  // it can only ever be used to decline this specific call, nothing else.
  const declineToken = jwt.sign(
    { purpose: "call-decline", roomCode, from },
    process.env.JWT_SECRET,
    { expiresIn: "5m" }
  );

  const payload = JSON.stringify({
    type: "incoming-call",
    from,
    roomCode,
    callerName,
    callerAvatarColor,
    callerAvatarUrl,
    declineToken,
  });

  const results = await Promise.allSettled(
    user.pushSubscriptions.map((sub) => webpush.sendNotification(sub, payload))
  );

  // A subscription that's expired/revoked comes back as a 404/410 — prune
  // it so we stop wasting a push attempt (and a log warning) on it every call.
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

// Relays a decline back to the caller when it comes from a device that has
// no live socket of its own (see the decline token above) — used by
// routes/calls.js after verifying the token. Exported off the initSocket
// function itself (see module.exports at the bottom) so the REST route can
// reach the same in-memory online-users map and io instance this module
// already owns, without a second source of truth for either.
function relayCallDeclined(callerId, roomCode) {
  pendingInvites.delete(roomCode);
  const targetSocketId = getSocketId(callerId);
  if (!targetSocketId || !ioInstance) return false;
  ioInstance.to(targetSocketId).emit("call-invite-response", { roomCode, accepted: false });
  return true;
}

// --- Pending call invites ---
// Tracks every invite between "call-invite" and the moment it's resolved
// (accepted, declined, or timed out) — purely so a disconnect mid-ring can
// be cleaned up on the *other* end. Without this, if the caller closes the
// app/loses connection while the callee's phone is still ringing, nothing
// ever tells the callee to stop — the ringtone (a setInterval on their
// side) runs forever until they manually decline. Symmetrically, if the
// callee's device drops while ringing, the caller is left waiting on a
// call that can now never be answered.
// roomCode -> { callerId, calleeId }
const pendingInvites = new Map();

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
    socket.on("call-invite", async ({ to, roomCode, callerNameHint }) => {
      const isFriend = await areFriends(socket.userId, to);
      if (!isFriend) {
        socket.emit("call-error", { message: "You can only call friends" });
        return;
      }

      // Look the caller's profile up server-side rather than trusting a
      // client-sent name/avatar — also lets the incoming-call UI show the
      // caller's real avatar without an extra round trip. callerNameHint
      // is only used if this lookup unexpectedly comes back empty (a DB
      // hiccup, not the normal path) — it never overrides a real result.
      const caller = await User.findById(socket.userId).select("username avatarColor avatarUrl");
      if (!caller) {
        console.warn(`call-invite: couldn't resolve caller profile for user ${socket.userId}`);
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

      // No live socket — the callee's app is fully closed, not just
      // backgrounded (a backgrounded-but-open tab still has a socket and
      // is handled by the branch above + the client's own Notification API
      // use for that case). Fall back to Web Push so their phone can still
      // ring them in, instead of just failing the call.
      const pushed = await sendCallPush(to, { from: socket.userId, roomCode, ...callerInfo });
      if (pushed) {
        pendingInvites.set(roomCode, { callerId: socket.userId, calleeId: to });
      } else {
        socket.emit("call-error", { message: "That user is offline" });
      }
    });

    socket.on("call-invite-response", ({ to, roomCode, accepted }) => {
      pendingInvites.delete(roomCode);
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

    // Candidates arrive from the client already batched (debounced client-side
    // — see GroupCall.jsx) rather than one at a time. This matters much more
    // for group calls than 1-1: with several peer connections gathering
    // candidates concurrently, one socket.emit per candidate means a burst of
    // individual HTTP long-poll requests (the socket is polling-only — see
    // server.js), which can queue up and stall signaling right when it's
    // most time-sensitive. Sending them as arrays cuts that burst down
    // dramatically.
    socket.on("room-ice-candidates", ({ to, candidates }) => {
      const targetSocketId = getSocketId(to);
      if (targetSocketId && Array.isArray(candidates) && candidates.length) {
        io.to(targetSocketId).emit("room-ice-candidates", { from: socket.userId, candidates });
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

      // Resolve any call invite still ringing that involved this user, so
      // it can't leave the other side hanging (or ringing) forever. Only
      // acts if this user still has *no* other live connection — a user
      // with a second tab/device open (see onlineUsers, a Set of socket
      // ids) is still genuinely reachable, so their calls stay pending.
      if (!onlineUsers.has(socket.userId)) {
        for (const [roomCode, invite] of pendingInvites.entries()) {
          if (invite.callerId === socket.userId) {
            // Caller hung up/dropped before the callee answered — tell
            // the callee's device to stop ringing.
            pendingInvites.delete(roomCode);
            const calleeSocketId = getSocketId(invite.calleeId);
            if (calleeSocketId) io.to(calleeSocketId).emit("call-cancelled", { roomCode });
          } else if (invite.calleeId === socket.userId) {
            // Callee's device dropped while it was still ringing (locked
            // phone, closed app, lost signal) — let the caller know rather
            // than leaving them listening to a ringback that will never
            // be answered. Reuses the existing decline event so the
            // caller-side UI (already listening for it) handles it the
            // same way as a real decline.
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
