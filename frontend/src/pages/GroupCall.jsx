import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useSocket } from "../context/SocketContext";
import ICE_SERVERS from "../utils/iceServers";

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
    setPos({ top: 16, left: parentRect.width - elRect.width - 16 });
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

function VideoTile({ stream, label, muted, fullSize, cameraOff, mirrored }) {
  const videoRef = useRef(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <div
      className={
        fullSize
          ? "relative w-full h-full bg-black overflow-hidden flex items-center justify-center"
          : "relative bg-black rounded-xl overflow-hidden aspect-video flex items-center justify-center ring-1 ring-white/10"
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
      ) : (
        <span className="text-white/40 text-sm">Connecting…</span>
      )}
      {cameraOff && (
        <div className="absolute inset-0 bg-ink flex items-center justify-center text-3xl">
          📷🚫
        </div>
      )}
      <span className="absolute bottom-2 left-2 bg-black/50 backdrop-blur-sm text-white text-xs px-2 py-0.5 rounded-md">
        {label}
      </span>
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
  const [error, setError] = useState("");
  const [facingMode, setFacingMode] = useState("user");
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [isMicOn, setIsMicOn] = useState(true);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState([]); // { senderId, username, text, timestamp }
  const [chatInput, setChatInput] = useState("");

  const peerConnections = useRef(new Map()); // userId -> RTCPeerConnection
  const pendingCandidates = useRef(new Map()); // userId -> queued candidates
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

  const createPeerConnection = useCallback(
    (remoteUserId) => {
      const pc = new RTCPeerConnection(ICE_SERVERS);

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit("room-ice-candidate", { to: remoteUserId, candidate: event.candidate });
        }
      };

      pc.ontrack = (event) => {
        setParticipants((prev) => ({
          ...prev,
          [remoteUserId]: { ...(prev[remoteUserId] || {}), stream: event.streams[0] },
        }));
      };

      localStreamRef.current?.getTracks().forEach((track) => {
        pc.addTrack(track, localStreamRef.current);
      });

      peerConnections.current.set(remoteUserId, pc);
      return pc;
    },
    [socket]
  );

  // Get camera/mic, then announce ourselves to the room
  useEffect(() => {
    if (!user || !socket) return; // wait for guest login (or real login) to finish
    let cancelled = false;

    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
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
      // We're the newcomer — introduce ourselves to everyone already here
      for (const { userId, username } of list) {
        setParticipants((prev) => ({ ...prev, [userId]: { username, stream: null } }));
        const pc = createPeerConnection(userId);
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit("room-offer", { to: userId, offer });
      }
    };

    const handleUserJoined = ({ userId, username }) => {
      // Just for the UI list — we don't initiate; they'll send us an offer
      setParticipants((prev) => ({ ...prev, [userId]: { username, stream: null } }));
    };

    const handleRoomOffer = async ({ from, offer }) => {
      let pc = peerConnections.current.get(from);
      if (!pc) pc = createPeerConnection(from);
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      await flushPending(from, pc);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit("room-answer", { to: from, answer });
    };

    const handleRoomAnswer = async ({ from, answer }) => {
      const pc = peerConnections.current.get(from);
      if (!pc) return;
      await pc.setRemoteDescription(new RTCSessionDescription(answer));
      await flushPending(from, pc);
    };

    const handleIceCandidate = async ({ from, candidate }) => {
      const pc = peerConnections.current.get(from);
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
    };

    const handleUserLeft = ({ userId }) => {
      peerConnections.current.get(userId)?.close();
      peerConnections.current.delete(userId);
      pendingCandidates.current.delete(userId);
      setParticipants((prev) => {
        const next = { ...prev };
        delete next[userId];
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
    socket.on("room-ice-candidate", handleIceCandidate);
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
      socket.off("room-ice-candidate", handleIceCandidate);
      socket.off("user-left-room", handleUserLeft);
      socket.off("room-error", handleRoomError);
      socket.off("call-error", handleCallError);
      socket.off("call-invite-response", handleInviteResponse);
      socket.off("room-chat-message", handleChatMessage);
    };
  }, [socket, createPeerConnection]);

  // Cleanup if the user navigates away (back button, closes tab via React unmount)
  useEffect(() => {
    return () => {
      socket?.emit("leave-room");
      peerConnections.current.forEach((pc) => pc.close());
      peerConnections.current.clear();
      pendingCandidates.current.clear();
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      <div className="h-dvh flex items-center justify-center bg-ink text-white p-4">
        <form
          onSubmit={handleGuestJoin}
          className="bg-white/5 border border-white/10 rounded-2xl p-6 w-full max-w-sm flex flex-col gap-3"
        >
          <p className="text-xs text-white/40 uppercase tracking-wide">Room</p>
          <h1 className="font-display text-2xl font-semibold tracking-widest -mt-2">{roomCode}</h1>
          <p className="text-sm text-white/50">Enter your name to join this video call.</p>
          <input
            type="text"
            placeholder="Your name"
            value={guestName}
            onChange={(e) => setGuestName(e.target.value)}
            maxLength={30}
            autoFocus
            className="rounded-lg px-3 py-2.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand-light mt-1"
          />
          {guestError && <p className="text-xs bg-danger/60 rounded px-2 py-1.5">{guestError}</p>}
          <button
            type="submit"
            disabled={guestJoining}
            className="bg-brand hover:bg-brand-dark transition-colors font-semibold rounded-lg py-2.5 disabled:opacity-60"
          >
            {guestJoining ? "Joining…" : "Join"}
          </button>
        </form>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-dvh flex flex-col items-center justify-center bg-ink text-white gap-4 p-6 text-center">
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
      <div className="h-dvh flex items-center justify-center bg-ink text-white/60">
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
      mirrored={facingMode === "user"}
    />
  );

  return (
    <div className="h-dvh md:h-screen bg-ink text-white flex flex-col">
      <div className="flex items-center justify-between gap-2 px-3 md:px-4 py-2.5 md:py-3 bg-black/30 border-b border-white/5">
        <div className="flex items-baseline gap-2 md:gap-3 min-w-0">
          {isDirectCall ? (
            <span className="font-display font-semibold truncate">
              {directCallOtherName || "Call"}
            </span>
          ) : (
            <>
              <span className="hidden sm:inline text-xs text-white/40 uppercase tracking-wide">
                Room
              </span>
              <span className="font-display font-semibold tracking-widest truncate">
                {roomCode}
              </span>
              <span className="text-xs md:text-sm text-white/40 shrink-0">
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
              className="text-xs md:text-sm bg-white/10 hover:bg-white/20 transition-colors rounded-lg px-2.5 md:px-3 py-1.5"
            >
              <span className="sm:hidden">🔗</span>
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

      <div className="flex-1 flex overflow-hidden relative">
        <div className="flex-1 relative">
          {participantCount === 1 && (
            // Alone in the room — show self full-screen with a clear invite prompt,
            // since there's nothing else to show yet.
            <>
              <VideoTile
                stream={localStream}
                label={`${user.username} (You)`}
                muted
                fullSize
                cameraOff={!isCameraOn}
                mirrored={facingMode === "user"}
              />
              <div className="absolute inset-x-0 top-6 md:top-8 flex justify-center px-4">
                <div className="bg-black/60 backdrop-blur-sm rounded-2xl px-4 md:px-6 py-3 md:py-4 text-center max-w-full">
                  {isDirectCall ? (
                    <p className="font-display text-lg md:text-xl font-semibold">
                      Calling {directCallOtherName}…
                    </p>
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
                fullSize
              />
              <DraggableSelfView widthClass="w-24 md:w-40">
                <VideoTile
                  stream={localStream}
                  label={`${user.username} (You)`}
                  muted
                  cameraOff={!isCameraOn}
                  mirrored={facingMode === "user"}
                />
              </DraggableSelfView>
            </>
          )}

          {participantCount === 3 && (
            // Dedicated layout instead of a generic grid: 2 tiles on top,
            // 1 centered (at half-width, not stretched full-width) below —
            // stretching the 3rd tile to col-span-2 made it visibly taller
            // than the tiles above it since aspect-video scales with width.
            <div className="h-full p-2 md:p-3 flex flex-col gap-2 md:gap-3">
              <div className="flex-1 grid grid-cols-2 gap-2 md:gap-3">
                {selfTile}
                <VideoTile stream={otherParticipants[0][1].stream} label={otherParticipants[0][1].username} />
              </div>
              <div className="flex-1 flex justify-center">
                <div className="w-full md:w-1/2">
                  <VideoTile stream={otherParticipants[1][1].stream} label={otherParticipants[1][1].username} />
                </div>
              </div>
            </div>
          )}

          {participantCount === 4 && (
            // Exactly 4 — a clean 2x2, no leftover space
            <div className="h-full p-2 md:p-3 grid grid-cols-2 grid-rows-2 gap-2 md:gap-3">
              {selfTile}
              {otherParticipants.map(([userId, p]) => (
                <VideoTile key={userId} stream={p.stream} label={p.username} />
              ))}
            </div>
          )}

          {participantCount >= 5 && (
            // 5-6 people — 2 per row on phones (3 columns would squeeze
            // tiles too small on a narrow screen), 3 per row on tablet+
            <div className="h-full overflow-y-auto p-2 md:p-3 grid grid-cols-2 md:grid-cols-3 gap-2 md:gap-3 auto-rows-fr content-center">
              {selfTile}
              {otherParticipants.map(([userId, p]) => (
                <VideoTile key={userId} stream={p.stream} label={p.username} />
              ))}
            </div>
          )}
        </div>

        {chatOpen && (
          <div className="absolute inset-0 md:static md:w-72 md:max-w-[80vw] bg-ink md:bg-black/40 backdrop-blur-sm flex flex-col border-l border-white/10 z-10">
            <div className="px-3 py-2.5 border-b border-white/10 font-display font-semibold text-sm flex items-center justify-between">
              Room Chat
              <button
                onClick={() => setChatOpen(false)}
                className="md:hidden text-white/50 hover:text-white text-lg leading-none"
                aria-label="Close chat"
              >
                ✕
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2">
              {chatMessages.length === 0 && (
                <p className="text-xs text-white/30 text-center mt-4">No messages yet</p>
              )}
              {chatMessages.map((m, i) => (
                <div key={i} className="text-sm">
                  <span className="font-semibold text-brand-light">{m.username}: </span>
                  <span className="break-words text-white/90">{m.text}</span>
                </div>
              ))}
            </div>
            <form onSubmit={sendChatMessage} className="p-2 border-t border-white/10 flex gap-2">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Message…"
                className="flex-1 min-w-0 bg-white/10 rounded-full px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-light"
              />
              <button
                type="submit"
                className="bg-brand hover:bg-brand-dark transition-colors rounded-full px-3 py-1.5 text-sm"
              >
                Send
              </button>
            </form>
          </div>
        )}
      </div>

      <div className="bg-black/30 border-t border-white/5 py-3 md:py-4 flex items-center justify-center gap-2 md:gap-3">
        <button
          onClick={toggleMic}
          title={isMicOn ? "Mute mic" : "Unmute mic"}
          className={`w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center text-base md:text-lg transition-colors ${
            isMicOn ? "bg-white/10 hover:bg-white/20" : "bg-white text-ink"
          }`}
        >
          {isMicOn ? "🎤" : "🔇"}
        </button>
        <button
          onClick={toggleCamera}
          title={isCameraOn ? "Turn off camera" : "Turn on camera"}
          className={`w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center text-base md:text-lg transition-colors ${
            isCameraOn ? "bg-white/10 hover:bg-white/20" : "bg-white text-ink"
          }`}
        >
          {isCameraOn ? "📷" : "🚫"}
        </button>
        <button
          onClick={switchCamera}
          title="Switch camera"
          className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-white/10 hover:bg-white/20 transition-colors flex items-center justify-center text-base md:text-lg"
        >
          🔄
        </button>
        <button
          onClick={() => setChatOpen((v) => !v)}
          title="Toggle chat"
          className={`w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center text-base md:text-lg transition-colors ${
            chatOpen ? "bg-brand" : "bg-white/10 hover:bg-white/20"
          }`}
        >
          💬
        </button>
        <button
          onClick={leaveRoom}
          title="Leave call"
          className="w-12 h-10 md:w-14 md:h-12 rounded-full bg-danger hover:opacity-90 transition-opacity flex items-center justify-center text-white text-lg md:text-xl"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
