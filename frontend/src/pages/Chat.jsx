import { useEffect, useState, useCallback, useRef } from "react";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";
import { useSocket } from "../context/SocketContext";
import Sidebar from "../components/Sidebar";
import ChatWindow from "../components/ChatWindow";
import CallModal from "../components/CallModal";

const ICE_SERVERS = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
  // Note: a STUN server alone is enough for most direct peer-to-peer
  // connections. Some networks (strict NATs/corporate firewalls) need a
  // TURN server to relay media — skipped here to keep the project simple.
};

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
  const peerConnection = useRef(null);
  const otherUserId = useRef(null); // whoever we're calling / being called by
  // ICE candidates can arrive before the peer connection exists yet (e.g. the
  // callee hasn't clicked "Accept" while the caller is already trickling
  // candidates) — queue them here and flush once the connection is ready.
  const pendingCandidates = useRef([]);

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
    api.get(`/messages/${activeUser._id}`).then((res) => setMessages(res.data));
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
    const handleTyping = ({ senderId }) => {
      if (activeUser && senderId === activeUser._id) setIsOtherTyping(true);
    };
    const handleStopTyping = ({ senderId }) => {
      if (activeUser && senderId === activeUser._id) setIsOtherTyping(false);
    };

    socket.on("receive-message", handleReceive);
    socket.on("message-sent", handleSent);
    socket.on("typing", handleTyping);
    socket.on("stop-typing", handleStopTyping);

    return () => {
      socket.off("receive-message", handleReceive);
      socket.off("message-sent", handleSent);
      socket.off("typing", handleTyping);
      socket.off("stop-typing", handleStopTyping);
    };
  }, [socket, activeUser]);

  // --- Call signaling listeners ---
  useEffect(() => {
    if (!socket) return;

    const cleanupCall = () => {
      peerConnection.current?.close();
      peerConnection.current = null;
      pendingCandidates.current = [];
      localStream?.getTracks().forEach((t) => t.stop());
      setLocalStream(null);
      setRemoteStream(null);
      setFacingMode("user");
      setCallStatus("idle");
      setIncomingCall(null);
      otherUserId.current = null;
    };

    const handleIncomingCall = ({ from, offer, callerName }) => {
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

    const handleCallEnded = () => cleanupCall();
    const handleCallDeclined = () => cleanupCall();
    const handleCallError = ({ message }) => {
      alert(message);
      cleanupCall();
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
  }, [socket, localStream]);

  const createPeerConnection = (targetUserId) => {
    const pc = new RTCPeerConnection(ICE_SERVERS);

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit("ice-candidate", { to: targetUserId, candidate: event.candidate });
      }
    };

    pc.ontrack = (event) => {
      setRemoteStream(event.streams[0]);
    };

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
    otherUserId.current = activeUser._id;

    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    setLocalStream(stream);

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
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    setLocalStream(stream);

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
    pendingCandidates.current = [];
    setIncomingCall(null);
    setCallStatus("idle");
    otherUserId.current = null;
  };

  const endCall = () => {
    if (otherUserId.current) {
      socket.emit("end-call", { to: otherUserId.current });
    }
    peerConnection.current?.close();
    peerConnection.current = null;
    pendingCandidates.current = [];
    localStream?.getTracks().forEach((t) => t.stop());
    setLocalStream(null);
    setRemoteStream(null);
    setFacingMode("user");
    setCallStatus("idle");
    setIncomingCall(null);
    otherUserId.current = null;
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
      />
    </div>
  );
}
