import { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "./AuthContext";
import { useSocket } from "./SocketContext";
import ICE_SERVERS from "../utils/iceServers";

const CallContext = createContext(null);

// Every log line is prefixed so it's trivially greppable in the console —
// if a call fails, the sequence of [call] lines shows exactly which step
// it got to and which one it never reached.
const log = (...args) => console.log("[call]", ...args);

export function CallProvider({ children }) {
  const { user } = useAuth();
  const { socket } = useSocket();
  const navigate = useNavigate();
  const location = useLocation();

  const [callStatus, setCallStatus] = useState("idle"); // idle | calling | incoming | in-call
  const [incomingCall, setIncomingCall] = useState(null); // { from, offer, callerName }
  const [otherUserName, setOtherUserName] = useState("");
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [facingMode, setFacingMode] = useState("user");
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [isMicOn, setIsMicOn] = useState(true);

  const peerConnection = useRef(null);
  const otherUserId = useRef(null);
  const pendingCandidates = useRef([]);
  const localStreamRef = useRef(null);
  useEffect(() => {
    localStreamRef.current = localStream;
  }, [localStream]);
  const callStatusRef = useRef("idle");
  useEffect(() => {
    callStatusRef.current = callStatus;
  }, [callStatus]);

  // Single source of truth for where /call navigation should point, given
  // the current call status and route. Previously this logic was split
  // across two separate effects that could both fire in the same render
  // pass and issue duplicate/racing navigate() calls — consolidated here.
  useEffect(() => {
    if (callStatus !== "idle" && location.pathname !== "/call") {
      log("navigating to /call, status:", callStatus);
      navigate("/call");
    } else if (callStatus === "idle" && location.pathname === "/call") {
      log("call ended, navigating back to /chat");
      navigate("/chat");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [callStatus, location.pathname]);

  const resetCallState = useCallback(() => {
    log("resetting call state");
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
    setOtherUserName("");
    otherUserId.current = null;
  }, []);

  useEffect(() => {
    if (!socket) return;

    const handleIncomingCall = ({ from, offer, callerName }) => {
      log("incoming-call from", callerName);
      if (callStatusRef.current !== "idle") {
        log("already busy, sending decline-call");
        socket.emit("decline-call", { to: from });
        return;
      }
      setIncomingCall({ from, offer, callerName });
      setOtherUserName(callerName);
      otherUserId.current = from;
      setCallStatus("incoming");
    };

    const handleCallAnswered = async ({ answer }) => {
      log("call-answered received");
      const pc = peerConnection.current;
      if (!pc) {
        log("ERROR: call-answered arrived but no peer connection exists");
        return;
      }
      await pc.setRemoteDescription(new RTCSessionDescription(answer));
      log("remote description (answer) set");
      await flushPendingCandidates(pc);
      setCallStatus("in-call");
    };

    const handleIceCandidate = async ({ candidate }) => {
      const pc = peerConnection.current;
      if (pc && pc.remoteDescription && pc.remoteDescription.type) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (err) {
          log("ERROR adding ICE candidate:", err.message);
        }
      } else {
        pendingCandidates.current.push(candidate);
        log(
          "queued ICE candidate (peer connection not ready yet), queue size:",
          pendingCandidates.current.length
        );
      }
    };

    const handleCallEnded = () => {
      log("call-ended received");
      resetCallState();
    };
    const handleCallDeclined = () => {
      log("call-declined received");
      resetCallState();
    };
    const handleCallError = ({ message }) => {
      log("call-error received:", message);
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
      log("received remote track:", event.track.kind);
      setRemoteStream(event.streams[0]);
    };

    pc.oniceconnectionstatechange = () => {
      log("ICE connection state:", pc.iceConnectionState);
      if (pc.iceConnectionState === "failed") {
        log("ICE connection failed — ending call");
        if (otherUserId.current) socket.emit("end-call", { to: otherUserId.current });
        alert("Call connection failed. Please try again.");
        resetCallState();
      }
    };

    return pc;
  };

  const flushPendingCandidates = async (pc) => {
    if (pendingCandidates.current.length > 0) {
      log("flushing", pendingCandidates.current.length, "queued ICE candidate(s)");
    }
    while (pendingCandidates.current.length > 0) {
      const candidate = pendingCandidates.current.shift();
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (err) {
        log("ERROR adding queued ICE candidate:", err.message);
      }
    }
  };

  const getMediaOrAlert = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      log(
        "getUserMedia succeeded — tracks:",
        stream.getTracks().map((t) => t.kind).join(", ")
      );
      return stream;
    } catch (err) {
      log("ERROR getUserMedia failed:", err.name, err.message);
      alert(
        err.name === "NotReadableError"
          ? "Camera is already in use by another tab/app. Close other tabs using the camera and try again."
          : err.name === "NotAllowedError"
          ? "Camera/mic permission was denied. Check your browser's site permissions."
          : "Couldn't access camera/mic. Note: on a phone, this only works over HTTPS (or localhost) — plain http://<LAN-IP> will silently block camera access."
      );
      return null;
    }
  };

  const startCall = async (targetUser) => {
    if (!targetUser) return;
    if (callStatus !== "idle") {
      log("startCall ignored — already in a call (status:", callStatus + ")");
      return;
    }
    if (!socket) {
      alert("Not connected to the server yet — please wait a moment and try again.");
      return;
    }
    log("starting call to", targetUser.username);

    otherUserId.current = targetUser._id;
    setOtherUserName(targetUser.username);

    const stream = await getMediaOrAlert();
    if (!stream) {
      otherUserId.current = null;
      return;
    }
    setLocalStream(stream);

    peerConnection.current?.close();
    pendingCandidates.current = [];

    const pc = createPeerConnection(targetUser._id);
    stream.getTracks().forEach((track) => pc.addTrack(track, stream));
    peerConnection.current = pc;

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    log("local description (offer) set, sending call-user");

    socket.emit("call-user", { to: targetUser._id, offer, callerName: user.username });
    setCallStatus("calling");
  };

  const acceptCall = async () => {
    if (!incomingCall) return;
    if (!socket) {
      alert("Not connected to the server yet — please wait a moment and try again.");
      return;
    }
    const { from, offer } = incomingCall;
    log("accepting call from", from);

    const stream = await getMediaOrAlert();
    if (!stream) {
      socket.emit("decline-call", { to: from });
      resetCallState();
      return;
    }
    setLocalStream(stream);

    peerConnection.current?.close();
    pendingCandidates.current = [];

    const pc = createPeerConnection(from);
    stream.getTracks().forEach((track) => pc.addTrack(track, stream));
    peerConnection.current = pc;

    await pc.setRemoteDescription(new RTCSessionDescription(offer));
    log("remote description (offer) set");
    await flushPendingCandidates(pc);

    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    log("local description (answer) set, sending answer-call");

    socket.emit("answer-call", { to: from, answer });
    setCallStatus("in-call");
  };

  const declineCall = () => {
    if (!incomingCall) return;
    socket?.emit("decline-call", { to: incomingCall.from });
    resetCallState();
  };

  const endCall = () => {
    if (otherUserId.current) {
      socket?.emit("end-call", { to: otherUserId.current });
    }
    resetCallState();
  };

  const switchCamera = async () => {
    if (!localStream) return;
    const newFacingMode = facingMode === "user" ? "environment" : "user";
    const oldVideoTrack = localStream.getVideoTracks()[0];

    try {
      oldVideoTrack?.stop();

      const newVideoStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: newFacingMode } },
        audio: false,
      });
      const newVideoTrack = newVideoStream.getVideoTracks()[0];

      const sender = peerConnection.current
        ?.getSenders()
        .find((s) => s.track?.kind === "video");
      if (sender) await sender.replaceTrack(newVideoTrack);

      const combinedStream = new MediaStream([newVideoTrack, ...localStream.getAudioTracks()]);
      setLocalStream(combinedStream);
      setFacingMode(newFacingMode);
    } catch (err) {
      log("ERROR switching camera:", err.message);
      alert("Couldn't switch camera — this device may only have one camera available.");
    }
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

  return (
    <CallContext.Provider
      value={{
        callStatus,
        otherUserName,
        localStream,
        remoteStream,
        facingMode,
        isCameraOn,
        isMicOn,
        startCall,
        acceptCall,
        declineCall,
        endCall,
        switchCamera,
        toggleCamera,
        toggleMic,
      }}
    >
      {children}
    </CallContext.Provider>
  );
}

export const useCall = () => useContext(CallContext);
