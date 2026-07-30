import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useSocket } from "../context/SocketContext";
import ICE_SERVERS from "../utils/iceServers";

// Keep in sync with MAX_ROOM_SIZE on the backend — this is just for the UI
// counter, the backend is what actually enforces the cap.
const MAX_PARTICIPANTS = 6;

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
          : "relative bg-black rounded-lg overflow-hidden aspect-video flex items-center justify-center border-2 border-white/80"
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
        <span className="text-gray-400 text-sm">Connecting…</span>
      )}
      {cameraOff && (
        <div className="absolute inset-0 bg-neutral-800 flex items-center justify-center text-3xl">
          📷🚫
        </div>
      )}
      <span className="absolute bottom-1 left-1 bg-black/60 text-white text-xs px-2 py-0.5 rounded">
        {label}
      </span>
    </div>
  );
}

export default function GroupCall() {
  const { roomCode } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { socket } = useSocket();

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
  }, [roomCode]);

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
    socket.on("room-chat-message", handleChatMessage);

    return () => {
      socket.off("existing-participants", handleExistingParticipants);
      socket.off("user-joined-room", handleUserJoined);
      socket.off("room-offer", handleRoomOffer);
      socket.off("room-answer", handleRoomAnswer);
      socket.off("room-ice-candidate", handleIceCandidate);
      socket.off("user-left-room", handleUserLeft);
      socket.off("room-error", handleRoomError);
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

  const leaveRoom = () => navigate("/");

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

  const copyInviteLink = () => {
    navigator.clipboard.writeText(window.location.href);
    alert("Room link copied!");
  };

  const otherParticipants = Object.entries(participants); // [userId, {username, stream}][]
  const participantCount = otherParticipants.length + 1; // +1 for self

  if (error) {
    return (
      <div className="h-dvh flex flex-col items-center justify-center bg-neutral-900 text-white gap-4 p-6 text-center">
        <p className="text-red-300">{error}</p>
        <button onClick={leaveRoom} className="bg-neutral-700 hover:bg-neutral-600 rounded px-4 py-2">
          Back
        </button>
      </div>
    );
  }

  if (!localStream) {
    return (
      <div className="h-dvh flex items-center justify-center bg-neutral-900 text-white">
        Getting camera ready…
      </div>
    );
  }

  // Grid columns scale with how many people are actually in the room —
  // 3-4 people fit comfortably 2-per-row, 5-6 fit better 3-per-row.
  const gridColsClass = participantCount <= 4 ? "grid-cols-2" : "grid-cols-3";

  return (
    <div className="h-dvh md:h-screen bg-neutral-900 text-white flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 bg-neutral-800">
        <div>
          <span className="font-semibold">Room: {roomCode}</span>
          <span className="text-sm text-gray-400 ml-3">
            {participantCount}/{MAX_PARTICIPANTS}
          </span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={copyInviteLink}
            className="text-sm bg-neutral-700 hover:bg-neutral-600 rounded px-3 py-1.5"
          >
            Copy Link
          </button>
          <button onClick={leaveRoom} className="text-sm bg-red-600 hover:bg-red-700 rounded px-3 py-1.5">
            Leave
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
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
              <div className="absolute inset-x-0 top-6 flex justify-center">
                <div className="bg-black/70 rounded-xl px-5 py-3 text-center">
                  <p className="text-sm text-gray-300">Waiting for others to join…</p>
                  <p className="text-lg font-bold tracking-widest mt-1">{roomCode}</p>
                </div>
              </div>
            </>
          )}

          {participantCount === 2 && (
            // Exactly one other person — full-screen for them, small PiP for self,
            // same layout as the 1-1 call.
            <>
              <VideoTile
                stream={otherParticipants[0][1].stream}
                label={otherParticipants[0][1].username}
                fullSize
              />
              <div className="absolute top-4 right-4 w-28 md:w-40">
                <VideoTile
                  stream={localStream}
                  label={`${user.username} (You)`}
                  muted
                  cameraOff={!isCameraOn}
                  mirrored={facingMode === "user"}
                />
              </div>
            </>
          )}

          {participantCount >= 3 && (
            // 3+ people — everyone (including self) as equal tiles in a grid.
            // For exactly 3, the 3rd tile spans both columns so it doesn't
            // sit oddly half-width alone on its own row (matches the
            // WhatsApp/Zoom pattern of "2 up top, 1 full-width below").
            <div
              className={`h-full overflow-y-auto p-3 grid ${gridColsClass} gap-3 auto-rows-fr place-content-center`}
            >
              <VideoTile
                stream={localStream}
                label={`${user.username} (You)`}
                muted
                cameraOff={!isCameraOn}
                mirrored={facingMode === "user"}
              />
              {otherParticipants.map(([userId, p], i) => (
                <div
                  key={userId}
                  className={
                    participantCount === 3 && i === otherParticipants.length - 1
                      ? "col-span-2"
                      : ""
                  }
                >
                  <VideoTile stream={p.stream} label={p.username} />
                </div>
              ))}
            </div>
          )}
        </div>

        {chatOpen && (
          <div className="w-72 max-w-[80vw] bg-neutral-800 flex flex-col border-l border-neutral-700">
            <div className="px-3 py-2 border-b border-neutral-700 font-semibold text-sm">
              Room Chat
            </div>
            <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2">
              {chatMessages.length === 0 && (
                <p className="text-xs text-gray-500 text-center mt-4">No messages yet</p>
              )}
              {chatMessages.map((m, i) => (
                <div key={i} className="text-sm">
                  <span className="font-semibold text-brand">{m.username}: </span>
                  <span className="break-words">{m.text}</span>
                </div>
              ))}
            </div>
            <form onSubmit={sendChatMessage} className="p-2 border-t border-neutral-700 flex gap-2">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Message…"
                className="flex-1 min-w-0 bg-neutral-700 rounded-full px-3 py-1.5 text-sm focus:outline-none"
              />
              <button
                type="submit"
                className="bg-brand hover:bg-brand-dark rounded-full px-3 py-1.5 text-sm"
              >
                Send
              </button>
            </form>
          </div>
        )}
      </div>

      <div className="bg-neutral-900 py-4 flex items-center justify-center gap-3">
        <button
          onClick={toggleMic}
          title={isMicOn ? "Mute mic" : "Unmute mic"}
          className={`w-12 h-12 rounded-full flex items-center justify-center text-lg ${
            isMicOn ? "bg-neutral-700 hover:bg-neutral-600" : "bg-white text-black"
          }`}
        >
          {isMicOn ? "🎤" : "🔇"}
        </button>
        <button
          onClick={toggleCamera}
          title={isCameraOn ? "Turn off camera" : "Turn on camera"}
          className={`w-12 h-12 rounded-full flex items-center justify-center text-lg ${
            isCameraOn ? "bg-neutral-700 hover:bg-neutral-600" : "bg-white text-black"
          }`}
        >
          {isCameraOn ? "📷" : "🚫"}
        </button>
        <button
          onClick={switchCamera}
          title="Switch camera"
          className="w-12 h-12 rounded-full bg-neutral-700 hover:bg-neutral-600 flex items-center justify-center text-lg"
        >
          🔄
        </button>
        <button
          onClick={() => setChatOpen((v) => !v)}
          title="Toggle chat"
          className={`w-12 h-12 rounded-full flex items-center justify-center text-lg ${
            chatOpen ? "bg-brand" : "bg-neutral-700 hover:bg-neutral-600"
          }`}
        >
          💬
        </button>
        <button
          onClick={leaveRoom}
          title="Leave call"
          className="w-14 h-12 rounded-full bg-red-600 hover:bg-red-700 flex items-center justify-center text-white text-xl"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
