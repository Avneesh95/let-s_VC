import { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "./AuthContext";
import { useSocket } from "./SocketContext";
import ICE_SERVERS from "../utils/iceServers";

const CallContext = createContext(null);

export function CallProvider({ children }) {
  const { user } = useAuth();
  const { socket } = useSocket();
  const navigate = useNavigate();
  const location = useLocation();

  const [callStatus, setCallStatus] = useState("idle"); // idle | calling | incoming | in-call
  const [incomingCall, setIncomingCall] = useState(null); // { from, offer, callerName }
  const [otherUserName, setOtherUserName] = useState(""); // who we're calling / being called by
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

  // Navigate to the dedicated call page the moment a call starts (either
  // direction), and back to chat once it's fully over — this is what makes
  // calling feel like its own page instead of an overlay on the chat view.
  // The prevStatus check matters: without it, this effect would also fire
  // on the very first render of ANY route (since callStatus starts at
  // "idle"), force-navigating away from login/register/home immediately.
  const prevCallStatusRef = useRef("idle");
  useEffect(() => {
    const prevStatus = prevCallStatusRef.current;
    if (callStatus !== "idle") {
      navigate("/call");
    } else if (prevStatus !== "idle") {
      navigate("/chat");
    }
    prevCallStatusRef.current = callStatus;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [callStatus]);

  // If the route ever drifts away from /call while a call is still active
  // (most commonly: pressing the browser back button), pull it back —
  // otherwise the call keeps running invisibly with no UI left to see or
  // end it, since the call view only exists on the /call route.
  useEffect(() => {
    if (callStatus !== "idle" && location.pathname !== "/call") {
      navigate("/call");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, callStatus]);

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
    setOtherUserName("");
    otherUserId.current = null;
  }, []);

  useEffect(() => {
    if (!socket) return;

    const handleIncomingCall = ({ from, offer, callerName }) => {
      if (callStatusRef.current !== "idle") {
        socket.emit("decline-call", { to: from });
        return;
      }
      setIncomingCall({ from, offer, callerName });
      setOtherUserName(callerName);
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
      setRemoteStream(event.streams[0]);
    };

    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === "failed") {
        if (otherUserId.current) socket.emit("end-call", { to: otherUserId.current });
        alert("Call connection failed. Please try again.");
        resetCallState();
      }
    };

    return pc;
  };

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

  const startCall = async (targetUser) => {
    if (!targetUser) return;
    if (callStatus !== "idle") return;
    otherUserId.current = targetUser._id;
    setOtherUserName(targetUser.username);

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

    peerConnection.current?.close();
    pendingCandidates.current = [];

    const pc = createPeerConnection(targetUser._id);
    stream.getTracks().forEach((track) => pc.addTrack(track, stream));
    peerConnection.current = pc;

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    socket.emit("call-user", { to: targetUser._id, offer, callerName: user.username });
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
      console.error("Could not switch camera:", err);
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
