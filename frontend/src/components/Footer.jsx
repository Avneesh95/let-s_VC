// Used on the auth pages (Login/Register). A small, understated credit —
// not trying to compete visually with the form above it.
export default function Footer({ showCopyright = false }) {
  return (
    <div className="mt-6 text-center">
      <p className="text-xs text-ink/40 tracking-wide">
        Peerly <span className="text-gold/70">·</span> by{" "}
        <span className="font-medium text-ink/60">Avneesh</span>
        <span className="text-ink/25"> — </span>
        real conversations, real time
      </p>
      {showCopyright && (
        <p className="text-[11px] text-ink/30 mt-1">
          © {new Date().getFullYear()} All rights reserved by Peerly - by Avneesh
        </p>
      )}
    </div>
  );
}
