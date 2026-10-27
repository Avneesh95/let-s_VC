import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import VideoTile from "./VideoTile";
import { useActiveSpeaker } from "../utils/useActiveSpeaker";
import { LayoutGrid, Maximize2, Users, AlertCircle } from "lucide-react";

/**
 * Calculates device and orientation modes:
 * - 'phone-portrait': width < 768 && height >= width
 * - 'phone-landscape': height < 500 && width > height
 * - 'desktop': width >= 768
 */
function useViewportProfile() {
  const [profile, setProfile] = useState(() => {
    if (typeof window === "undefined") return { mode: "desktop", isPortrait: false, width: 1200, height: 800 };
    const w = window.innerWidth;
    const h = window.innerHeight;
    const isPortrait = h > w;
    let mode = "desktop";
    if (w < 768 && isPortrait) mode = "phone-portrait";
    else if (h < 560 && !isPortrait) mode = "phone-landscape";
    return { mode, isPortrait, width: w, height: h };
  });

  useEffect(() => {
    let timeoutId;
    const handleResize = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        const w = window.innerWidth;
        const h = window.innerHeight;
        const isPortrait = h > w;
        let mode = "desktop";
        if (w < 768 && isPortrait) mode = "phone-portrait";
        else if (h < 560 && !isPortrait) mode = "phone-landscape";
        setProfile({ mode, isPortrait, width: w, height: h });
      }, 100);
    };

    window.addEventListener("resize", handleResize);
    window.addEventListener("orientationchange", handleResize);
    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("orientationchange", handleResize);
    };
  }, []);

  return profile;
}

/**
 * Returns Tailwind grid column-span and offset classes for 12-column grid.
 * 
 * Supports:
 * - Phone Portrait: 1..6
 * - Phone Landscape: 1..6
 * - Desktop Landscape: 1..6
 */
function getTileGridClass(index, total, mode, desktopWide) {
  if (total === 1) return "col-span-12 row-span-1 h-full";

  // --- PHONE PORTRAIT ---
  if (mode === "phone-portrait") {
    switch (total) {
      case 2:
        // Remote full + PiP handled separately outside grid
        return "col-span-12 h-full";
      case 3:
        // Row 1: 1 wide tile (full width); Row 2: 2 tiles side by side
        return index === 0 ? "col-span-12 h-full" : "col-span-6 h-full";
      case 4:
        // 2x2 grid
        return "col-span-6 h-full";
      case 5:
        // 2 / 2 / 1 (last tile full width or centered)
        return index < 4 ? "col-span-6 h-full" : "col-span-12 h-full";
      case 6:
        // 2 columns x 3 rows
        return "col-span-6 h-full";
      default:
        return "col-span-6 h-full";
    }
  }

  // --- PHONE LANDSCAPE ---
  if (mode === "phone-landscape") {
    switch (total) {
      case 2:
        return "col-span-6 h-full"; // 2 side by side
      case 3:
        return "col-span-4 h-full"; // 3 in a row
      case 4:
        return "col-span-6 h-full"; // 2x2
      case 5:
        // 3 + 2 (centered)
        if (index < 3) return "col-span-4 h-full";
        return index === 3 ? "col-span-4 col-start-3 h-full" : "col-span-4 h-full";
      case 6:
        return "col-span-4 h-full"; // 3x2
      default:
        return "col-span-4 h-full";
    }
  }

  // --- LAPTOP / DESKTOP (LANDSCAPE) ---
  switch (total) {
    case 2:
      return "col-span-6 h-full"; // side by side 50/50
    case 3:
      if (desktopWide) return "col-span-4 h-full"; // 3 in a row on very wide screens
      // 2 on top + 1 centered below (col-span-6 col-start-4 centers under two 6-span tiles)
      return index < 2 ? "col-span-6 h-full" : "col-span-6 col-start-4 h-full";
    case 4:
      return "col-span-6 h-full"; // 2x2
    case 5:
      // 3 on top + 2 centered below
      if (index < 3) return "col-span-4 h-full";
      return index === 3 ? "col-span-4 col-start-3 h-full" : "col-span-4 h-full";
    case 6:
      return "col-span-4 h-full"; // 3x2
    default:
      return "col-span-4 h-full";
  }
}

/**
 * Returns grid container template row styling to maintain balanced heights.
 */
function getGridRowStyle(total, mode) {
  if (total === 1) return "grid-rows-1";
  if (mode === "phone-portrait") {
    if (total === 2) return "grid-rows-1";
    if (total === 3) return "grid-rows-2";
    if (total === 4) return "grid-rows-2";
    if (total === 5) return "grid-rows-3";
    if (total === 6) return "grid-rows-3";
  }
  if (mode === "phone-landscape") {
    if (total <= 3) return "grid-rows-1";
    return "grid-rows-2";
  }
  // Desktop
  if (total <= 2) return "grid-rows-1";
  return "grid-rows-2";
}

export default function VideoGrid({
  participants = [],
  chatOpen = false,
  className = "",
}) {
  const profile = useViewportProfile();
  const { mode, width, height } = profile;
  const isDesktopWide = width / Math.max(1, height) > 1.85;

  // Active speaker detection
  const activeSpeakers = useActiveSpeaker(participants);

  // Manual pin/spotlight or auto-spotlight on screen share
  const [pinnedId, setPinnedId] = useState(null);

  // Desktop 2-participant view mode: 'split' (50/50) vs 'pip'
  const [desktopDuoMode, setDesktopDuoMode] = useState("split");

  // Phone 2-participant PiP: which participant is main vs pip
  const [swappedPiP, setSwappedPiP] = useState(false);

  // PiP Drag position state (Corner-snapping: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right')
  const [pipCorner, setPipCorner] = useState("bottom-right");
  const pipDragRef = useRef({ isDragging: false, startX: 0, startY: 0, currentX: 0, currentY: 0, hasMoved: false });
  const [pipDragDelta, setPipDragDelta] = useState({ x: 0, y: 0 });

  // Screen share auto-spotlight detection
  const screenShareParticipant = useMemo(() => {
    return participants.find((p) => p.isScreenShare || p.stream?.getVideoTracks?.()[0]?.label?.toLowerCase().includes("screen"));
  }, [participants]);

  // If someone starts screen share, prioritize their stream as spotlight
  const effectiveSpotlightId = useMemo(() => {
    if (screenShareParticipant) return screenShareParticipant.id;
    return pinnedId;
  }, [screenShareParticipant, pinnedId]);

  // Safe participant count (cap at 6)
  const isRoomFull = participants.length > 6;
  const displayParticipants = useMemo(() => participants.slice(0, 6), [participants]);
  const total = displayParticipants.length;

  // Corner snap coordinates
  const cornerClasses = {
    "top-left": "top-18 left-3",
    "top-right": "top-18 right-3",
    "bottom-left": "bottom-24 left-3",
    "bottom-right": "bottom-24 right-3",
  };

  // PiP Drag handlers for touch & mouse
  const handleDragStart = (e) => {
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    pipDragRef.current = {
      isDragging: true,
      startX: clientX,
      startY: clientY,
      currentX: clientX,
      currentY: clientY,
      hasMoved: false,
    };
  };

  const handleDragMove = useCallback((e) => {
    if (!pipDragRef.current.isDragging) return;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const deltaX = clientX - pipDragRef.current.startX;
    const deltaY = clientY - pipDragRef.current.startY;

    if (Math.abs(deltaX) > 6 || Math.abs(deltaY) > 6) {
      pipDragRef.current.hasMoved = true;
    }

    pipDragRef.current.currentX = clientX;
    pipDragRef.current.currentY = clientY;
    setPipDragDelta({ x: deltaX, y: deltaY });
  }, []);

  const handleDragEnd = useCallback(() => {
    if (!pipDragRef.current.isDragging) return;
    const { hasMoved, currentX, currentY } = pipDragRef.current;
    pipDragRef.current.isDragging = false;
    setPipDragDelta({ x: 0, y: 0 });

    if (!hasMoved) {
      // Tap on PiP -> swap main and PiP!
      setSwappedPiP((prev) => !prev);
      return;
    }

    // Snap to nearest of the 4 corners
    const midX = window.innerWidth / 2;
    const midY = window.innerHeight / 2;
    const isLeft = currentX < midX;
    const isTop = currentY < midY;

    if (isTop && isLeft) setPipCorner("top-left");
    else if (isTop && !isLeft) setPipCorner("top-right");
    else if (!isTop && isLeft) setPipCorner("bottom-left");
    else setPipCorner("bottom-right");
  }, []);

  useEffect(() => {
    const onMove = (e) => handleDragMove(e);
    const onEnd = () => handleDragEnd();
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onEnd);
    window.addEventListener("touchmove", onMove, { passive: false });
    window.addEventListener("touchend", onEnd);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onEnd);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
    };
  }, [handleDragMove, handleDragEnd]);

  // Handle Spotlight / Pinned Mode
  if (effectiveSpotlightId && total > 1) {
    const spotlightItem = displayParticipants.find((p) => p.id === effectiveSpotlightId) || displayParticipants[0];
    const thumbnailItems = displayParticipants.filter((p) => p.id !== spotlightItem.id);

    return (
      <div className={`w-full h-full flex flex-col gap-2 p-2 sm:p-3 overflow-hidden select-none ${className}`}>
        {/* Spotlight Main Area */}
        <div className="flex-1 min-h-0 w-full rounded-2xl overflow-hidden relative shadow-2xl">
          <VideoTile
            key={spotlightItem.id}
            stream={spotlightItem.stream}
            label={spotlightItem.isLocal ? `${spotlightItem.username} (You)` : spotlightItem.username}
            muted={spotlightItem.isLocal || spotlightItem.isMuted}
            cameraOff={spotlightItem.cameraOff || !spotlightItem.isCameraOn}
            mirrored={spotlightItem.isLocal && !spotlightItem.isScreenShare}
            connState={spotlightItem.connState}
            isActiveSpeaker={!!activeSpeakers[spotlightItem.id]}
            isScreenShare={spotlightItem.isScreenShare}
            isPinned={true}
            onTogglePin={() => setPinnedId(null)}
            onRetry={spotlightItem.onRetry}
            avatarUrl={spotlightItem.avatarUrl}
            avatarName={spotlightItem.username}
            className="w-full h-full"
          />
        </div>

        {/* Horizontal Thumbnail Strip */}
        <div className="h-24 sm:h-28 shrink-0 flex items-center gap-2 overflow-x-auto thin-scrollbar pb-1 px-1">
          {thumbnailItems.map((p) => (
            <div
              key={p.id}
              onClick={() => setPinnedId(p.id)}
              className="h-full aspect-video shrink-0 rounded-xl overflow-hidden cursor-pointer hover:scale-105 active:scale-95 transition-all shadow-md ring-1 ring-white/10"
            >
              <VideoTile
                stream={p.stream}
                label={p.isLocal ? "You" : p.username}
                muted={p.isLocal || p.isMuted}
                cameraOff={p.cameraOff || !p.isCameraOn}
                mirrored={p.isLocal && !p.isScreenShare}
                connState={p.connState}
                isActiveSpeaker={!!activeSpeakers[p.id]}
                isScreenShare={p.isScreenShare}
                isPinned={false}
                onTogglePin={() => setPinnedId(p.id)}
                avatarUrl={p.avatarUrl}
                avatarName={p.username}
              />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // --- PHONE PORTRAIT 2-PARTICIPANT: FULLSCREEN + DRAGGABLE CORNER-SNAPPED PIP ---
  if (mode === "phone-portrait" && total === 2) {
    const primary = swappedPiP ? displayParticipants[0] : displayParticipants[1];
    const pip = swappedPiP ? displayParticipants[1] : displayParticipants[0];

    return (
      <div className={`relative w-full h-full overflow-hidden ${className}`}>
        {/* Fullscreen Remote Video */}
        <div className="absolute inset-0 w-full h-full">
          <VideoTile
            key={primary.id}
            stream={primary.stream}
            label={primary.isLocal ? `${primary.username} (You)` : primary.username}
            muted={primary.isLocal || primary.isMuted}
            cameraOff={primary.cameraOff || !primary.isCameraOn}
            mirrored={primary.isLocal && !primary.isScreenShare}
            connState={primary.connState}
            isActiveSpeaker={!!activeSpeakers[primary.id]}
            isScreenShare={primary.isScreenShare}
            onTogglePin={() => setPinnedId(primary.id)}
            onRetry={primary.onRetry}
            avatarUrl={primary.avatarUrl}
            avatarName={primary.username}
            className="w-full h-full rounded-none"
          />
        </div>

        {/* Small Draggable Corner-Snapping PiP */}
        <div
          onMouseDown={handleDragStart}
          onTouchStart={handleDragStart}
          style={{
            transform: pipDragRef.current.isDragging
              ? `translate(${pipDragDelta.x}px, ${pipDragDelta.y}px)`
              : "none",
            transition: pipDragRef.current.isDragging ? "none" : "transform 0.25s cubic-bezier(0.25, 1, 0.5, 1), top 0.25s, left 0.25s, right 0.25s, bottom 0.25s",
          }}
          className={`absolute ${cornerClasses[pipCorner]} z-30 w-28 sm:w-32 aspect-[3/4] rounded-2xl overflow-hidden shadow-2xl ring-2 ring-brand/70 cursor-grab active:cursor-grabbing hover:scale-102`}
          title="Drag to reposition, tap to swap"
        >
          <VideoTile
            key={pip.id}
            stream={pip.stream}
            label={pip.isLocal ? "You" : pip.username}
            muted={pip.isLocal || pip.isMuted}
            cameraOff={pip.cameraOff || !pip.isCameraOn}
            mirrored={pip.isLocal && !pip.isScreenShare}
            connState={pip.connState}
            isActiveSpeaker={!!activeSpeakers[pip.id]}
            isScreenShare={pip.isScreenShare}
            onRetry={pip.onRetry}
            avatarUrl={pip.avatarUrl}
            avatarName={pip.username}
            className="w-full h-full"
          />
        </div>
      </div>
    );
  }

  // --- LAPTOP/DESKTOP 2-PARTICIPANT: OPTIONAL PIP / SPLIT TOGGLE ---
  if (mode === "desktop" && total === 2 && desktopDuoMode === "pip") {
    const primary = swappedPiP ? displayParticipants[0] : displayParticipants[1];
    const pip = swappedPiP ? displayParticipants[1] : displayParticipants[0];

    return (
      <div className={`relative w-full h-full p-3 overflow-hidden ${className}`}>
        {/* Toggle back to 50/50 Split */}
        <button
          onClick={() => setDesktopDuoMode("split")}
          aria-label="Switch to side-by-side view"
          className="absolute top-5 right-5 z-40 bg-black/60 hover:bg-black/80 backdrop-blur-md px-3 py-1.5 rounded-full ring-1 ring-white/20 text-xs font-medium text-white flex items-center gap-1.5 transition-all shadow-lg"
        >
          <LayoutGrid className="w-3.5 h-3.5" />
          <span>Side by side</span>
        </button>

        {/* Large Stage */}
        <div className="w-full h-full rounded-2xl overflow-hidden shadow-2xl">
          <VideoTile
            key={primary.id}
            stream={primary.stream}
            label={primary.isLocal ? `${primary.username} (You)` : primary.username}
            muted={primary.isLocal || primary.isMuted}
            cameraOff={primary.cameraOff || !primary.isCameraOn}
            mirrored={primary.isLocal && !primary.isScreenShare}
            connState={primary.connState}
            isActiveSpeaker={!!activeSpeakers[primary.id]}
            isScreenShare={primary.isScreenShare}
            onTogglePin={() => setPinnedId(primary.id)}
            onRetry={primary.onRetry}
            avatarUrl={primary.avatarUrl}
            avatarName={primary.username}
            className="w-full h-full"
          />
        </div>

        {/* Floating PiP in bottom-right */}
        <div
          onClick={() => setSwappedPiP((prev) => !prev)}
          className="absolute bottom-6 right-6 z-30 w-52 xl:w-60 aspect-video rounded-2xl overflow-hidden shadow-2xl ring-2 ring-brand/80 cursor-pointer hover:scale-105 transition-all"
          title="Click to swap views"
        >
          <VideoTile
            key={pip.id}
            stream={pip.stream}
            label={pip.isLocal ? "You (Click to swap)" : pip.username}
            muted={pip.isLocal || pip.isMuted}
            cameraOff={pip.cameraOff || !pip.isCameraOn}
            mirrored={pip.isLocal && !pip.isScreenShare}
            connState={pip.connState}
            isActiveSpeaker={!!activeSpeakers[pip.id]}
            isScreenShare={pip.isScreenShare}
            onRetry={pip.onRetry}
            avatarUrl={pip.avatarUrl}
            avatarName={pip.username}
            className="w-full h-full"
          />
        </div>
      </div>
    );
  }

  // --- GENERAL CSS GRID FOR 1 TO 6 PARTICIPANTS ---
  const rowStyle = getGridRowStyle(total, mode);

  return (
    <div className={`relative w-full h-full flex flex-col p-2 sm:p-3 overflow-hidden ${className}`}>
      {/* Desktop 2-Peer view mode switch */}
      {mode === "desktop" && total === 2 && desktopDuoMode === "split" && (
        <button
          onClick={() => setDesktopDuoMode("pip")}
          aria-label="Switch to Picture-in-Picture view"
          className="absolute top-5 right-5 z-20 bg-black/50 hover:bg-black/75 backdrop-blur-md px-3 py-1.5 rounded-full ring-1 ring-white/15 text-xs font-medium text-white/90 flex items-center gap-1.5 transition-all shadow"
        >
          <Maximize2 className="w-3.5 h-3.5" />
          <span>Picture-in-picture</span>
        </button>
      )}

      {/* Room Full Notification Banner if >6 */}
      {isRoomFull && (
        <div className="mb-2 bg-danger/80 backdrop-blur-md text-white px-3 py-1.5 rounded-lg text-xs font-medium flex items-center justify-between gap-2 shadow z-20">
          <div className="flex items-center gap-1.5">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>Room is full (max 6 participants). Some participants cannot be displayed.</span>
          </div>
          <span className="text-[11px] bg-black/30 px-2 py-0.5 rounded font-semibold">6 / 6</span>
        </div>
      )}

      {/* CSS 12-Column Grid */}
      <div className={`flex-1 min-h-0 w-full grid grid-cols-12 ${rowStyle} gap-2 sm:gap-3 transition-all duration-200 ease-out`}>
        {displayParticipants.map((p, idx) => {
          const colClass = getTileGridClass(idx, total, mode, isDesktopWide);
          const isSingle = total === 1;

          return (
            <div
              key={p.id}
              className={`${colClass} min-w-0 min-h-0 flex items-center justify-center transition-all duration-200 ease-out`}
            >
              <VideoTile
                stream={p.stream}
                label={p.isLocal ? (isSingle ? null : `${p.username} (You)`) : p.username}
                muted={p.isLocal || p.isMuted}
                cameraOff={p.cameraOff || !p.isCameraOn}
                mirrored={p.isLocal && !p.isScreenShare}
                connState={p.connState}
                isActiveSpeaker={!!activeSpeakers[p.id]}
                isScreenShare={p.isScreenShare}
                isPinned={false}
                onTogglePin={() => setPinnedId(p.id)}
                onRetry={p.onRetry}
                avatarUrl={p.avatarUrl}
                avatarName={p.username}
                className={isSingle ? "max-w-5xl max-h-[85vh] rounded-3xl" : "w-full h-full"}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
