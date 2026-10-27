// Desktop video capture candidate profiles
const DESKTOP_VIDEO_PROFILES = [
  { width: 1280, height: 720, frameRate: 30 },
  { width: 960, height: 540, frameRate: 30 },
  { width: 640, height: 480, frameRate: 24 },
];

// Modest mobile video capture profiles (prevents overheating & excessive upstream load)
const MOBILE_VIDEO_PROFILES = [
  { width: 640, height: 480, frameRate: 24 },
  { width: 480, height: 360, frameRate: 20 },
  { width: 320, height: 240, frameRate: 15 },
];

/**
 * Adaptive Bitrate & Encoding Profiles based on participant count in mesh WebRTC.
 * In mesh P2P, each user uploads to (N-1) peers. Quality tiers scale down to protect uplink:
 * - 2 peers (1-1): 720p, 1500 kbps, 30 fps
 * - 3-4 peers: 480p, 600 kbps, 24 fps (scaleDownBy 1.5)
 * - 5-6 peers: 360p, 350 kbps, 20 fps (scaleDownBy 2.0)
 */
export const PARTICIPANT_QUALITY_PROFILES = {
  duo: {
    maxBitrate: 1500000,
    scaleResolutionDownBy: 1.0,
    maxFramerate: 30,
    label: "720p",
  },
  smallGroup: {
    maxBitrate: 600000,
    scaleResolutionDownBy: 1.5,
    maxFramerate: 24,
    label: "480p",
  },
  largeGroup: {
    maxBitrate: 350000,
    scaleResolutionDownBy: 2.0,
    maxFramerate: 20,
    label: "360p",
  },
};

export function getQualityProfileByParticipantCount(participantCount) {
  const count = Number(participantCount) || 1;
  if (count <= 2) return PARTICIPANT_QUALITY_PROFILES.duo;
  if (count <= 4) return PARTICIPANT_QUALITY_PROFILES.smallGroup;
  return PARTICIPANT_QUALITY_PROFILES.largeGroup;
}

export function getMediaConstraintCandidates() {
  const supported = navigator.mediaDevices?.getSupportedConstraints?.() || {};
  const audio = {
    ...(supported.echoCancellation !== false && { echoCancellation: true }),
    ...(supported.noiseSuppression !== false && { noiseSuppression: true }),
    ...(supported.autoGainControl !== false && { autoGainControl: true }),
  };

  const isMobile = isMobileViewport();
  const profiles = isMobile ? MOBILE_VIDEO_PROFILES : DESKTOP_VIDEO_PROFILES;

  return profiles.map(({ width, height, frameRate }) => ({
    video: {
      width: { ideal: width },
      height: { ideal: height },
      frameRate: { ideal: frameRate, max: frameRate },
      ...(isMobile ? { facingMode: { ideal: "user" } } : {}),
    },
    audio,
  }));
}

export function isMobileViewport() {
  return typeof window !== "undefined" && window.matchMedia?.("(max-width: 767px)").matches;
}

export function getQualityProfile(quality) {
  if (quality === "poor") return { maxBitrate: 400000, scaleResolutionDownBy: 2.5, maxFramerate: 20 };
  if (quality === "medium") return { maxBitrate: 800000, scaleResolutionDownBy: 1.5, maxFramerate: 24 };
  return { maxBitrate: 1500000, scaleResolutionDownBy: 1, maxFramerate: 30 };
}

export function classifyConnectionQuality({ packetLoss = 0, rtt = 0, jitter = 0 }) {
  if (packetLoss >= 8 || rtt >= 500 || jitter >= 100) return "poor";
  if (packetLoss >= 3 || rtt >= 250 || jitter >= 40) return "medium";
  return "good";
}

export function getVideoFitMode(aspectRatio, isScreenShare = false) {
  if (isScreenShare) return "contain";
  if (Number.isFinite(aspectRatio) && aspectRatio > 0 && aspectRatio < 1) return "portrait";
  return "cover";
}
