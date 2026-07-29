import { useEffect, useRef, useState } from "react";

export default function CallModal({
  callStatus,
  callerName,
  localStream,
  remoteStream,
  onAccept,
  onDecline,
  onEnd,
  onSwitchCamera,
}) {
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  // Muted video is allowed to autoplay in every browser, no exceptions —
  // it's *audio* autoplay that gets blocked without a user gesture. Rather
  // than fight that restriction on the combined video+audio element (which
  // is unreliable — a rejected play() promise doesn't always resolve even
  // after a manual retry), we start muted so the video is always
  // guaranteed to show, and treat unmuting as a separate, simpler action.
  const [isMuted, setIsMuted] = useState(true);

  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
      localVideoRef.current.play().catch(() => {});
    }
  }, [localStream]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
      remoteVideoRef.current.play().catch((err) => {
        console.warn("Remote video play() failed even muted — unusual:", err);
      });
    }
    if (!remoteStream) setIsMuted(true); // reset for the next call
  }, [remoteStream]);

  const toggleMute = () => {
    if (!remoteVideoRef.current) return;
    const nextMuted = !remoteVideoRef.current.muted;
    remoteVideoRef.current.muted = nextMuted;
    setIsMuted(nextMuted);
    // Re-assert play() right after unmuting — some browsers pause
    // playback the moment audio is enabled without a fresh play() call.
    remoteVideoRef.current.play().catch((err) => console.error("Play after unmute failed:", err));
  };

  if (callStatus === "idle") return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-neutral-900 text-white rounded-2xl p-6 min-w-[280px] w-[92vw] md:w-auto flex flex-col items-center gap-4">
        {callStatus === "incoming" && (
          <>
            <p className="text-lg">{callerName} is calling…</p>
            <div className="flex gap-3">
              <button
                onClick={onAccept}
                className="bg-green-600 hover:bg-green-700 text-white font-semibold rounded-full px-6 py-2"
              >
                Accept
              </button>
              <button
                onClick={onDecline}
                className="bg-red-600 hover:bg-red-700 text-white font-semibold rounded-full px-6 py-2"
              >
                Decline
              </button>
            </div>
          </>
        )}

        {callStatus === "calling" && (
          <>
            <p className="text-lg">Calling {callerName}…</p>
            <button
              onClick={onEnd}
              className="bg-red-600 hover:bg-red-700 text-white font-semibold rounded-full px-6 py-2"
            >
              Cancel
            </button>
          </>
        )}

        {callStatus === "in-call" && (
          <>
            <div className="relative w-[480px] max-w-[92vw]">
              {remoteStream ? (
                <video
                  ref={remoteVideoRef}
                  autoPlay
                  playsInline
                  muted={isMuted}
                  className="w-full min-h-[270px] rounded-lg bg-black block"
                />
              ) : (
                <div className="w-full min-h-[270px] rounded-lg bg-black flex items-center justify-center text-gray-400 text-sm">
                  Connecting video…
                </div>
              )}

              {remoteStream && (
                <button
                  onClick={toggleMute}
                  className="absolute bottom-2 left-2 bg-black/60 hover:bg-black/80 text-white text-xs px-3 py-1.5 rounded-full"
                >
                  {isMuted ? "🔇 Tap to unmute" : "🔊 Mute"}
                </button>
              )}

              <div className="absolute bottom-2 right-2">
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-[110px] rounded-lg border-2 border-white bg-black block"
                />
                <span className="absolute bottom-1 left-1 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded">
                  You
                </span>
                <button
                  onClick={onSwitchCamera}
                  title="Switch camera"
                  className="absolute top-1 right-1 bg-black/60 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm"
                >
                  🔄
                </button>
              </div>
            </div>
            <button
              onClick={onEnd}
              className="bg-red-600 hover:bg-red-700 text-white font-semibold rounded-full px-6 py-2 mt-2"
            >
              End Call
            </button>
          </>
        )}
      </div>
    </div>
  );
}
