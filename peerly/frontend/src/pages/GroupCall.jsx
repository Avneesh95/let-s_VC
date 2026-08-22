import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Mic,
  MicOff,
  Video as VideoIcon,
  VideoOff,
  ScreenShare,
  MessageCircle,
  PhoneOff,
  RefreshCw,
  Link2,
  X,
  Send,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useSocket } from "../context/SocketContext";
import ICE_SERVERS from "../utils/iceServers";
import { startRingback, stopRingtone } from "../utils/ringtone";

// Keep in sync with MAX_ROOM_SIZE on the backend — this is just for the UI
// counter, the backend is what actually enforces the cap.
const MAX_PARTICIPANTS = 6;

// Wraps the floating self-view PiP (used when there's exactly one other
// participant, i.e. a 1-1-style call) to make it draggable anywhere within
// the video area — the same "move your own bubble" behavior WhatsApp uses.
// Uses the Pointer Events API so one set of handlers covers both mouse and
// touch, rather than maintaining separate mouse/touch listeners.
function DraggableSelfView({ children, widthClass }) {
  const elRef = useRef(null);
  const [pos, setPos] = useState({ top: 16, left: null }); // left resolves to top-right on first measure
  const dragRef = useRef({ active: false, startX: 0, startY: 0, origLeft: 0, origTop: 0 });

  useEffect(() => {
    const el = elRef.current;
    const parent = el?.parentElement;
    if (!el || !parent) return;
    const parentRect = parent.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    setPos({ top: 84, left: parentRect.width - elRect.width - 16 });
  }, []);

  const clamp = (left, top) => {
    const el = elRef.current;
    const parent = el?.parentElement;
    if (!el || !parent) return { left, top };
    const parentRect = parent.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    return {
      left: Math.max(0, Math.min(left, parentRect.width - elRect.width)),
      top: Math.max(0, Math.min(top, parentRect.height - elRect.height)),
    };
  };

  const onPointerDown = (e) => {
    dragRef.current = {
      active: true,
      startX: e.clientX,
      startY: e.clientY,
      origLeft: pos.left ?? 0,
      origTop: pos.top ?? 0,
    };
    elRef.current?.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e) => {
    if (!dragRef.current.active) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    setPos(clamp(dragRef.current.origLeft + dx, dragRef.current.origTop + dy));
  };

  const onPointerUp = (e) => {
    dragRef.current.active = false;
    elRef.current?.releasePointerCapture(e.pointerId);
  };

  return (
    <div
      ref={elRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      className={`absolute ${widthClass} cursor-grab active:cursor-grabbing touch-none select-none z-20`}
      style={{ top: pos.top, left: pos.left ?? undefined }}
    >
      {children}
    </div>
  );
}

function VideoTile({ stream, label, muted, fullSize, cameraOff, mirrored, portrait, connState, onRetry }) {
  const videoRef = useRef(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  const showFailed = !stream && connState === "failed";
  const statusText = connState === "reconnecting" ? "Reconnecting…" : "Connecting…";

  return (
    <div
      className={
        fullSize
          ? "relative w-full h-full bg-black overflow-hidden flex items-center justify-center"
          : `relative bg-black rounded-xl overflow-hidden ${
              portrait ? "aspect-[3/4]" : "aspect-video"
            } flex items-center justify-center ring-1 ring-white/10`
      }
    >
      {stream ? (
        // Always keep the <video> element mounted — toggling camera on/off
        // only changes whether the placeholder covers it, never unmounts
        // it. Unmounting and remounting on every toggle was the bug: a
        // freshly mounted <video> needs srcObject reassigned, but the
        // effect above only re-runs when `stream` itself changes, not on
        // every mount, so a toggled-back-on video would stay blank.
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={muted}
          className={`w-full h-full ${fullSize ? "object-contain" : "object-cover"} ${
            mirrored ? "-scale-x-100" : ""
          }`}
        />
      ) : showFailed ? (
        // Stuck for too long even after an automatic retry (almost always
        // a congested TURN relay — see iceServers.js) — give the person
        // something to do instead of an indefinite spinner.
        <div className="flex flex-col items-center gap-2 px-3 text-center">
          <span className="text-white/70 text-sm">Connection issue</span>
          {onRetry && (
            <button
              onClick={onRetry}
              className="text-xs bg-white/15 hover:bg-white/25 transition-colors rounded-full px-3 py-1.5 flex items-center gap-1.5"
            >
              <RefreshCw className="w-3 h-3" strokeWidth={2} />
              Retry
            </button>
          )}
        </div>
      ) : (
        <span className="text-white/60 text-sm">{statusText}</span>
      )}
      {cameraOff && (
        <div className="absolute inset-0 bg-callbg flex items-center justify-center">
          <VideoOff className="w-7 h-7 text-white/45" strokeWidth={1.5} />
        </div>
      )}
      {label && (
        <span className="absolute bottom-2 left-2 bg-black/50 backdrop-blur-sm text-white text-xs px-2 py-0.5 rounded-md">
          {label}
        </span>
      )}
    </div>
  );
}

export default function GroupCall() {
  const { roomCode: rawRoomCode } = useParams();
  // Normalize casing here too — the join/create forms already uppercase
  // the code, but someone pasting or typing the URL directly (bypassing
  // those forms) could land here with different casing, which would
  // silently put them in a *different* room than intended.
  const roomCode = rawRoomCode.toUpperCase();
  const navigate = useNavigate();
  // Set when this room was entered via a friend's call invite rather than
  // a shared public link — in that case we hide the room code/participant
  // count (nothing to share) and show who you're calling instead, matching
  // how a normal 1-1 video call looks rather than a "join a room" screen.
  // Read from sessionStorage (not navigation state) specifically so this
  // survives a page refresh — navigation state only lives for the single
  // navigation event that set it and is gone the moment the page reloads.
  const directCallInfo = JSON.parse(sessionStorage.getItem(`directCall:${roomCode}`) || "null");
  const isDirectCall = !!directCallInfo;
  const directCallOtherName = directCallInfo?.otherUserName;
  const { user, guestLogin } = useAuth();
  const { socket } = useSocket();

  // If someone lands here without being logged in at all (e.g. opened a
  // shared room link cold), let them join with just a name right here
  // instead of bouncing them to the generic home page and losing the
  // room code they were trying to join.
  const [guestName, setGuestName] = useState("");
  const [guestJoining, setGuestJoining] = useState(false);
  const [guestError, setGuestError] = useState("");

  const handleGuestJoin = async (e) => {
    e.preventDefault();
    if (!guestName.trim()) {
      setGuestError("Enter your name");
      return;
    }
    setGuestError("");
    setGuestJoining(true);
    try {
      await guestLogin(guestName.trim());
    } catch (err) {
      setGuestError("Something went wrong — try again");
    } finally {
      setGuestJoining(false);
    }
  };

  const [localStream, setLocalStream] = useState(null);
  // userId -> { username, stream }
  const [participants, setParticipants] = useState({});
  // Mirrors `participants` size for use inside createPeerConnection, which
  // can't depend on `participants` directly (that would recreate the
  // callback, and every peer connection, on every join/leave). Read via
  // this ref instead so bitrate decisions use the current room size
  // without that churn.
  const roomSizeRef = useRef(1);
  useEffect(() => {
    roomSizeRef.current = Object.keys(participants).length + 1; // +1 for self
  }, [participants]);
  const [error, setError] = useState("");
  // Distinguishes "never connected yet" (ringing out) from "was connected,
  // then the other side left" — only a direct 1-1 call needs this: a group
  // room being momentarily empty is normal (everyone else could still
  // join), but a 1-1 call has exactly one other person, so once they leave
  // there is nothing left to be "waiting" for.
  const hadConnectedRef = useRef(false);
  const [callEnded, setCallEnded] = useState(false);

  useEffect(() => {
    if (Object.keys(participants).length > 0) hadConnectedRef.current = true;
  }, [participants]);

  // Once the call is marked ended, actually leave — after a short beat so
  // "Call ended" is visible rather than the screen just vanishing.
  useEffect(() => {
    if (!callEnded) return;
    stopRingtone();
    const t = setTimeout(() => navigate("/"), 1600);
    return () => clearTimeout(t);
  }, [callEnded, navigate]);

  // Ringback tone (the caller's-side "brrring... brrring" while waiting)
  // — only for direct 1-1 calls, only while genuinely alone waiting, and
  // stopped the moment someone joins, the call errors out, or this page
  // is left.
  useEffect(() => {
    const stillAlone = Object.keys(participants).length === 0;
    if (isDirectCall && stillAlone && !error && !callEnded) {
      startRingback();
    } else {
      stopRingtone();
    }
    return () => stopRingtone();
  }, [isDirectCall, participants, error, callEnded]);
  const [facingMode, setFacingMode] = useState("user");
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [isMicOn, setIsMicOn] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  // Screen sharing is a desktop-browser feature in practice — iOS Safari
  // doesn't implement getDisplayMedia at all, and Android Chrome's support
  // is unreliable/OS-version-dependent. Feature-detecting here (rather than
  // just hiding the button visually) means a phone never even sees a
  // control that's likely to silently fail if tapped.
  const [screenShareSupported] = useState(
    () => typeof navigator !== "undefined" && !!navigator.mediaDevices?.getDisplayMedia
  );
  // Remembers the camera video track while screen sharing is active, so
  // stopping the share can restore the camera feed exactly as it was.
  const cameraTrackRef = useRef(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState([]); // { senderId, username, text, timestamp }
  const [chatInput, setChatInput] = useState("");

  // WhatsApp/FaceTime-style call screen: video fills the entire viewport
  // and the header/controls float over it as translucent overlays instead
  // of taking up their own dedicated layout rows. Those overlays auto-hide
  // after a few seconds of inactivity so the video gets the whole screen,
  // and reappear on any tap/mouse movement. Kept always-visible while
  // still ringing/waiting (nothing else to look at yet) or while the chat
  // panel is open (so its own overlay doesn't fight with a control bar
  // fading out underneath it).
  const [controlsVisible, setControlsVisible] = useState(true);
  const hideControlsTimer = useRef(null);
  const forceControlsVisible = Object.keys(participants).length + 1 === 1 || chatOpen;

  const bumpControlsVisible = useCallback(() => {
    setControlsVisible(true);
    clearTimeout(hideControlsTimer.current);
    if (!forceControlsVisible) {
      hideControlsTimer.current = setTimeout(() => setControlsVisible(false), 4000);
    }
  }, [forceControlsVisible]);

  useEffect(() => {
    bumpControlsVisible();
    return () => clearTimeout(hideControlsTimer.current);
  }, [bumpControlsVisible]);

  const peerConnections = useRef(new Map()); // userId -> RTCPeerConnection
  const pendingCandidates = useRef(new Map()); // userId -> queued incoming candidates (before remoteDescription is set)
  const outgoingCandidates = useRef(new Map()); // userId -> queued outgoing candidates (before the debounced flush)
  const outgoingFlushTimers = useRef(new Map()); // userId -> flush timeout id
  const staleConnectionTimers = useRef(new Map()); // userId -> "still not connected" timeout id
  const reconnectAttemptsLeft = useRef(new Map()); // userId -> automatic retries remaining
  const localStreamRef = useRef(null); // avoids stale closures inside socket handlers

  useEffect(() => {
    localStreamRef.current = localStream;
  }, [localStream]);

  const flushPending = async (userId, pc) => {
    const queue = pendingCandidates.current.get(userId) || [];
    while (queue.length > 0) {
      const candidate = queue.shift();
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (err) {
        console.error("Failed to add queued ICE candidate", err);
      }
    }
  };

  // Sends queued outgoing candidates for one peer as a single batch instead
  // of one socket.emit per candidate — see the comment in iceServers.js and
  // backend/socket/socket.js for why this matters much more for group calls
  // (several peer connections gathering candidates concurrently) than 1-1.
  const flushOutgoingCandidates = useCallback(
    (remoteUserId) => {
      const queue = outgoingCandidates.current.get(remoteUserId);
      if (!queue || queue.length === 0) return;
      outgoingCandidates.current.set(remoteUserId, []);
      socket.emit("room-ice-candidates", { to: remoteUserId, candidates: queue });
    },
    [socket]
  );

  const clearStaleConnectionTimer = (remoteUserId) => {
    clearTimeout(staleConnectionTimers.current.get(remoteUserId));
    staleConnectionTimers.current.delete(remoteUserId);
  };

  // If a peer connection hasn't reached "connected" within a few seconds,
  // it's very likely stuck relaying through a congested TURN server (the
  // #1 cause of a group call sitting on "Connecting…" forever — see
  // iceServers.js). Rather than leaving it hung indefinitely, tear it down
  // and re-send a fresh offer. Only the participant with the
  // lexicographically smaller userId re-offers — a simple, deterministic
  // tie-break so both sides don't race to renegotiate at the same time.
  const scheduleStaleConnectionCheck = useCallback(
    (remoteUserId) => {
      clearStaleConnectionTimer(remoteUserId);
      const timer = setTimeout(() => {
        const pc = peerConnections.current.get(remoteUserId);
        if (!pc) return;
        const state = pc.connectionState || pc.iceConnectionState;
        if (state === "connected" || state === "completed") return;
        handleStuckConnection(remoteUserId);
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, 12000);
      staleConnectionTimers.current.set(remoteUserId, timer);
    },
    // handleStuckConnection is defined below and stable via useCallback,
    // but referencing it here would create a circular dependency — it's
    // read fresh from the ref-backed closure each time the timer fires.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const reconnectToPeer = useCallback(
    async (remoteUserId) => {
      const oldPc = peerConnections.current.get(remoteUserId);
      oldPc?.close();
      peerConnections.current.delete(remoteUserId);
      pendingCandidates.current.delete(remoteUserId);
      outgoingCandidates.current.delete(remoteUserId);
      clearTimeout(outgoingFlushTimers.current.get(remoteUserId));
      outgoingFlushTimers.current.delete(remoteUserId);
      try {
        const pc = createPeerConnectionRef.current(remoteUserId);
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit("room-offer", { to: remoteUserId, offer });
        scheduleStaleConnectionCheck(remoteUserId);
      } catch (err) {
        console.error("Reconnect attempt failed for", remoteUserId, err);
      }
    },
    [socket, scheduleStaleConnectionCheck]
  );

  const handleStuckConnection = useCallback(
    (remoteUserId) => {
      setParticipants((prev) =>
        prev[remoteUserId]
          ? { ...prev, [remoteUserId]: { ...prev[remoteUserId], connState: "reconnecting" } }
          : prev
      );
      const isInitiator = user?.id && String(user.id) < String(remoteUserId);
      const attemptsLeft = reconnectAttemptsLeft.current.get(remoteUserId) ?? 2;
      if (attemptsLeft > 0 && isInitiator) {
        reconnectAttemptsLeft.current.set(remoteUserId, attemptsLeft - 1);
        reconnectToPeer(remoteUserId);
      } else if (attemptsLeft <= 0) {
        setParticipants((prev) =>
          prev[remoteUserId]
            ? { ...prev, [remoteUserId]: { ...prev[remoteUserId], connState: "failed" } }
            : prev
        );
      }
      // If not the initiator and retries remain, just wait — the other side
      // (the smaller userId) is the one that re-offers, and our
      // handleRoomOffer will rebuild the connection when it arrives.
    },
    [user, reconnectToPeer]
  );

  // Lets scheduleStaleConnectionCheck's setTimeout call the *current*
  // createPeerConnection/handleStuckConnection without listing them as
  // deps (they're defined in terms of each other) — always read through
  // the ref so the closure never goes stale across re-renders.
  const createPeerConnectionRef = useRef(null);
  const handleStuckConnectionRef = useRef(handleStuckConnection);
  useEffect(() => {
    handleStuckConnectionRef.current = handleStuckConnection;
  }, [handleStuckConnection]);

  const createPeerConnection = useCallback(
    (remoteUserId) => {
      const pc = new RTCPeerConnection(ICE_SERVERS);

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          const queue = outgoingCandidates.current.get(remoteUserId) || [];
          queue.push(event.candidate);
          outgoingCandidates.current.set(remoteUserId, queue);
          clearTimeout(outgoingFlushTimers.current.get(remoteUserId));
          outgoingFlushTimers.current.set(
            remoteUserId,
            setTimeout(() => flushOutgoingCandidates(remoteUserId), 100)
          );
        } else {
          // null candidate = ICE gathering finished for this connection —
          // flush whatever's left immediately rather than waiting out the
          // debounce.
          clearTimeout(outgoingFlushTimers.current.get(remoteUserId));
          flushOutgoingCandidates(remoteUserId);
        }
      };

      const handleStateChange = () => {
        const state = pc.connectionState || pc.iceConnectionState;
        setParticipants((prev) =>
          prev[remoteUserId] ? { ...prev, [remoteUserId]: { ...prev[remoteUserId], connState: state } } : prev
        );
        if (state === "failed") {
          handleStuckConnectionRef.current(remoteUserId);
        }
      };
      pc.onconnectionstatechange = handleStateChange;
      pc.oniceconnectionstatechange = handleStateChange;

      pc.ontrack = (event) => {
        clearStaleConnectionTimer(remoteUserId);
        reconnectAttemptsLeft.current.set(remoteUserId, 2);
        setParticipants((prev) => ({
          ...prev,
          [remoteUserId]: { ...(prev[remoteUserId] || {}), stream: event.streams[0], connState: "connected" },
        }));
        // Voice lag fix: by default a browser's jitter buffer adapts its
        // target delay upward whenever the network looks congested or
        // jittery — trading latency for smoothness. That's the right
        // default for video, but for audio it's the single biggest cause
        // of a call "lagging" even once the connection itself is healthy:
        // the buffer grows to 150-300ms+ and stays there. Requesting a
        // lower playout delay for the audio track trims that base latency;
        // the trade-off is a slightly higher chance of an audible glitch
        // if the network genuinely stalls, which is the right trade for a
        // live conversation. (Chromium-based browsers only — the API
        // isn't part of the WebRTC spec yet, so this is a no-op elsewhere,
        // not a crash risk.)
        const audioReceiver = event.receiver;
        if (audioReceiver?.track?.kind === "audio" && "playoutDelayHint" in audioReceiver) {
          try {
            audioReceiver.playoutDelayHint = 0.05;
          } catch (err) {
            // Unsupported in this browser — falls back to default buffering.
          }
        }
      };

      localStreamRef.current?.getTracks().forEach((track) => {
        const sender = pc.addTrack(track, localStreamRef.current);
        // Voice quality: browsers default a WebRTC audio track to a fairly
        // low bitrate tuned for narrowband speech (~32kbps). Raising the
        // cap gives Opus noticeably more headroom for clarity at a
        // trivial bandwidth cost — cheap to do, easy to miss.
        if (track.kind === "audio") {
          try {
            const params = sender.getParameters();
            if (!params.encodings || params.encodings.length === 0) params.encodings = [{}];
            params.encodings[0].maxBitrate = 64000;
            sender.setParameters(params).catch(() => {});
          } catch (err) {
            // Not fatal — some browsers don't support setParameters this
            // early in the connection lifecycle. The call still works, just
            // at the default bitrate.
          }
        }
        // Voice lag, real cause #1: this is mesh WebRTC (see socket.js),
        // so a device uploads one full video stream *per other
        // participant*, not once total. With no cap, the browser's
        // bandwidth estimator will happily push each of those streams up
        // toward 1.5-2.5mbps on a decent camera — for a 6-person call
        // that's 5 outbound streams competing for upload bandwidth most
        // home/mobile connections don't have (typical home upload is
        // 5-20mbps, and mobile uplinks are often far less). When upload
        // saturates, packets queue and audio — sharing the same
        // congested link — is what visibly lags, even though it's the
        // video that's actually causing the congestion. Capping video
        // bitrate, and capping it harder as the room grows, keeps total
        // upload within what typical connections can actually sustain so
        // audio doesn't get stuck behind it. A real SFU-based app (see
        // the WhatsApp/imo comparison in iceServers.js) doesn't hit this
        // at all, since each device uploads only once regardless of room
        // size — the server does the fan-out.
        if (track.kind === "video") {
          const others = Math.max(1, roomSizeRef.current - 1);
          const capBps = others <= 1 ? 700000 : others <= 3 ? 400000 : 250000;
          try {
            const params = sender.getParameters();
            if (!params.encodings || params.encodings.length === 0) params.encodings = [{}];
            params.encodings[0].maxBitrate = capBps;
            sender.setParameters(params).catch(() => {});
          } catch (err) {
            // Not fatal — falls back to the browser's own (uncapped) estimate.
          }
        }
      });

      peerConnections.current.set(remoteUserId, pc);
      return pc;
    },
    [socket, flushOutgoingCandidates]
  );

  useEffect(() => {
    createPeerConnectionRef.current = createPeerConnection;
  }, [createPeerConnection]);

  // Get camera/mic, then announce ourselves to the room
  useEffect(() => {
    if (!user || !socket) return; // wait for guest login (or real login) to finish
    let cancelled = false;

    (async () => {
      try {
        // Explicit audio constraints (rather than a bare `audio: true`)
        // for voice quality: echo cancellation, noise suppression, and
        // auto gain control aren't guaranteed on by default on every
        // browser/OS combination, and a mono 48kHz capture is what Opus
        // (the codec WebRTC uses) actually encodes at, so asking for it
        // directly avoids an extra unnecessary resample.
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            channelCount: 1,
            sampleRate: 48000,
          },
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        setLocalStream(stream);
        localStreamRef.current = stream;
        socket.emit("join-room", { roomCode, username: user.username });
      } catch (err) {
        console.error("getUserMedia failed:", err.name, err.message);
        setError(
          "Couldn't access camera/mic. Check browser permissions — and note this requires HTTPS (or localhost) if you're on a phone."
        );
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomCode, user, socket]);

  // Room signaling
  useEffect(() => {
    if (!socket) return;

    const handleExistingParticipants = async (list) => {
      // We're the newcomer — introduce ourselves to everyone already here.
      // Each participant gets its own try/catch: one bad connection (e.g.
      // their side just dropped mid-handshake) shouldn't stop us from
      // still connecting to everyone else in the list — letting one
      // failure throw out of the loop used to silently strand every
      // participant after the failed one with no connection at all.
      for (const { userId, username } of list) {
        setParticipants((prev) => ({ ...prev, [userId]: { username, stream: null, connState: "connecting" } }));
        reconnectAttemptsLeft.current.set(userId, 2);
        try {
          const pc = createPeerConnection(userId);
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          socket.emit("room-offer", { to: userId, offer });
          scheduleStaleConnectionCheck(userId);
        } catch (err) {
          console.error("Failed to create offer for", userId, err);
        }
      }
    };

    const handleUserJoined = ({ userId, username }) => {
      // Just for the UI list — we don't initiate; they'll send us an offer
      setParticipants((prev) => ({ ...prev, [userId]: { username, stream: null } }));
    };

    const handleRoomOffer = async ({ from, offer }) => {
      try {
        let pc = peerConnections.current.get(from);
        // A stale connection can still be sitting in the map: either it's
        // fully closed (this peer disconnected and reconnected, with their
        // "user-left-room" and this fresh offer arriving close together),
        // or it's still open but unhealthy (failed/disconnected — the other
        // side is auto-retrying after a stuck "Connecting…", see
        // attemptReconnect below, and just sent us a brand-new offer for
        // the same peer). Reusing either as-is either throws when we try to
        // set a description on it, or silently tries to renegotiate on top
        // of a connection that's already broken — so start clean in both
        // cases instead.
        const staleState = pc?.connectionState || pc?.iceConnectionState;
        if (pc && ["closed", "failed", "disconnected"].includes(staleState)) {
          pc.close();
          peerConnections.current.delete(from);
          pendingCandidates.current.delete(from);
          outgoingCandidates.current.delete(from);
          clearTimeout(outgoingFlushTimers.current.get(from));
          outgoingFlushTimers.current.delete(from);
          pc = null;
        }
        if (!pc) pc = createPeerConnection(from);
        reconnectAttemptsLeft.current.set(from, 2);
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        await flushPending(from, pc);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit("room-answer", { to: from, answer });
        scheduleStaleConnectionCheck(from);
      } catch (err) {
        console.error("Failed to handle offer from", from, err);
      }
    };

    const handleRoomAnswer = async ({ from, answer }) => {
      try {
        const pc = peerConnections.current.get(from);
        if (!pc || pc.signalingState === "closed") return;
        await pc.setRemoteDescription(new RTCSessionDescription(answer));
        await flushPending(from, pc);
      } catch (err) {
        console.error("Failed to handle answer from", from, err);
      }
    };

    const handleIceCandidates = async ({ from, candidates }) => {
      const pc = peerConnections.current.get(from);
      for (const candidate of candidates) {
        if (pc && pc.remoteDescription && pc.remoteDescription.type) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(candidate));
          } catch (err) {
            console.error("Failed to add ICE candidate", err);
          }
        } else {
          const queue = pendingCandidates.current.get(from) || [];
          queue.push(candidate);
          pendingCandidates.current.set(from, queue);
        }
      }
    };

    const handleUserLeft = ({ userId }) => {
      peerConnections.current.get(userId)?.close();
      peerConnections.current.delete(userId);
      pendingCandidates.current.delete(userId);
      outgoingCandidates.current.delete(userId);
      clearTimeout(outgoingFlushTimers.current.get(userId));
      outgoingFlushTimers.current.delete(userId);
      clearStaleConnectionTimer(userId);
      reconnectAttemptsLeft.current.delete(userId);
      setParticipants((prev) => {
        const next = { ...prev };
        delete next[userId];
        // A 1-1 call has exactly one other participant — once they leave,
        // the call is over for both sides, not just theirs. Previously
        // this side just fell back into the "alone" branch, which for a
        // direct call means the ringback tone restarted as if calling them
        // fresh, leaving this user sitting in an empty call indefinitely.
        if (isDirectCall && hadConnectedRef.current && Object.keys(next).length === 0) {
          setCallEnded(true);
        }
        return next;
      });
    };

    const handleRoomError = ({ message }) => setError(message);

    // These two only matter if this room was entered via a 1-1 call
    // invite — if the invited friend is offline, not actually a friend
    // (stale UI), or explicitly declines, the caller is sitting alone in
    // an empty room and needs to be told rather than left waiting forever.
    const handleCallError = ({ message }) => setError(message);
    const handleInviteResponse = ({ accepted }) => {
      if (!accepted) setError("Call declined.");
    };

    const handleChatMessage = (msg) => {
      setChatMessages((prev) => [...prev, msg]);
    };

    socket.on("existing-participants", handleExistingParticipants);
    socket.on("user-joined-room", handleUserJoined);
    socket.on("room-offer", handleRoomOffer);
    socket.on("room-answer", handleRoomAnswer);
    socket.on("room-ice-candidates", handleIceCandidates);
    socket.on("user-left-room", handleUserLeft);
    socket.on("room-error", handleRoomError);
    socket.on("call-error", handleCallError);
    socket.on("call-invite-response", handleInviteResponse);
    socket.on("room-chat-message", handleChatMessage);

    return () => {
      socket.off("existing-participants", handleExistingParticipants);
      socket.off("user-joined-room", handleUserJoined);
      socket.off("room-offer", handleRoomOffer);
      socket.off("room-answer", handleRoomAnswer);
      socket.off("room-ice-candidates", handleIceCandidates);
      socket.off("user-left-room", handleUserLeft);
      socket.off("room-error", handleRoomError);
      socket.off("call-error", handleCallError);
      socket.off("call-invite-response", handleInviteResponse);
      socket.off("room-chat-message", handleChatMessage);
    };
  }, [socket, createPeerConnection, scheduleStaleConnectionCheck]);

  // Recover from a dropped connection instead of leaving the call dead.
  // A brief network blip (phone locks, wifi hiccups, tab backgrounds on
  // mobile) disconnects the socket; the server immediately tells everyone
  // else we left and they close their side's peer connection to us. If we
  // don't re-announce ourselves once we're back, we're stuck: our own
  // stale peer connections never recover, and no one else's do either —
  // the call looks "crashed" even though the page never actually errored.
  // Only reacts to a *reconnect* (disconnect having actually happened
  // first), never the initial connection — that first join is already
  // handled by the getUserMedia effect above, and re-running it here too
  // would double-join and create duplicate peer connections.
  useEffect(() => {
    if (!socket || !user) return;
    let didDisconnect = false;

    const handleDisconnect = () => {
      didDisconnect = true;
    };

    const handleReconnect = () => {
      if (!didDisconnect) return;
      didDisconnect = false;
      if (!localStreamRef.current) return; // camera not even acquired yet — nothing to rejoin with

      // Every existing peer connection is now stale (the other side has
      // already torn theirs down) — close and clear them so the rejoin
      // below starts every connection completely fresh instead of trying
      // to reuse dead ones.
      peerConnections.current.forEach((pc) => pc.close());
      peerConnections.current.clear();
      pendingCandidates.current.clear();
      outgoingCandidates.current.clear();
      outgoingFlushTimers.current.forEach((t) => clearTimeout(t));
      outgoingFlushTimers.current.clear();
      staleConnectionTimers.current.forEach((t) => clearTimeout(t));
      staleConnectionTimers.current.clear();
      reconnectAttemptsLeft.current.clear();
      setParticipants({});
      socket.emit("join-room", { roomCode, username: user.username });
    };

    socket.on("disconnect", handleDisconnect);
    socket.on("connect", handleReconnect);
    return () => {
      socket.off("disconnect", handleDisconnect);
      socket.off("connect", handleReconnect);
    };
  }, [socket, roomCode, user]);

  // Cleanup if the user navigates away (back button, closes tab via React unmount)
  useEffect(() => {
    return () => {
      socket?.emit("leave-room");
      peerConnections.current.forEach((pc) => pc.close());
      peerConnections.current.clear();
      pendingCandidates.current.clear();
      outgoingCandidates.current.clear();
      outgoingFlushTimers.current.forEach((t) => clearTimeout(t));
      outgoingFlushTimers.current.clear();
      staleConnectionTimers.current.forEach((t) => clearTimeout(t));
      staleConnectionTimers.current.clear();
      reconnectAttemptsLeft.current.clear();
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Manual retry button on a tile that's shown "Connection issue" — resets
  // the automatic-retry budget and tries again, same as the automatic path
  // but triggered on demand regardless of which side is the tie-break
  // initiator (a person tapping Retry clearly wants a fresh attempt now).
  const manualRetry = (remoteUserId) => {
    reconnectAttemptsLeft.current.set(remoteUserId, 2);
    setParticipants((prev) =>
      prev[remoteUserId] ? { ...prev, [remoteUserId]: { ...prev[remoteUserId], connState: "reconnecting" } } : prev
    );
    reconnectToPeer(remoteUserId);
  };

  const leaveRoom = () => {
    sessionStorage.removeItem(`directCall:${roomCode}`);
    navigate("/");
  };

  const toggleCamera = () => {
    const track = localStream?.getVideoTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setIsCameraOn(track.enabled);
  };

  const toggleMic = () => {
    const track = localStream?.getAudioTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setIsMicOn(track.enabled);
  };

  const sendChatMessage = (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    socket.emit("room-chat-message", { roomCode, text: chatInput });
    setChatInput("");
  };

  const switchCamera = async () => {
    if (!localStream) return;
    const newFacingMode = facingMode === "user" ? "environment" : "user";
    const oldVideoTrack = localStream.getVideoTracks()[0];

    try {
      // Stop the old camera track BEFORE requesting a new one — many
      // devices (especially Android) won't allow two simultaneous camera
      // sessions, so requesting the new stream while the old one is still
      // active can silently fail or hang.
      oldVideoTrack?.stop();

      const newVideoStream = await navigator.mediaDevices.getUserMedia({
        // "ideal" (not exact) lets the browser fall back gracefully if the
        // requested camera isn't available, instead of hard-rejecting.
        video: { facingMode: { ideal: newFacingMode } },
        audio: false,
      });
      const newVideoTrack = newVideoStream.getVideoTracks()[0];

      // Unlike a 1-1 call there isn't just one connection to update — swap
      // the outgoing video track on every peer connection in the room at
      // once, so everyone keeps seeing us without the call dropping.
      peerConnections.current.forEach((pc) => {
        const sender = pc.getSenders().find((s) => s.track?.kind === "video");
        sender?.replaceTrack(newVideoTrack);
      });

      const combinedStream = new MediaStream([newVideoTrack, ...localStream.getAudioTracks()]);
      localStreamRef.current = combinedStream;
      setLocalStream(combinedStream);
      setFacingMode(newFacingMode);
    } catch (err) {
      console.error("Could not switch camera:", err);
      alert("Couldn't switch camera — this device may only have one camera available.");
    }
  };

  const toggleScreenShare = async () => {
    if (isScreenSharing) {
      // Stop sharing — restore the camera track we set aside, on every
      // peer connection in the room, same pattern as switchCamera.
      const screenTrack = localStream?.getVideoTracks()[0];
      screenTrack?.stop();

      const cameraTrack = cameraTrackRef.current;
      peerConnections.current.forEach((pc) => {
        const sender = pc.getSenders().find((s) => s.track?.kind === "video");
        sender?.replaceTrack(cameraTrack);
      });

      const restoredStream = new MediaStream([cameraTrack, ...localStream.getAudioTracks()]);
      localStreamRef.current = restoredStream;
      setLocalStream(restoredStream);
      setIsScreenSharing(false);
      cameraTrackRef.current = null;
      return;
    }

    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      const screenTrack = screenStream.getVideoTracks()[0];

      // Remember the current camera track so toggling back off can
      // restore it exactly, rather than requesting the camera again
      // (which would need another permission round-trip).
      cameraTrackRef.current = localStream.getVideoTracks()[0];

      peerConnections.current.forEach((pc) => {
        const sender = pc.getSenders().find((s) => s.track?.kind === "video");
        sender?.replaceTrack(screenTrack);
      });

      const sharingStream = new MediaStream([screenTrack, ...localStream.getAudioTracks()]);
      localStreamRef.current = sharingStream;
      setLocalStream(sharingStream);
      setIsScreenSharing(true);

      // The browser's own built-in "Stop sharing" bar can end the share
      // without going through our button at all — listen for that so our
      // state (and everyone else's view) stays in sync either way.
      screenTrack.onended = () => {
        if (cameraTrackRef.current) {
          const pc2Stream = new MediaStream([cameraTrackRef.current, ...localStreamRef.current.getAudioTracks()]);
          peerConnections.current.forEach((pc) => {
            const sender = pc.getSenders().find((s) => s.track?.kind === "video");
            sender?.replaceTrack(cameraTrackRef.current);
          });
          localStreamRef.current = pc2Stream;
          setLocalStream(pc2Stream);
          cameraTrackRef.current = null;
        }
        setIsScreenSharing(false);
      };
    } catch (err) {
      // User cancelled the "choose a window/screen" picker — not an error
      // worth alerting about, just a no-op.
      if (err.name !== "NotAllowedError") {
        console.error("Screen share failed:", err);
      }
    }
  };

  const copyInviteLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      alert("Room link copied!");
    } catch (err) {
      // Clipboard API can silently fail (permissions, insecure context,
      // unsupported browser) — the old code didn't check this at all and
      // always claimed success. Fall back to a manual-copy prompt instead.
      console.error("Clipboard copy failed:", err);
      window.prompt("Copy this link:", window.location.href);
    }
  };

  const otherParticipants = Object.entries(participants); // [userId, {username, stream}][]
  const participantCount = otherParticipants.length + 1; // +1 for self

  if (!user) {
    return (
      <div className="h-dvh flex items-center justify-center bg-callbg text-white p-4">
        <form
          onSubmit={handleGuestJoin}
          className="relative bg-white/5 border border-white/10 rounded-2xl p-6 w-full max-w-sm flex flex-col gap-3 overflow-hidden"
        >
          <span className="absolute top-0 left-6 right-6 h-px rule-gold" />
          <p className="text-xs text-white/55 uppercase tracking-wide">Room</p>
          <h1 className="font-display text-2xl font-semibold tracking-widest -mt-2">{roomCode}</h1>
          <p className="text-sm text-white/50">Enter your name to join this video call.</p>
          <input
            type="text"
            placeholder="Your name"
            value={guestName}
            onChange={(e) => setGuestName(e.target.value)}
            maxLength={30}
            autoFocus
            className="rounded-lg px-3 py-2.5 text-sm text-callbg bg-white placeholder:text-callbg/40 focus:outline-none focus:ring-2 focus:ring-brand-light mt-1"
          />
          {guestError && <p className="text-xs bg-danger/60 rounded px-2 py-1.5">{guestError}</p>}
          <button
            type="submit"
            disabled={guestJoining}
            className="bg-brand-gradient hover:brightness-110 transition-all font-semibold rounded-lg py-2.5 disabled:opacity-60 shadow-neon-brand"
          >
            {guestJoining ? "Joining…" : "Join"}
          </button>
        </form>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-dvh flex flex-col items-center justify-center bg-callbg text-white gap-4 p-6 text-center">
        <p className="text-danger">{error}</p>
        <button
          onClick={leaveRoom}
          className="bg-white/10 hover:bg-white/20 transition-colors rounded-lg px-4 py-2"
        >
          Back
        </button>
      </div>
    );
  }

  if (!localStream) {
    return (
      <div className="h-dvh flex items-center justify-center bg-callbg text-white/60">
        Getting camera ready…
      </div>
    );
  }

  // Self tile, used consistently across the 4/5/6-person grid branches
  const selfTile = (
    <VideoTile
      stream={localStream}
      label={`${user.username} (You)`}
      muted
      cameraOff={!isCameraOn}
      mirrored={facingMode === "user" && !isScreenSharing}
    />
  );

  return (
    <div
      className="h-dvh md:h-screen bg-callbg text-white relative overflow-hidden"
      onPointerDown={bumpControlsVisible}
      onPointerMove={bumpControlsVisible}
    >
      {/* Video layer — always fills the entire screen; header/controls
          float on top of it as overlays rather than pushing it into a
          smaller flex row, matching how WhatsApp/FaceTime call screens work. */}
      <div className="absolute inset-0">
        {participantCount === 1 && (
          // Alone in the room — show self full-screen with a clear invite prompt,
          // since there's nothing else to show yet.
          <>
            <VideoTile
              stream={localStream}
              label={isDirectCall ? null : `${user.username} (You)`}
              muted
              fullSize
              cameraOff={!isCameraOn}
              mirrored={facingMode === "user" && !isScreenSharing}
            />
            <div className="absolute inset-x-0 top-20 md:top-24 flex justify-center px-4">
              <div className="bg-black/60 backdrop-blur-sm rounded-2xl px-4 md:px-6 py-3 md:py-4 text-center max-w-full">
                {isDirectCall ? (
                  callEnded ? (
                    <p className="font-display text-lg md:text-xl font-semibold">
                      Call ended — {directCallOtherName} disconnected
                    </p>
                  ) : (
                    <p className="font-display text-lg md:text-xl font-semibold">
                      Calling {directCallOtherName}…
                    </p>
                  )
                ) : (
                  <>
                    <p className="text-sm text-white/60">Waiting for others to join…</p>
                    <p className="font-display text-xl md:text-2xl font-semibold tracking-[0.15em] md:tracking-[0.2em] mt-1">
                      {roomCode}
                    </p>
                  </>
                )}
              </div>
            </div>
          </>
        )}

        {participantCount === 2 && (
          // Exactly one other person — full-screen for them, a draggable
          // PiP for self (WhatsApp-style: tap and drag your own bubble
          // anywhere on screen), same layout as a 1-1 call.
          <>
            <VideoTile
              stream={otherParticipants[0][1].stream}
              label={otherParticipants[0][1].username}
              connState={otherParticipants[0][1].connState}
              onRetry={() => manualRetry(otherParticipants[0][0])}
              fullSize
            />
            <DraggableSelfView widthClass={isDirectCall ? "w-20 md:w-28" : "w-28 md:w-40"}>
              <VideoTile
                stream={localStream}
                label={isDirectCall ? null : `${user.username} (You)`}
                muted
                cameraOff={!isCameraOn}
                mirrored={facingMode === "user" && !isScreenSharing}
                portrait={isDirectCall}
              />
            </DraggableSelfView>
          </>
        )}

        {participantCount === 3 && (
          // Dedicated layout instead of a generic grid: 2 tiles on top,
          // 1 centered (at half-width, not stretched full-width) below —
          // stretching the 3rd tile to col-span-2 made it visibly taller
          // than the tiles above it since aspect-video scales with width.
          <div className="h-full p-2 md:p-3 pt-20 md:pt-24 pb-24 md:pb-28 flex flex-col gap-2 md:gap-3">
            <div className="flex-1 grid grid-cols-2 gap-2 md:gap-3">
              {selfTile}
              <VideoTile
                stream={otherParticipants[0][1].stream}
                label={otherParticipants[0][1].username}
                connState={otherParticipants[0][1].connState}
                onRetry={() => manualRetry(otherParticipants[0][0])}
              />
            </div>
            <div className="flex-1 flex justify-center">
              <div className="w-full md:w-1/2">
                <VideoTile
                  stream={otherParticipants[1][1].stream}
                  label={otherParticipants[1][1].username}
                  connState={otherParticipants[1][1].connState}
                  onRetry={() => manualRetry(otherParticipants[1][0])}
                />
              </div>
            </div>
          </div>
        )}

        {participantCount === 4 && (
          // Exactly 4 — a clean 2x2, no leftover space
          <div className="h-full p-2 md:p-3 pt-20 md:pt-24 pb-24 md:pb-28 grid grid-cols-2 grid-rows-2 gap-2 md:gap-3">
            {selfTile}
            {otherParticipants.map(([userId, p]) => (
              <VideoTile
                key={userId}
                stream={p.stream}
                label={p.username}
                connState={p.connState}
                onRetry={() => manualRetry(userId)}
              />
            ))}
          </div>
        )}

        {participantCount >= 5 && (
          // 5-6 people — 2 per row on phones (3 columns would squeeze
          // tiles too small on a narrow screen), 3 per row on tablet+
          <div className="h-full overflow-y-auto p-2 md:p-3 pt-20 md:pt-24 pb-24 md:pb-28 grid grid-cols-2 md:grid-cols-3 gap-2 md:gap-3 auto-rows-fr content-center">
            {selfTile}
            {otherParticipants.map(([userId, p]) => (
              <VideoTile
                key={userId}
                stream={p.stream}
                label={p.username}
                connState={p.connState}
                onRetry={() => manualRetry(userId)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Header — floats over the video, fades out with the rest of the
          chrome after a few seconds of inactivity */}
      <div
        className={`absolute top-0 inset-x-0 z-30 bg-gradient-to-b from-black/70 via-black/25 to-transparent px-3 md:px-4 pt-3 pb-8 flex items-center justify-between gap-2 transition-opacity duration-300 ${
          controlsVisible ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      >
        <div className="flex items-baseline gap-2 md:gap-3 min-w-0">
          {isDirectCall ? (
            <span className="font-display font-semibold truncate">
              {directCallOtherName || "Call"}
            </span>
          ) : (
            <>
              <span className="hidden sm:inline text-xs text-white/55 uppercase tracking-wide">
                Room
              </span>
              <span className="font-display font-semibold tracking-widest truncate">
                {roomCode}
              </span>
              <span className="text-xs md:text-sm text-white/60 shrink-0">
                {participantCount}/{MAX_PARTICIPANTS}
              </span>
            </>
          )}
        </div>
        <div className="flex gap-1.5 md:gap-2 shrink-0">
          {!isDirectCall && (
            <button
              onClick={copyInviteLink}
              title="Copy room link"
              className="text-xs md:text-sm bg-white/10 hover:bg-white/20 transition-colors rounded-lg px-2.5 md:px-3 py-1.5 flex items-center gap-1.5"
            >
              <Link2 className="w-3.5 h-3.5" strokeWidth={1.75} />
              <span className="hidden sm:inline">Copy Link</span>
            </button>
          )}
          <button
            onClick={leaveRoom}
            className="text-xs md:text-sm bg-danger hover:opacity-90 transition-opacity rounded-lg px-2.5 md:px-3 py-1.5"
          >
            Leave
          </button>
        </div>
      </div>

      {chatOpen && (
        <div className="absolute inset-0 md:inset-y-0 md:right-0 md:left-auto md:w-80 md:max-w-[80vw] bg-callbg/95 md:bg-black/60 md:backdrop-blur-md flex flex-col md:border-l md:border-white/10 z-40">
          <div className="px-3.5 py-3 border-b border-white/10 font-display font-semibold text-sm flex items-center justify-between">
            Room Chat
            <button
              onClick={() => setChatOpen(false)}
              className="w-7 h-7 flex items-center justify-center rounded-full text-white/50 hover:text-white hover:bg-white/10 transition-colors"
              aria-label="Close chat"
            >
              <X className="w-4 h-4" strokeWidth={1.75} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto thin-scrollbar p-3 flex flex-col gap-2">
            {chatMessages.length === 0 && (
              <p className="text-xs text-white/55 text-center mt-4">No messages yet</p>
            )}
            {chatMessages.map((m, i) => (
              <div key={i} className="text-sm">
                <span className="font-semibold text-gold">{m.username}: </span>
                <span className="break-words text-white/90">{m.text}</span>
              </div>
            ))}
          </div>
          <form onSubmit={sendChatMessage} className="p-2.5 border-t border-white/10 flex gap-2">
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="Message…"
              className="flex-1 min-w-0 bg-white/10 rounded-full px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-light"
            />
            <button
              type="submit"
              aria-label="Send"
              className="w-9 h-9 shrink-0 rounded-full bg-brand-gradient hover:brightness-110 transition-all flex items-center justify-center"
            >
              <Send className="w-4 h-4" strokeWidth={2} />
            </button>
          </form>
        </div>
      )}

      {/* Bottom controls — floats over the video, same fade behavior as the header */}
      <div
        className={`absolute bottom-0 inset-x-0 z-30 bg-gradient-to-t from-black/70 via-black/25 to-transparent pt-8 pb-4 md:pb-5 flex items-center justify-center gap-2 md:gap-3 transition-opacity duration-300 ${
          controlsVisible ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      >
        <button
          onClick={toggleMic}
          title={isMicOn ? "Mute mic" : "Unmute mic"}
          className={`w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center transition-colors ${
            isMicOn ? "bg-white/10 hover:bg-white/20" : "bg-white text-callbg"
          }`}
        >
          {isMicOn ? <Mic className="w-4.5 h-4.5 md:w-5 md:h-5" strokeWidth={1.75} /> : <MicOff className="w-4.5 h-4.5 md:w-5 md:h-5" strokeWidth={1.75} />}
        </button>
        <button
          onClick={toggleCamera}
          title={isCameraOn ? "Turn off camera" : "Turn on camera"}
          className={`w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center transition-colors ${
            isCameraOn ? "bg-white/10 hover:bg-white/20" : "bg-white text-callbg"
          }`}
        >
          {isCameraOn ? <VideoIcon className="w-4.5 h-4.5 md:w-5 md:h-5" strokeWidth={1.75} /> : <VideoOff className="w-4.5 h-4.5 md:w-5 md:h-5" strokeWidth={1.75} />}
        </button>
        <button
          onClick={switchCamera}
          title="Switch camera"
          className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-white/10 hover:bg-white/20 transition-colors flex items-center justify-center"
        >
          <RefreshCw className="w-4.5 h-4.5 md:w-5 md:h-5" strokeWidth={1.75} />
        </button>
        {screenShareSupported && (
          <button
            onClick={toggleScreenShare}
            title={isScreenSharing ? "Stop sharing screen" : "Share screen"}
            className={`hidden md:flex w-10 h-10 md:w-12 md:h-12 rounded-full items-center justify-center transition-all ${
              isScreenSharing ? "bg-gold text-callbg shadow-neon" : "bg-white/10 hover:bg-white/20"
            }`}
          >
            <ScreenShare className="w-4.5 h-4.5 md:w-5 md:h-5" strokeWidth={1.75} />
          </button>
        )}
        <button
          onClick={() => setChatOpen((v) => !v)}
          title="Toggle chat"
          className={`w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center transition-colors ${
            chatOpen ? "bg-brand" : "bg-white/10 hover:bg-white/20"
          }`}
        >
          <MessageCircle className="w-4.5 h-4.5 md:w-5 md:h-5" strokeWidth={1.75} />
        </button>
        <button
          onClick={leaveRoom}
          title="Leave call"
          className="w-12 h-10 md:w-14 md:h-12 rounded-full bg-danger hover:opacity-90 transition-opacity flex items-center justify-center text-white"
        >
          <PhoneOff className="w-5 h-5 md:w-5.5 md:h-5.5" strokeWidth={1.75} />
        </button>
      </div>
    </div>
  );
}
