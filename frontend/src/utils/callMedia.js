const VIDEO_PROFILES = [
  { width: 1280, height: 720, frameRate: 30 },
  { width: 960, height: 540, frameRate: 30 },
  { width: 640, height: 480, frameRate: 24 },
];

export function getMediaConstraintCandidates() {
  const supported = navigator.mediaDevices?.getSupportedConstraints?.() || {};
  const audio = {
    ...(supported.echoCancellation !== false && { echoCancellation: true }),
    ...(supported.noiseSuppression !== false && { noiseSuppression: true }),
    ...(supported.autoGainControl !== false && { autoGainControl: true }),
  };

  return VIDEO_PROFILES.map(({ width, height, frameRate }) => ({
    video: {
      width: { ideal: width },
      height: { ideal: height },
      frameRate: { ideal: frameRate, max: frameRate },
      ...(isMobileViewport() ? { facingMode: { ideal: "user" } } : {}),
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
