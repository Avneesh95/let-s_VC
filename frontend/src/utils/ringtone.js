// A classic two-tone ring, synthesized entirely in the browser — no audio
// file to fetch, host, or keep in sync with the rest of the app.
//
// Note: browsers block audio playback without a prior user gesture on that
// page. In practice this is rarely an issue here, since by the time a call
// could possibly arrive, the person has already been clicking around the
// app (autoplay permission is sticky per page-visit once granted) — but
// it's the reason this fails silently rather than throwing, on the rare
// cold-load case where it hasn't been granted yet.

let audioCtx = null;
let intervalId = null;

function getContext() {
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

function playTone(freq1, freq2, duration) {
  const ctx = getContext();
  if (!ctx) return;

  const gain = ctx.createGain();
  gain.gain.value = 0.12;
  gain.connect(ctx.destination);

  [freq1, freq2].forEach((freq) => {
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = freq;
    osc.connect(gain);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  });
}

function stop() {
  if (intervalId) clearInterval(intervalId);
  intervalId = null;
}

// Incoming call — a brisk, attention-getting double ring, repeated.
export function startRingtone() {
  stop();
  const ring = () => {
    playTone(480, 620, 0.35);
    setTimeout(() => playTone(480, 620, 0.35), 500);
  };
  ring();
  intervalId = setInterval(ring, 1800);
}

// Waiting for the other person to answer — a single, softer beep, like a
// phone's ringback tone, spaced further apart so it doesn't feel urgent.
export function startRingback() {
  stop();
  const beep = () => playTone(400, 400, 0.9);
  beep();
  intervalId = setInterval(beep, 3000);
}

export function stopRingtone() {
  stop();
}
