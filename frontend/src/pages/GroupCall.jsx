import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useSocket } from "../context/SocketContext";
import ICE_SERVERS from "../utils/iceServers";

// Keep in sync with MAX_ROOM_SIZE on the backend — this is just for the UI
// counter, the backend is what actually enforces the cap.
const MAX_PARTICIPANTS = 6;

function VideoTile({ stream, label, muted }) {
  const videoRef = useRef(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <div className="relative bg-black rounded-lg overflow-hidden aspect-video flex items-center justify-center">
      {stream ? (
        <video ref={videoRef} autoPlay playsInline muted={muted} className="w-full h-full object-cover" />
      ) : (
        <span className="text-gray-400 text-sm">Connecting…</span>
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

    socket.on("existing-participants", handleExistingParticipants);
    socket.on("user-joined-room", handleUserJoined);
    socket.on("room-offer", handleRoomOffer);
    socket.on("room-answer", handleRoomAnswer);
    socket.on("room-ice-candidate", handleIceCandidate);
    socket.on("user-left-room", handleUserLeft);
    socket.on("room-error", handleRoomError);

    return () => {
      socket.off("existing-participants", handleExistingParticipants);
      socket.off("user-joined-room", handleUserJoined);
      socket.off("room-offer", handleRoomOffer);
      socket.off("room-answer", handleRoomAnswer);
      socket.off("room-ice-candidate", handleIceCandidate);
      socket.off("user-left-room", handleUserLeft);
      socket.off("room-error", handleRoomError);
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

  const copyInviteLink = () => {
    navigator.clipboard.writeText(window.location.href);
    alert("Room link copied!");
  };

  const participantCount = Object.keys(participants).length + 1; // +1 for self

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

      <div className="flex-1 overflow-y-auto p-3 grid grid-cols-2 md:grid-cols-3 gap-3 content-start">
        <VideoTile stream={localStream} label={`${user.username} (You)`} muted />
        {Object.entries(participants).map(([userId, p]) => (
          <VideoTile key={userId} stream={p.stream} label={p.username} />
        ))}
      </div>
    </div>
  );
}
