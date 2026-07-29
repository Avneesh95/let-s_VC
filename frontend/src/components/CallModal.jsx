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
  // Browsers can silently block autoplay of the remote video/audio unless
  // it's triggered by a recent, direct user interaction — this can happen
  // even though the tracks arrived successfully. When that happens we show
  // a manual "tap to enable" button, which counts as a fresh user gesture
  // and lets playback proceed.
  const [needsTapToPlay, setNeedsTapToPlay] = useState(false);

  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
      localVideoRef.current.play().catch(() => {
        // Local video is muted, so autoplay is almost always allowed —
        // if it's still blocked there's nothing actionable to do here.
      });
    }
  }, [localStream]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      const videoEl = remoteVideoRef.current;
      videoEl.srcObject = remoteStream;
      const playPromise = videoEl.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => setNeedsTapToPlay(false))
          .catch((err) => {
            console.warn("Autoplay blocked, waiting for a tap to start playback:", err);
            setNeedsTapToPlay(true);
          });
      }
    }
  }, [remoteStream]);

  const handleTapToPlay = () => {
    remoteVideoRef.current
      ?.play()
      .then(() => setNeedsTapToPlay(false))
      .catch((err) => console.error("Still couldn't play after tap:", err));
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
                  className="w-full min-h-[270px] rounded-lg bg-black block"
                />
              ) : (
                <div className="w-full min-h-[270px] rounded-lg bg-black flex items-center justify-center text-gray-400 text-sm">
                  Connecting video…
                </div>
              )}

              {remoteStream && needsTapToPlay && (
                <button
                  onClick={handleTapToPlay}
                  className="absolute inset-0 bg-black/70 flex items-center justify-center text-white text-sm font-medium rounded-lg"
                >
                  🔇 Tap to enable video &amp; audio
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
