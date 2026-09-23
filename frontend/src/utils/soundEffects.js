// Web Audio API Synthesized Sound Effects & Haptics Engine for Peerly
// Zero external mp3 dependencies — lightweight, instant, and crisp.

let audioCtx = null;

function getAudioContext() {
  if (typeof window === "undefined") return null;
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return null;
    audioCtx = new AudioContextClass();
  }
  if (audioCtx.state === "suspended") {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

export function getSoundEnabled() {
  try {
    const val = localStorage.getItem("peerly_sound_enabled");
    return val !== null ? val === "true" : true;
  } catch {
    return true;
  }
}

export function setSoundEnabled(enabled) {
  try {
    localStorage.setItem("peerly_sound_enabled", String(enabled));
  } catch {}
}

export function getHapticsEnabled() {
  try {
    const val = localStorage.getItem("peerly_haptics_enabled");
    return val !== null ? val === "true" : true;
  } catch {
    return true;
  }
}

export function setHapticsEnabled(enabled) {
  try {
    localStorage.setItem("peerly_haptics_enabled", String(enabled));
  } catch {}
}

export function triggerHaptic(type = "light") {
  if (!getHapticsEnabled() || typeof navigator === "undefined" || !navigator.vibrate) {
    return;
  }
  try {
    if (type === "light") {
      navigator.vibrate(15);
    } else if (type === "medium") {
      navigator.vibrate(28);
    } else if (type === "success") {
      navigator.vibrate([15, 30, 20]);
    } else if (type === "warning") {
      navigator.vibrate([30, 50, 30]);
    }
  } catch {}
}

// Satisfying upward "pop" sound when message is sent
export function playSendSound() {
  if (!getSoundEnabled()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(440, now);
    osc.frequency.exponentialRampToValueAtTime(880, now + 0.08);

    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.08);
    triggerHaptic("light");
  } catch (err) {
    console.debug("playSendSound failed:", err);
  }
}

// Pleasant dual-tone water bubble chime when message is received
export function playReceiveSound() {
  if (!getSoundEnabled()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();

    osc1.type = "sine";
    osc1.frequency.setValueAtTime(587.33, now); // D5
    osc1.frequency.exponentialRampToValueAtTime(880, now + 0.12); // A5

    osc2.type = "triangle";
    osc2.frequency.setValueAtTime(880, now + 0.04);
    osc2.frequency.exponentialRampToValueAtTime(1174.66, now + 0.16); // D6

    gain.gain.setValueAtTime(0.09, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);

    osc1.start(now);
    osc1.stop(now + 0.14);
    osc2.start(now + 0.04);
    osc2.stop(now + 0.2);

    triggerHaptic("medium");
  } catch (err) {
    console.debug("playReceiveSound failed:", err);
  }
}

// Subtle click feedback for buttons/actions
export function playClickSound() {
  if (!getSoundEnabled()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(900, now);
    osc.frequency.exponentialRampToValueAtTime(400, now + 0.03);

    gain.gain.setValueAtTime(0.04, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.03);
    triggerHaptic("light");
  } catch {}
}
