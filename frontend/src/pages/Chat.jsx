import { useEffect, useState, useCallback, useRef } from "react";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";
import { useSocket } from "../context/SocketContext";
import Sidebar from "../components/Sidebar";
import ChatWindow from "../components/ChatWindow";
import CallModal from "../components/CallModal";
import ICE_SERVERS from "../utils/iceServers";

export default function Chat() {
  const { user, logout } = useAuth();
  const { socket, onlineUsers } = useSocket();

  const [users, setUsers] = useState([]);
  const [activeUser, setActiveUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [isOtherTyping, setIsOtherTyping] = useState(false);

  // --- Call state ---
  const [callStatus, setCallStatus] = useState("idle"); // idle | calling | incoming | in-call
  const [incomingCall, setIncomingCall] = useState(null); // { from, offer, callerName }
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [facingMode, setFacingMode] = useState("user"); // "user" = front camera, "environment" = back
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [isMicOn, setIsMicOn] = useState(true);
  const peerConnection = useRef(null);
  const otherUserId = useRef(null); // whoever we're calling / being called by
  // ICE candidates can arrive before the peer connection exists yet (e.g. the
  // callee hasn't clicked "Accept" while the caller is already trickling
  // candidates) — queue them here and flush once the connection is ready.
  const pendingCandidates = useRef([]);
  // Mirrors localStream in a ref so the signaling effect below doesn't need
  // localStream in its dependency array — without this, the effect would
  // tear down and rebuild every socket listener each time the stream
  // changes (call start, camera switch), which is fragile mid-call.
  const localStreamRef = useRef(null);
  useEffect(() => {
    localStreamRef.current = localStream;
  }, [localStream]);
  // The "incoming-call" socket listener is registered once (effect deps
  // are just [socket]) and never rebuilt, so it would otherwise always see
  // whatever callStatus was at that moment — this ref lets it always read
  // the current value instead.
  const callStatusRef = useRef("idle");
  useEffect(() => {
    callStatusRef.current = callStatus;
  }, [callStatus]);

  // One canonical way to fully tear down and reset call state, built only
  // from refs and setState setters (both stable across renders) so it's
  // never at risk of closing over stale values — used by the manual "End
  // Call" button, remote hang-up/decline, call errors, and ICE failures.
  const resetCallState = useCallback(() => {
    peerConnection.current?.close();
    peerConnection.current = null;
    pendingCandidates.current = [];
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    setLocalStream(null);
    setRemoteStream(null);
    setFacingMode("user");
    setIsCameraOn(true);
    setIsMicOn(true);
    setCallStatus("idle");
    setIncomingCall(null);
    otherUserId.current = null;
  }, []);

  // Load contact list, reusable so friend actions can refresh it
  const refreshUsers = useCallback(() => {
    return api
      .get("/users")
      .then((res) => setUsers(res.data))
      .catch((err) => {
        console.error("Failed to load users:", err.response?.data || err.message);
        setUsers([]);
      });
  }, []);

  useEffect(() => {
    refreshUsers();
  }, [refreshUsers]);

  // Keep the currently-open chat's friend status in sync after any
  // friend-list refresh (e.g. right after accepting their request)
  useEffect(() => {
    if (!activeUser) return;
    const updated = users.find((u) => u._id === activeUser._id);
    if (updated) setActiveUser(updated);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [users]);

  // Load conversation history whenever the active chat changes
  useEffect(() => {
    if (!activeUser) return;
    setMessages([]);
    setIsOtherTyping(false);
    api
      .get(`/messages/${activeUser._id}`)
      .then((res) => setMessages(res.data))
      .catch((err) => {
        console.error("Failed to load messages:", err.response?.data || err.message);
        setMessages([]);
      });
  }, [activeUser]);

  // --- Chat message socket listeners ---
  useEffect(() => {
    if (!socket) return;

    const handleReceive = (message) => {
      setMessages((prev) => {
        if (
          activeUser &&
          (message.sender === activeUser._id || message.receiver === activeUser._id)
        ) {
          return [...prev, message];
        }
        return prev;
      });
    };
    const handleSent = (message) => setMessages((prev) => [...prev, message]);
    const handleMessageError = ({ message }) => alert(message);
    const handleTyping = ({ senderId }) => {
      if (activeUser && senderId === activeUser._id) setIsOtherTyping(true);
    };
    const handleStopTyping = ({ senderId }) => {
      if (activeUser && senderId === activeUser._id) setIsOtherTyping(false);
    };

    socket.on("receive-message", handleReceive);
    socket.on("message-sent", handleSent);
    socket.on("message-error", handleMessageError);
    socket.on("typing", handleTyping);
    socket.on("stop-typing", handleStopTyping);

    return () => {
      socket.off("receive-message", handleReceive);
      socket.off("message-sent", handleSent);
      socket.off("message-error", handleMessageError);
      socket.off("typing", handleTyping);
      socket.off("stop-typing", handleStopTyping);
    };
  }, [socket, activeUser]);

  // --- Call signaling listeners ---
  useEffect(() => {
    if (!socket) return;

    const handleIncomingCall = ({ from, offer, callerName }) => {
      // Without this guard, a second incoming call while we're already
      // calling/in a call would silently overwrite peerConnection.current
      // mid-flight — orphaning the first connection instead of properly
      // closing it. That's exactly the kind of bug that produces
      // "works sometimes, mostly blank" symptoms.
      if (callStatusRef.current !== "idle") {
        socket.emit("decline-call", { to: from });
        return;
      }
      setIncomingCall({ from, offer, callerName });
      otherUserId.current = from;
      setCallStatus("incoming");
    };

    const handleCallAnswered = async ({ answer }) => {
      const pc = peerConnection.current;
      if (!pc) return;
      await pc.setRemoteDescription(new RTCSessionDescription(answer));
      await flushPendingCandidates(pc);
      setCallStatus("in-call");
    };

    const handleIceCandidate = async ({ candidate }) => {
      const pc = peerConnection.current;
      // Only apply a candidate once the connection exists AND has a remote
      // description set — applying earlier throws or silently no-ops,
      // which is exactly what was causing one-sided/no video before.
      if (pc && pc.remoteDescription && pc.remoteDescription.type) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (err) {
          console.error("Failed to add ICE candidate", err);
        }
      } else {
        pendingCandidates.current.push(candidate);
      }
    };

    const handleCallEnded = () => resetCallState();
    const handleCallDeclined = () => resetCallState();
    const handleCallError = ({ message }) => {
      alert(message);
      resetCallState();
    };

    socket.on("incoming-call", handleIncomingCall);
    socket.on("call-answered", handleCallAnswered);
    socket.on("ice-candidate", handleIceCandidate);
    socket.on("call-ended", handleCallEnded);
    socket.on("call-declined", handleCallDeclined);
    socket.on("call-error", handleCallError);

    return () => {
      socket.off("incoming-call", handleIncomingCall);
      socket.off("call-answered", handleCallAnswered);
      socket.off("ice-candidate", handleIceCandidate);
      socket.off("call-ended", handleCallEnded);
      socket.off("call-declined", handleCallDeclined);
      socket.off("call-error", handleCallError);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, resetCallState]);

  const createPeerConnection = (targetUserId) => {
    const pc = new RTCPeerConnection(ICE_SERVERS);

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit("ice-candidate", { to: targetUserId, candidate: event.candidate });
      }
    };

    pc.ontrack = (event) => {
      console.log("Received remote track:", event.track.kind);
      setRemoteStream(event.streams[0]);
    };

    // "connected" = media should be flowing; "failed" means the two peers
    // couldn't find any usable path (even through TURN) and never will
    // without a fresh attempt — unlike "disconnected" (often a brief blip
    // that recovers on its own), "failed" is terminal, so we end the call
    // instead of leaving the UI stuck showing a permanently blank video.
    pc.oniceconnectionstatechange = () => {
      console.log("ICE connection state:", pc.iceConnectionState);
      if (pc.iceConnectionState === "failed") {
        console.error("ICE connection failed — ending call");
        if (otherUserId.current) socket.emit("end-call", { to: otherUserId.current });
        alert("Call connection failed. Please try again.");
        resetCallState();
      }
    };

    // ICE reporting "connected" only means a candidate pair was selected —
    // it doesn't guarantee media packets are actually flowing over it
    // (this can happen with unreliable TURN relays under load). Logging
    // real byte counts every few seconds tells us definitively whether
    // audio/video data is actually arriving, instead of guessing from the
    // connection state alone.
    const statsInterval = setInterval(async () => {
      if (pc.connectionState === "closed") {
        clearInterval(statsInterval);
        return;
      }
      const stats = await pc.getStats();
      stats.forEach((report) => {
        if (report.type === "inbound-rtp" && !report.isRemote) {
          console.log(
            `[stats] inbound ${report.kind}: bytesReceived=${report.bytesReceived}, packetsReceived=${report.packetsReceived}, packetsLost=${report.packetsLost}`
          );
        }
        if (report.type === "candidate-pair" && report.state === "succeeded" && report.nominated) {
          console.log(
            `[stats] active candidate pair: bytesSent=${report.bytesSent}, bytesReceived=${report.bytesReceived}, localCandidateType=${report.localCandidateId}`
          );
        }
      });
    }, 3000);
    pc.addEventListener("connectionstatechange", () => {
      if (pc.connectionState === "closed" || pc.connectionState === "failed") {
        clearInterval(statsInterval);
      }
    });

    return pc;
  };

  // Applies any ICE candidates that arrived before the remote description
  // was set (see handleIceCandidate above for why this queue exists).
  const flushPendingCandidates = async (pc) => {
    while (pendingCandidates.current.length > 0) {
      const candidate = pendingCandidates.current.shift();
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (err) {
        console.error("Failed to add queued ICE candidate", err);
      }
    }
  };

  const startCall = async () => {
    if (!activeUser) return;
    if (callStatus !== "idle") return; // already on a call — the disabled button should prevent this, but guard anyway
    otherUserId.current = activeUser._id;

    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    } catch (err) {
      console.error("getUserMedia failed:", err.name, err.message);
      alert(
        err.name === "NotReadableError"
          ? "Camera is already in use by another tab/app. Close other tabs using the camera and try again."
          : err.name === "NotAllowedError"
          ? "Camera/mic permission was denied. Check your browser's site permissions."
          : "Couldn't access camera/mic. Note: on a phone, this only works over HTTPS (or localhost) — plain http://<LAN-IP> will silently block camera access."
      );
      otherUserId.current = null;
      return;
    }
    setLocalStream(stream);

    // Defensive: close out any stale connection from a previous attempt
    // that didn't get cleaned up, so it can't linger and interfere.
    peerConnection.current?.close();
    pendingCandidates.current = [];

    const pc = createPeerConnection(activeUser._id);
    stream.getTracks().forEach((track) => pc.addTrack(track, stream));
    peerConnection.current = pc;

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    socket.emit("call-user", { to: activeUser._id, offer, callerName: user.username });
    setCallStatus("calling");
  };

  const acceptCall = async () => {
    const { from, offer } = incomingCall;

    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    } catch (err) {
      console.error("getUserMedia failed:", err.name, err.message);
      alert(
        err.name === "NotReadableError"
          ? "Camera is already in use by another tab/app. Close other tabs using the camera and try again."
          : err.name === "NotAllowedError"
          ? "Camera/mic permission was denied. Check your browser's site permissions."
          : "Couldn't access camera/mic. Note: on a phone, this only works over HTTPS (or localhost) — plain http://<LAN-IP> will silently block camera access."
      );
      socket.emit("decline-call", { to: from });
      setIncomingCall(null);
      setCallStatus("idle");
      otherUserId.current = null;
      return;
    }
    setLocalStream(stream);

    // Defensive: close out any stale connection from a previous attempt
    // that didn't get cleaned up, so it can't linger and interfere.
    peerConnection.current?.close();
    pendingCandidates.current = [];

    const pc = createPeerConnection(from);
    stream.getTracks().forEach((track) => pc.addTrack(track, stream));
    peerConnection.current = pc;

    await pc.setRemoteDescription(new RTCSessionDescription(offer));
    await flushPendingCandidates(pc);
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    socket.emit("answer-call", { to: from, answer });
    setCallStatus("in-call");
  };

  const declineCall = () => {
    socket.emit("decline-call", { to: incomingCall.from });
    resetCallState();
  };

  const endCall = () => {
    if (otherUserId.current) {
      socket.emit("end-call", { to: otherUserId.current });
    }
    resetCallState();
  };

  const switchCamera = async () => {
    if (!localStream) return;
    const newFacingMode = facingMode === "user" ? "environment" : "user";

    try {
      const newVideoStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: newFacingMode },
        audio: false,
      });
      const newVideoTrack = newVideoStream.getVideoTracks()[0];

      // Swap the track being sent to the other peer — this is the key call
      // that lets us change cameras mid-call without renegotiating or
      // dropping the connection.
      const sender = peerConnection.current
        ?.getSenders()
        .find((s) => s.track?.kind === "video");
      if (sender) await sender.replaceTrack(newVideoTrack);

      // Rebuild the local preview stream with the new video track (keeps
      // the existing audio track untouched)
      const oldVideoTrack = localStream.getVideoTracks()[0];
      oldVideoTrack?.stop();
      const combinedStream = new MediaStream([
        newVideoTrack,
        ...localStream.getAudioTracks(),
      ]);

      setLocalStream(combinedStream);
      setFacingMode(newFacingMode);
    } catch (err) {
      // Most common cause: device only has one camera (e.g. a laptop)
      console.error("Could not switch camera:", err);
    }
  };

  // Toggling .enabled on a track (rather than removing/re-adding it) is the
  // standard mute/unmute pattern — no renegotiation needed, and the change
  // is instantly visible to the other side since it's the same track.
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

  const handleAddFriend = async (userId) => {
    try {
      await api.post(`/friends/request/${userId}`);
      refreshUsers();
    } catch (err) {
      alert(err.response?.data?.message || "Failed to send request");
    }
  };

  const handleAcceptRequest = async (requestId) => {
    try {
      await api.post(`/friends/accept/${requestId}`);
      refreshUsers();
    } catch (err) {
      alert(err.response?.data?.message || "Failed to accept request");
    }
  };

  const handleRejectRequest = async (requestId) => {
    try {
      await api.post(`/friends/reject/${requestId}`);
      refreshUsers();
    } catch (err) {
      alert(err.response?.data?.message || "Failed to reject request");
    }
  };

  const sendMessage = useCallback(
    (text) => {
      if (!socket || !activeUser) return;
      socket.emit("send-message", { receiverId: activeUser._id, text, type: "text" });
    },
    [socket, activeUser]
  );

  const sendImage = useCallback(
    (mediaUrl) => {
      if (!socket || !activeUser) return;
      socket.emit("send-message", { receiverId: activeUser._id, type: "image", mediaUrl });
    },
    [socket, activeUser]
  );

  const handleTyping = () => {
    if (socket && activeUser) socket.emit("typing", { receiverId: activeUser._id });
  };
  const handleStopTyping = () => {
    if (socket && activeUser) socket.emit("stop-typing", { receiverId: activeUser._id });
  };

  const callerDisplayName =
    callStatus === "incoming" ? incomingCall?.callerName : activeUser?.username;

  return (
    <div className="flex h-dvh md:h-screen">
      <div className={`${activeUser ? "hidden md:flex" : "flex"} w-full md:w-auto`}>
        <Sidebar
          users={users}
          activeUser={activeUser}
          onSelect={setActiveUser}
          onlineUsers={onlineUsers}
          currentUser={user}
          onLogout={logout}
          onAddFriend={handleAddFriend}
          onAcceptRequest={handleAcceptRequest}
          onRejectRequest={handleRejectRequest}
        />
      </div>
      <div className={`${activeUser ? "flex" : "hidden md:flex"} flex-1`}>
        <ChatWindow
          activeUser={activeUser}
          messages={messages}
          currentUserId={user.id}
          onSend={sendMessage}
          onSendImage={sendImage}
          onTyping={handleTyping}
          onStopTyping={handleStopTyping}
          isOtherTyping={isOtherTyping}
          onStartCall={startCall}
          isUserOnline={activeUser ? onlineUsers.includes(activeUser._id) : false}
          onBack={() => setActiveUser(null)}
        />
      </div>
      <CallModal
        callStatus={callStatus}
        callerName={callerDisplayName}
        localStream={localStream}
        remoteStream={remoteStream}
        onAccept={acceptCall}
        onDecline={declineCall}
        onEnd={endCall}
        onSwitchCamera={switchCamera}
        facingMode={facingMode}
        isCameraOn={isCameraOn}
        isMicOn={isMicOn}
        onToggleCamera={toggleCamera}
        onToggleMic={toggleMic}
      />
    </div>
  );
}
