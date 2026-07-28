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
  const peerConnection = useRef(null);
  const otherUserId = useRef(null); // whoever we're calling / being called by

  // Load contact list once
  useEffect(() => {
    api
      .get("/users")
      .then((res) => setUsers(res.data))
      .catch((err) => {
        console.error("Failed to load users:", err.response?.data || err.message);
        setUsers([]);
      });
  }, []);

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
      localStream?.getTracks().forEach((t) => t.stop());
      setLocalStream(null);
      setRemoteStream(null);
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
      await peerConnection.current?.setRemoteDescription(new RTCSessionDescription(answer));
      setCallStatus("in-call");
    };

    const handleIceCandidate = async ({ candidate }) => {
      try {
        await peerConnection.current?.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (err) {
        console.error("Failed to add ICE candidate", err);
      }
    };

    const handleCallEnded = () => cleanupCall();
    const handleCallDeclined = () => cleanupCall();

    socket.on("incoming-call", handleIncomingCall);
    socket.on("call-answered", handleCallAnswered);
    socket.on("ice-candidate", handleIceCandidate);
    socket.on("call-ended", handleCallEnded);
    socket.on("call-declined", handleCallDeclined);

    return () => {
      socket.off("incoming-call", handleIncomingCall);
      socket.off("call-answered", handleCallAnswered);
      socket.off("ice-candidate", handleIceCandidate);
      socket.off("call-ended", handleCallEnded);
      socket.off("call-declined", handleCallDeclined);
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
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    socket.emit("answer-call", { to: from, answer });
    setCallStatus("in-call");
  };

  const declineCall = () => {
    socket.emit("decline-call", { to: incomingCall.from });
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
    localStream?.getTracks().forEach((t) => t.stop());
    setLocalStream(null);
    setRemoteStream(null);
    setCallStatus("idle");
    setIncomingCall(null);
    otherUserId.current = null;
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
    <div className="chat-page">
      <Sidebar
        users={users}
        activeUser={activeUser}
        onSelect={setActiveUser}
        onlineUsers={onlineUsers}
        currentUser={user}
        onLogout={logout}
      />
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
      />
      <CallModal
        callStatus={callStatus}
        callerName={callerDisplayName}
        localStream={localStream}
        remoteStream={remoteStream}
        onAccept={acceptCall}
        onDecline={declineCall}
        onEnd={endCall}
      />
    </div>
  );
}
