import { useState, useRef, useEffect, useCallback } from "react";
import { MicOff, RefreshCw, Loader2, Pin, PinOff } from "lucide-react";
import { getVideoFitMode } from "../utils/callMedia";

// A stable palette of avatar gradient colors
const AVATAR_PALETTE = ["#F4600F", "#7C5CFC", "#0EA5A4", "#DB2777", "#2563EB", "#B45309", "#059669", "#9333EA"];
function colorForName(name) {
  let hash = 0;
  for (let i = 0; i < (name || "?").length; i++) {
    hash = (hash * 31 + (name || "?").charCodeAt(i)) >>> 0;
  }
  return AVATAR_PALETTE[hash % AVATAR_PALETTE.length];
}

function ParticipantAvatar({ name, avatarUrl, size = "w-16 h-16 sm:w-20 sm:h-20", textSize = "text-2xl sm:text-3xl" }) {
  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={name || "Participant"}
        className={`${size} rounded-full object-cover ring-2 ring-white/10 shadow-lg`}
      />
    );
  }
  const color = colorForName(name || "?");
  return (
    <span
      className={`${size} rounded-full text-white font-display font-semibold flex items-center justify-center ring-2 ring-white/10 relative overflow-hidden shrink-0 shadow-lg`}
      style={{ background: `linear-gradient(150deg, ${color} 0%, rgba(0,0,0,0.45) 140%)` }}
    >
      <span className="absolute inset-0 bg-gradient-to-tr from-white/10 via-transparent to-transparent" />
      <span className={`relative ${textSize}`}>{(name || "?")[0]?.toUpperCase() || "?"}</span>
    </span>
  );
}

export default function VideoTile({
  stream,
  label,
  muted,
  cameraOff,
  mirrored,
  connState = "connected",
  isActiveSpeaker = false,
  isScreenShare = false,
  isPinned = false,
  onTogglePin,
  onRetry,
  avatarUrl,
  avatarName,
  className = "",
  style = {},
}) {
  const videoRef = useRef(null);
  const [videoAspectRatio, setVideoAspectRatio] = useState(null);
  const longPressTimerRef = useRef(null);

  const updateVideoAspectRatio = useCallback((node) => {
    if (!node) return;
    const width = node.videoWidth;
    const height = node.videoHeight;
    if (!width || !height) return;
    const nextRatio = width / height;
    setVideoAspectRatio((currentRatio) =>
      currentRatio && Math.abs(currentRatio - nextRatio) < 0.01 ? currentRatio : nextRatio
    );
  }, []);

  const attachStream = useCallback(
    (node) => {
      videoRef.current = node;
      if (node && stream) {
        node.muted = !!muted;
        if (node.srcObject !== stream) {
          node.srcObject = stream;
        }
        updateVideoAspectRatio(node);
        node.play?.().catch(() => {});
      }
    },
    [stream, muted, updateVideoAspectRatio]
  );

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.muted = !!muted;
      if (videoRef.current.srcObject !== stream) {
        videoRef.current.srcObject = stream;
      }
      updateVideoAspectRatio(videoRef.current);
      videoRef.current.play?.().catch(() => {});
    }
  }, [stream, muted, updateVideoAspectRatio]);

  // Long press for pin / spotlight on touch devices
  const handleTouchStart = () => {
    if (!onTogglePin) return;
    longPressTimerRef.current = setTimeout(() => {
      if (navigator.vibrate) navigator.vibrate(30);
      onTogglePin();
    }, 500);
  };

  const handleTouchEnd = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const isShare = isScreenShare || stream?.getVideoTracks?.()[0]?.label?.toLowerCase().includes("screen");
  const videoFitMode = isShare ? "contain" : getVideoFitMode(videoAspectRatio, false);
  const showFailed = !stream && connState === "failed";
  const isConnecting = !stream && (connState === "connecting" || connState === "reconnecting");
  const statusText = connState === "reconnecting" ? "Reconnecting…" : "Connecting…";

  return (
    <div
      aria-label={label || "Video participant"}
      role="region"
      data-testid="video-tile"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
      style={style}
      className={`group relative min-w-0 min-h-0 w-full h-full bg-[#0d1017] rounded-2xl overflow-hidden flex items-center justify-center transition-all duration-200 ease-out select-none ${
        isActiveSpeaker
          ? "ring-2 ring-gold shadow-[0_0_18px_rgba(255,167,51,0.55)] z-10"
          : isPinned
          ? "ring-2 ring-brand/80 shadow-lg"
          : "ring-1 ring-white/10 hover:ring-white/20 shadow-md shadow-black/40"
      } ${className}`}
    >
      {/* Video element */}
      {stream ? (
        <video
          ref={attachStream}
          autoPlay
          playsInline
          muted={muted}
          onLoadedMetadata={(event) => updateVideoAspectRatio(event.currentTarget)}
          onResize={(event) => updateVideoAspectRatio(event.currentTarget)}
          className={`w-full h-full pointer-events-none transition-opacity duration-200 ${
            cameraOff ? "invisible opacity-0" : "visible opacity-100"
          } ${
            videoFitMode === "contain"
              ? "object-contain bg-black/80"
              : videoFitMode === "portrait"
              ? "object-cover md:object-contain"
              : "object-cover object-center"
          } ${mirrored ? "-scale-x-100" : ""}`}
        />
      ) : null}

      {/* Camera Off Avatar Overlay */}
      {cameraOff && (
        <div className="absolute inset-0 bg-[#0d1017] flex flex-col items-center justify-center gap-2 p-3 select-none z-10">
          <ParticipantAvatar
            name={avatarName || label}
            avatarUrl={avatarUrl}
            size="w-16 h-16 sm:w-20 sm:h-20"
            textSize="text-2xl sm:text-3xl"
          />
          <span className="text-xs text-white/60 font-medium">Camera off</span>
        </div>
      )}

      {/* Connecting / Spinner State */}
      {isConnecting && !cameraOff && (
        <div className="absolute inset-0 bg-[#0d1017] flex items-center justify-center gap-2 text-white/60 text-xs sm:text-sm font-medium z-10 animate-pulse">
          <Loader2 className="w-4 h-4 animate-spin text-brand" />
          <span>{statusText}</span>
        </div>
      )}

      {/* Failed State with Retry */}
      {showFailed && (
        <div className="absolute inset-0 bg-[#0d1017] flex flex-col items-center justify-center gap-2 px-3 text-center z-10">
          <span className="text-white/70 text-xs sm:text-sm font-medium">Connection issue</span>
          {onRetry && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRetry();
              }}
              className="text-xs bg-white/15 hover:bg-white/25 active:scale-95 transition-all rounded-full px-3.5 py-1.5 flex items-center gap-1.5 cursor-pointer text-white font-semibold shadow"
            >
              <RefreshCw className="w-3 h-3" strokeWidth={2} />
              Retry
            </button>
          )}
        </div>
      )}

      {/* Bottom gradient overlay for legible text badges */}
      {stream && !cameraOff && !isConnecting && (
        <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/70 via-black/30 to-transparent pointer-events-none z-10" />
      )}

      {/* Top action controls (Pin / Spotlight button) */}
      {onTogglePin && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onTogglePin();
          }}
          aria-label={isPinned ? "Unpin participant" : "Pin participant"}
          title={isPinned ? "Unpin" : "Pin / Spotlight"}
          className={`absolute top-2.5 right-2.5 z-20 p-1.5 rounded-lg backdrop-blur-md transition-all duration-150 ${
            isPinned
              ? "bg-brand text-white shadow-md ring-1 ring-brand-light"
              : "bg-black/50 text-white/70 hover:text-white hover:bg-black/80 opacity-0 group-hover:opacity-100 focus:opacity-100"
          }`}
        >
          {isPinned ? <PinOff className="w-3.5 h-3.5" /> : <Pin className="w-3.5 h-3.5" />}
        </button>
      )}

      {/* Active Speaker Badge indicator */}
      {isActiveSpeaker && (
        <div className="absolute top-2.5 left-2.5 z-20 flex items-center gap-1.5 bg-black/60 backdrop-blur-md px-2 py-0.5 rounded-full ring-1 ring-gold/40 animate-pulse">
          <span className="w-2 h-2 rounded-full bg-gold animate-ping" />
          <span className="text-[10px] text-gold font-medium uppercase tracking-wider">Speaking</span>
        </div>
      )}

      {/* Bottom Label and Mute Pill */}
      {label && (
        <div className="absolute bottom-2.5 left-2.5 z-20 bg-black/65 backdrop-blur-md text-white text-[11px] sm:text-xs font-semibold px-2.5 py-1.5 rounded-lg ring-1 ring-white/10 flex items-center gap-1.5 max-w-[85%] truncate select-none shadow-md">
          <span className="truncate">{label}</span>
          {muted && <MicOff className="w-3 h-3 text-danger shrink-0" aria-label="Muted" />}
          {isShare && (
            <span className="text-[9px] bg-white/20 text-white font-medium px-1 rounded uppercase tracking-wider">
              Screen
            </span>
          )}
        </div>
      )}
    </div>
  );
}
