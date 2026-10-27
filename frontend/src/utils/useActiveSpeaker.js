import { useEffect, useRef, useState } from "react";

/**
 * Hook to detect active speakers among participant streams using Web Audio AnalyserNode.
 * 
 * @param {Array<{ id: string, stream: MediaStream | null, isMuted?: boolean }>} participants
 * @returns {Record<string, boolean>} Map of participantId -> isActiveSpeaker (boolean)
 */
export function useActiveSpeaker(participants = []) {
  const [activeSpeakers, setActiveSpeakers] = useState({});
  const audioContextRef = useRef(null);
  const analysersRef = useRef(new Map()); // id -> { source, analyser, lastSpoke }
  const animationFrameRef = useRef(null);

  useEffect(() => {
    // Only initialize AudioContext in browser environments supporting it
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;

    if (!audioContextRef.current || audioContextRef.current.state === "closed") {
      audioContextRef.current = new AudioCtx();
    }
    const ctx = audioContextRef.current;
    if (ctx.state === "suspended") {
      const resume = () => ctx.resume();
      window.addEventListener("click", resume, { once: true });
      window.addEventListener("touchstart", resume, { once: true });
    }

    const currentMap = analysersRef.current;
    const activeIds = new Set();

    participants.forEach((p) => {
      if (!p || !p.id || !p.stream || p.isMuted) return;
      activeIds.add(p.id);

      const audioTrack = p.stream.getAudioTracks()[0];
      if (!audioTrack || !audioTrack.enabled || audioTrack.readyState !== "live") return;

      if (!currentMap.has(p.id)) {
        try {
          const source = ctx.createMediaStreamSource(p.stream);
          const analyser = ctx.createAnalyser();
          analyser.fftSize = 256;
          analyser.smoothingTimeConstant = 0.4;
          source.connect(analyser);
          currentMap.set(p.id, { source, analyser, lastSpoke: 0 });
        } catch {
          // May fail if stream has no audio or CORS restriction
        }
      }
    });

    // Cleanup tracks no longer present
    for (const [id, entry] of currentMap.entries()) {
      if (!activeIds.has(id)) {
        try {
          entry.source.disconnect();
        } catch {}
        currentMap.delete(id);
      }
    }

    const dataArray = new Uint8Array(128);
    const SPEAKING_THRESHOLD = 18; // 0-255 scaled byte frequency data
    const HOLD_TIME_MS = 450;

    const checkAudioLevels = () => {
      const now = Date.now();
      const nextSpeakers = {};

      for (const [id, entry] of currentMap.entries()) {
        try {
          entry.analyser.getByteFrequencyData(dataArray);
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i];
          }
          const average = sum / dataArray.length;

          if (average > SPEAKING_THRESHOLD) {
            entry.lastSpoke = now;
          }

          if (now - entry.lastSpoke < HOLD_TIME_MS) {
            nextSpeakers[id] = true;
          }
        } catch {}
      }

      setActiveSpeakers((prev) => {
        // Compare to prevent redundant state updates
        const prevKeys = Object.keys(prev).filter((k) => prev[k]);
        const nextKeys = Object.keys(nextSpeakers).filter((k) => nextSpeakers[k]);
        if (
          prevKeys.length === nextKeys.length &&
          prevKeys.every((k) => nextSpeakers[k])
        ) {
          return prev;
        }
        return nextSpeakers;
      });

      animationFrameRef.current = requestAnimationFrame(checkAudioLevels);
    };

    animationFrameRef.current = requestAnimationFrame(checkAudioLevels);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [participants]);

  // Global unmount cleanup
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      analysersRef.current.forEach((entry) => {
        try {
          entry.source.disconnect();
        } catch {}
      });
      analysersRef.current.clear();
      if (audioContextRef.current && audioContextRef.current.state !== "closed") {
        audioContextRef.current.close().catch(() => {});
      }
    };
  }, []);

  return activeSpeakers;
}
