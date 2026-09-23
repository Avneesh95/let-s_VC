const SIZES = {
  sm: { mark: "w-8 h-8 rounded-xl", glyph: "w-4.5 h-4.5", text: "text-base" },
  md: { mark: "w-10 h-10 rounded-2xl", glyph: "w-5.5 h-5.5", text: "text-xl" },
  lg: { mark: "w-13 h-13 rounded-3xl", glyph: "w-7.5 h-7.5", text: "text-2xl sm:text-3xl" },
};

export default function Logo({ size = "md", className = "", onDark = false }) {
  const s = SIZES[size] || SIZES.md;

  return (
    <span className={`inline-flex items-center gap-2.5 select-none ${className}`}>
      <span
        className={`${s.mark} shrink-0 flex items-center justify-center bg-gradient-to-br from-[#FFA733] via-[#F4600F] to-[#C2440A] shadow-[0_4px_16px_rgba(244,96,15,0.4)] ring-1 ring-white/20 relative overflow-hidden transition-transform hover:scale-105`}
      >
        {/* Specular highlights */}
        <span className="absolute inset-0 bg-gradient-to-tr from-white/25 via-transparent to-transparent pointer-events-none" />
        <svg viewBox="0 0 32 32" fill="none" className={`${s.glyph} text-white relative drop-shadow-sm`}>
          {/* Interlocking P2P Video Bubble 1 */}
          <path
            d="M4 8C4 5.79 5.79 4 8 4H18C20.21 4 22 5.79 22 8V16C22 18.21 20.21 20 18 20H10L6 24V20H8C5.79 20 4 18.21 4 16V8Z"
            fill="currentColor"
            fillOpacity="0.95"
          />
          {/* Bubble 2 Camera Notch */}
          <circle cx="11" cy="12" r="2.5" fill="#F4600F" />
          <circle cx="17" cy="12" r="2.5" fill="#FFA733" />
          {/* Mini video play triangle */}
          <path
            d="M20 13L27 9V21L20 17V13Z"
            fill="currentColor"
            fillOpacity="0.85"
          />
        </svg>
      </span>

      <span
        className={`font-display font-bold tracking-tight leading-none ${
          onDark ? "text-white" : "text-ink"
        } ${s.text}`}
      >
        Peer<span className="text-brand dark:text-brand-light">ly</span>
      </span>
    </span>
  );
}
