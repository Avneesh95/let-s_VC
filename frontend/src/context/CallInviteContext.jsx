import { createContext, useContext, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSocket } from "./SocketContext";
import { useAuth } from "./AuthContext";
import generateRoomCode from "../utils/generateRoomCode";
import { requestNotificationPermission, showNotification } from "../utils/notifications";
import { startRingtone, stopRingtone } from "../utils/ringtone";
import { enablePush, getExistingPushSubscription, isPushSupported, isPushConfiguredOnServer } from "../utils/push";

const CallInviteContext = createContext(null);

// A 1-1 "call" is just a friend-only invite into a private room — this
// context only handles the invite handshake (notify, accept, decline).
// All the actual video-calling logic lives entirely in GroupCall.jsx,
// the same code path a public group call uses. No WebRTC code here at all.
export function CallInviteProvider({ children }) {
  const { socket } = useSocket();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [incomingInvite, setIncomingInvite] = useState(null); // { from, roomCode, callerName, callerAvatarColor, callerAvatarUrl }

  // The room code of whichever call is currently "alive" — meaning its
  // WebRTC connections, socket room membership, and camera/mic tracks all
  // still exist — regardless of which page is actually on screen right
  // now. This is what lets a call survive being minimized: App.jsx keeps
  // <GroupCall> mounted for as long as this is set, entirely independent
  // of the current route, instead of the call being torn down the instant
  // the URL changes away from /room/:roomCode. Only endCall() (an actual
  // hang-up) clears it — navigating elsewhere while minimized must not.
  const [activeRoomCode, setActiveRoomCode] = useState(null);
  const startCall = (roomCode) => setActiveRoomCode(String(roomCode).toUpperCase());
  const endCall = () => setActiveRoomCode(null);
  const activeNotification = useRef(null);
  // Auto-clears a stuck ring if we never hear back at all (missed/dropped
  // socket event) — belt-and-suspenders alongside the server's explicit
  // "call-cancelled" push below, so a ring can never loop forever.
  const ringTimeout = useRef(null);

  // Matches a normal phone's ring window — long enough to actually notice
  // and reach for the phone, short enough not to feel stuck.
  const RING_TIMEOUT_MS = 45000;

  // Ask for notification permission once the user is actually logged in
  // (socket only exists once authenticated) — not on the public landing
  // page before they've done anything, which would feel premature. If
  // they grant it and a subscription doesn't already exist on this device,
  // also quietly turn on "ring when the app is closed" — this is what
  // makes background push work by default rather than needing a trip to
  // Settings first. It's still fully visible/toggleable there afterward.
  useEffect(() => {
    if (!socket) return;
    if (!isPushSupported()) return;

    isPushConfiguredOnServer().then((configured) => {
      if (!configured) return; // nothing to enable — don't even prompt for permission
      requestNotificationPermission().then((permission) => {
        if (permission !== "granted") return;
        getExistingPushSubscription().then((existing) => {
          if (!existing) enablePush().catch(() => {}); // silent — Settings surfaces real errors
        });
      });
    });
  }, [socket]);

  useEffect(() => {
    if (!socket) return;

    const handleInvite = ({ from, roomCode, callerName, callerAvatarColor, callerAvatarUrl }) => {
      setIncomingInvite({ from, roomCode, callerName, callerAvatarColor, callerAvatarUrl });
      startRingtone();

      clearTimeout(ringTimeout.current);
      ringTimeout.current = setTimeout(() => {
        // Nothing declared this call resolved in time (caller never
        // followed up, or a "call-cancelled"/response event got lost) —
        // stop ringing rather than let it run indefinitely.
        closeActiveNotification();
        stopRingtone();
        setIncomingInvite(null);
      }, RING_TIMEOUT_MS);

      // Only bother with an OS-level notification if they're not already
      // looking at the tab — the in-app banner already covers that case,
      // and a redundant notification on top of a visible banner is just noise.
      if (document.hidden) {
        const notif = showNotification(`${callerName} is calling…`, {
          body: "Click to open the call",
          tag: "incoming-call", // replaces any previous call notification instead of stacking
          requireInteraction: true, // stays on screen until dismissed, not auto-timeout
        });
        if (notif) {
          activeNotification.current = notif;
          notif.onclick = () => {
            window.focus();
            notif.close();
          };
        }
      }
    };

    // The caller hung up, closed the app, or lost connection before we
    // answered — the server tells us so explicitly here rather than
    // leaving the ringtone's setInterval running forever with no one on
    // the other end.
    const handleCallCancelled = ({ roomCode }) => {
      setIncomingInvite((current) => {
        if (!current || current.roomCode !== roomCode) return current;
        clearTimeout(ringTimeout.current);
        closeActiveNotification();
        stopRingtone();
        return null;
      });
    };

    socket.on("call-invite", handleInvite);
    socket.on("call-cancelled", handleCallCancelled);
    return () => {
      socket.off("call-invite", handleInvite);
      socket.off("call-cancelled", handleCallCancelled);
      clearTimeout(ringTimeout.current);
    };
  }, [socket]);

  const closeActiveNotification = () => {
    activeNotification.current?.close();
    activeNotification.current = null;
  };

  const callFriend = (targetUser) => {
    if (!socket) {
      alert("Not connected to the server yet — please wait a moment and try again.");
      return;
    }
    const roomCode = generateRoomCode();
    // The server resolves the caller's real name/avatar itself from the
    // authenticated socket (see socket/socket.js) rather than trusting a
    // client-sent value — that's what's actually shown. callerNameHint is
    // only a last-resort fallback for the unlikely case that lookup fails
    // (e.g. a DB hiccup), so the callee still sees a name instead of a
    // generic placeholder — it never overrides a successful server lookup.
    socket.emit("call-invite", { to: targetUser._id, roomCode, callerNameHint: user.username });
    // sessionStorage, not just navigation state — state only lives for the
    // one navigation event and is lost on any page refresh, which was
    // exactly why the room code/count kept reappearing after a reload.
    sessionStorage.setItem(`directCall:${roomCode}`, JSON.stringify({ otherUserName: targetUser.username }));
    navigate(`/room/${roomCode}`);
  };

  const acceptInvite = () => {
    if (!incomingInvite) return;
    clearTimeout(ringTimeout.current);
    closeActiveNotification();
    stopRingtone();
    socket.emit("call-invite-response", {
      to: incomingInvite.from,
      roomCode: incomingInvite.roomCode,
      accepted: true,
    });
    sessionStorage.setItem(
      `directCall:${incomingInvite.roomCode}`,
      JSON.stringify({ otherUserName: incomingInvite.callerName })
    );
    navigate(`/room/${incomingInvite.roomCode}`);
    setIncomingInvite(null);
  };

  const declineInvite = () => {
    if (!incomingInvite) return;
    clearTimeout(ringTimeout.current);
    closeActiveNotification();
    stopRingtone();
    socket.emit("call-invite-response", {
      to: incomingInvite.from,
      roomCode: incomingInvite.roomCode,
      accepted: false,
    });
    setIncomingInvite(null);
  };

  return (
    <CallInviteContext.Provider
      value={{ incomingInvite, callFriend, acceptInvite, declineInvite, activeRoomCode, startCall, endCall }}
    >
      {children}
    </CallInviteContext.Provider>
  );
}

export const useCallInvite = () => useContext(CallInviteContext);
