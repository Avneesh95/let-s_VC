// A single source of truth for the brand mark, used in the sidebar header,
// both auth pages, and error/empty states — so a future rebrand only means
// editing one file instead of hunting down every place "chat/app" text was
// hand-typed (which is exactly the situation this replaces).
//
// The glyph is two overlapping speech-bubbles — a literal "peer to peer"
// mark — finished with a hairline gold rim so it reads as a badge, not a
// flat icon tile.
const SIZES = {
  sm: { mark: "w-7 h-7 rounded-[10px]", glyph: "w-3.5 h-3.5", text: "text-base" },
  md: { mark: "w-9 h-9 rounded-xl", glyph: "w-4.5 h-4.5", text: "text-xl" },
  lg: { mark: "w-12 h-12 rounded-2xl", glyph: "w-6 h-6", text: "text-2xl md:text-3xl" },
};

export default function Logo({ size = "md", className = "" }) {
  const s = SIZES[size] || SIZES.md;

  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <span
        className={`${s.mark} shrink-0 flex items-center justify-center bg-brand-gradient shadow-neon-brand ring-1 ring-gold/40 relative overflow-hidden`}
      >
        {/* faint diagonal sheen for a polished, lacquered feel */}
        <span className="absolute inset-0 bg-gradient-to-tr from-white/15 via-transparent to-transparent" />
        <svg viewBox="0 0 24 24" fill="none" className={`${s.glyph} text-white relative`}>
          <path
            d="M3 6.2C3 5.08 3.9 4.2 5 4.2h9c1.1 0 2 .88 2 2v6c0 1.1-.9 2-2 2H8.4L5 17.5V14.2H5c-1.1 0-2-.9-2-2V6.2Z"
            fill="currentColor"
            opacity="0.55"
          />
          <path
            d="M9.5 9.4c0-1.1.9-2 2-2h7c1.1 0 2 .9 2 2v5.4c0 1.1-.9 2-2 2h-.9v3l-3.3-3H11.5c-1.1 0-2-.9-2-2V9.4Z"
            fill="currentColor"
          />
        </svg>
      </span>
      <span className={`font-display font-semibold tracking-tight text-ink ${s.text}`}>
        Peer<span className="text-brand dark:text-brand-light">ly</span>
      </span>
    </span>
  );
}
