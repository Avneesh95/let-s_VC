import { useEffect, useRef, useState } from "react";
import { Navigate } from "react-router-dom";
import { useCall } from "../context/CallContext";

function ControlButton({ onClick, active, activeLabel, inactiveLabel, title }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center text-base md:text-lg transition-colors ${
        active ? "bg-white/10 hover:bg-white/20" : "bg-white/90 hover:bg-white text-ink"
      }`}
    >
      {active ? activeLabel : inactiveLabel}
    </button>
  );
}

export default function CallPage() {
  const {
    callStatus,
    otherUserName,
    localStream,
    remoteStream,
    facingMode,
    isCameraOn,
    isMicOn,
    acceptCall,
    declineCall,
    endCall,
    switchCamera,
    toggleCamera,
    toggleMic,
  } = useCall();

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  // Muted video autoplay is allowed in every browser unconditionally —
  // it's audio that gets blocked without a user gesture. Starting muted
  // guarantees the video always renders; sound is a separate one-tap action.
  const [isMuted, setIsMuted] = useState(true);

  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
    if (!remoteStream) setIsMuted(true); // reset for the next call
  }, [remoteStream]);

  const toggleMute = () => {
    if (!remoteVideoRef.current) return;
    const nextMuted = !remoteVideoRef.current.muted;
    remoteVideoRef.current.muted = nextMuted;
    setIsMuted(nextMuted);
  };

  // Landed on /call directly with no active call (e.g. page refresh) —
  // nothing to show, send them back to chat.
  if (callStatus === "idle") return <Navigate to="/chat" />;

  // "Calling…" / "Incoming call" — small centered dialog, no video yet
  if (callStatus === "calling" || callStatus === "incoming") {
    return (
      <div className="h-dvh bg-ink flex items-center justify-center">
        <div className="bg-white/5 border border-white/10 text-white rounded-2xl p-6 min-w-[280px] w-[92vw] md:w-auto flex flex-col items-center gap-4">
          {callStatus === "incoming" ? (
            <>
              <p className="text-lg">
                <span className="font-display font-semibold">{otherUserName}</span> is calling…
              </p>
              <div className="flex gap-3">
                <button
                  onClick={acceptCall}
                  className="bg-brand hover:bg-brand-dark transition-colors text-white font-semibold rounded-full px-6 py-2"
                >
                  Accept
                </button>
                <button
                  onClick={declineCall}
                  className="bg-danger hover:opacity-90 transition-opacity text-white font-semibold rounded-full px-6 py-2"
                >
                  Decline
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="text-lg">
                Calling <span className="font-display font-semibold">{otherUserName}</span>…
              </p>
              <button
                onClick={endCall}
                className="bg-danger hover:opacity-90 transition-opacity text-white font-semibold rounded-full px-6 py-2"
              >
                Cancel
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  // "in-call" — full-screen video
  return (
    <div className="h-dvh bg-black flex flex-col">
      <div className="flex-1 relative">
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          muted={isMuted}
          className="w-full h-full object-contain bg-black"
        />
        {!remoteStream && (
          <div className="absolute inset-0 flex items-center justify-center text-white/40 text-sm">
            Connecting video…
          </div>
        )}

        {remoteStream && (
          <button
            onClick={toggleMute}
            className="absolute bottom-4 left-4 bg-black/60 hover:bg-black/80 text-white text-xs px-3 py-1.5 rounded-full"
          >
            {isMuted ? "🔇 Tap to unmute" : "🔊 Mute"}
          </button>
        )}

        <div className="absolute top-4 right-4 w-28 md:w-40">
          <div className="relative aspect-video rounded-lg overflow-hidden border-2 border-white bg-black">
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className={`w-full h-full object-cover ${facingMode === "user" ? "-scale-x-100" : ""}`}
            />
            {!isCameraOn && (
              <div className="absolute inset-0 flex items-center justify-center bg-ink text-2xl">
                📷🚫
              </div>
            )}
            <span className="absolute bottom-1 left-1 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded">
              You
            </span>
          </div>
        </div>
      </div>

      <div className="bg-ink border-t border-white/5 py-3 md:py-5 flex items-center justify-center gap-2 md:gap-3">
        <ControlButton
          onClick={toggleMic}
          active={isMicOn}
          activeLabel="🎤"
          inactiveLabel="🔇"
          title={isMicOn ? "Mute mic" : "Unmute mic"}
        />
        <ControlButton
          onClick={toggleCamera}
          active={isCameraOn}
          activeLabel="📷"
          inactiveLabel="🚫"
          title={isCameraOn ? "Turn off camera" : "Turn on camera"}
        />
        <ControlButton onClick={switchCamera} active title="Switch camera" activeLabel="🔄" inactiveLabel="🔄" />
        <button
          onClick={endCall}
          title="End call"
          className="w-12 h-10 md:w-14 md:h-12 rounded-full bg-danger hover:opacity-90 transition-opacity flex items-center justify-center text-white text-lg md:text-xl"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
