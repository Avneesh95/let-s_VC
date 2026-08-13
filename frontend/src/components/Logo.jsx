// A single source of truth for the brand mark, used in the sidebar header,
// both auth pages, and error/empty states — so a future rebrand only means
// editing one file instead of hunting down every place "chat/app" text was
// hand-typed (which is exactly the situation this replaces).
const SIZES = {
  sm: { mark: "w-6 h-6 rounded-lg", glyph: "w-3.5 h-3.5", text: "text-base" },
  md: { mark: "w-8 h-8 rounded-lg", glyph: "w-4.5 h-4.5", text: "text-xl" },
  lg: { mark: "w-11 h-11 rounded-xl", glyph: "w-6 h-6", text: "text-2xl md:text-3xl" },
};

export default function Logo({ size = "md", className = "" }) {
  const s = SIZES[size] || SIZES.md;

  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <span
        className={`${s.mark} shrink-0 flex items-center justify-center bg-gradient-to-br from-brand to-brand-dark shadow-neon-brand`}
      >
        <svg viewBox="0 0 24 24" fill="none" className={`${s.glyph} text-white`}>
          <path
            d="M4 5.5C4 4.67 4.67 4 5.5 4h13c.83 0 1.5.67 1.5 1.5v10c0 .83-.67 1.5-1.5 1.5H9l-4 4v-4H5.5A1.5 1.5 0 0 1 4 15.5v-10Z"
            fill="currentColor"
          />
        </svg>
      </span>
      <span className={`font-display font-semibold tracking-tight text-ink ${s.text}`}>
        Peer<span className="text-brand">ly</span>
      </span>
    </span>
  );
}
