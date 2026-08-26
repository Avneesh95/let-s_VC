// Used on the auth pages (Login/Register). A small, understated credit —
// not trying to compete visually with the form above it. `light` renders
// it for use directly on the orange field (Login/Register's mobile view)
// where the default ink-based tones read too faint to be legible.
export default function Footer({ showCopyright = false, light = false }) {
  const base = light ? "text-white/70" : "text-ink/40";
  const dim = light ? "text-white/40" : "text-ink/25";
  const dimmer = light ? "text-white/30" : "text-ink/30";
  const strong = light ? "text-white/85" : "text-ink/60";
  const accent = light ? "text-white/60" : "text-gold/70";

  return (
    <div className="mt-6 text-center">
      <p className={`text-xs tracking-wide ${base}`}>
        Peerly <span className={accent}>·</span> by <span className={`font-medium ${strong}`}>Avneesh</span>
        <span className={dim}> — </span>
        real conversations, real time
      </p>
      {showCopyright && (
        <p className={`text-[11px] mt-1 ${dimmer}`}>
          © {new Date().getFullYear()} All rights reserved by Peerly - by Avneesh
        </p>
      )}
    </div>
  );
}
