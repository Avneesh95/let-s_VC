import { useEffect, useRef, useState } from "react";

function ControlButton({ onClick, active, activeLabel, inactiveLabel, danger, title }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`w-12 h-12 rounded-full flex items-center justify-center text-lg transition-colors ${
        danger
          ? "bg-red-600 hover:bg-red-700"
          : active
          ? "bg-neutral-700 hover:bg-neutral-600"
          : "bg-white/90 hover:bg-white text-black"
      }`}
    >
      {active ? activeLabel : inactiveLabel}
    </button>
  );
}

export default function CallModal({
  callStatus,
  callerName,
  localStream,
  remoteStream,
  onAccept,
  onDecline,
  onEnd,
  onSwitchCamera,
  isCameraOn,
  isMicOn,
  onToggleCamera,
  onToggleMic,
  facingMode,
}) {
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  // Muted video autoplay is allowed in every browser unconditionally —
  // it's audio that gets blocked without a user gesture. Starting muted
  // guarantees the video always renders; sound is a separate one-tap action.
  const [isMuted, setIsMuted] = useState(true);

  // Same simple pattern as the working GroupCall video tiles: just assign
  // srcObject and let the autoPlay attribute handle playback.
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

  if (callStatus === "idle") return null;

  // "Calling…" / "Incoming call" — small centered dialog, no video yet
  if (callStatus === "calling" || callStatus === "incoming") {
    return (
      <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
        <div className="bg-neutral-900 text-white rounded-2xl p-6 min-w-[280px] w-[92vw] md:w-auto flex flex-col items-center gap-4">
          {callStatus === "incoming" ? (
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
          ) : (
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
        </div>
      </div>
    );
  }

  // "in-call" — full-screen video
  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col">
      <div className="flex-1 relative">
        {remoteStream ? (
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            muted={isMuted}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-400 text-sm">
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
            {/* Always keep the <video> element mounted — toggling camera
                on/off only overlays a placeholder, never unmounts it.
                Unmounting on toggle was the bug: a freshly remounted
                <video> needs srcObject reassigned, but the effect above
                only re-runs when localStream itself changes, not on every
                mount, so turning the camera back on would stay blank. */}
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className={`w-full h-full object-cover ${facingMode === "user" ? "-scale-x-100" : ""}`}
            />
            {!isCameraOn && (
              <div className="absolute inset-0 flex items-center justify-center bg-neutral-800 text-2xl">
                📷🚫
              </div>
            )}
            <span className="absolute bottom-1 left-1 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded">
              You
            </span>
          </div>
        </div>
      </div>

      <div className="bg-neutral-900 py-5 flex items-center justify-center gap-3">
        <ControlButton
          onClick={onToggleMic}
          active={isMicOn}
          activeLabel="🎤"
          inactiveLabel="🔇"
          title={isMicOn ? "Mute mic" : "Unmute mic"}
        />
        <ControlButton
          onClick={onToggleCamera}
          active={isCameraOn}
          activeLabel="📷"
          inactiveLabel="🚫"
          title={isCameraOn ? "Turn off camera" : "Turn on camera"}
        />
        <ControlButton onClick={onSwitchCamera} active title="Switch camera" activeLabel="🔄" inactiveLabel="🔄" />
        <button
          onClick={onEnd}
          title="End call"
          className="w-14 h-12 rounded-full bg-red-600 hover:bg-red-700 flex items-center justify-center text-white text-xl"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
