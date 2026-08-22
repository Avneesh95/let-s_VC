import { Mic } from "lucide-react";

// The brand mark from Logo.jsx, redrawn locally — Logo hardcodes text-ink,
// which disappears against the dark panel below, so the panel needs its
// own light-on-dark version of the same glyph to stay one consistent mark
// across the app rather than introducing a second logo design.
export function HeroMark() {
  return (
    <span className="inline-flex items-center gap-2.5">
      <span className="w-11 h-11 rounded-2xl shrink-0 flex items-center justify-center bg-white/10 ring-1 ring-white/25 relative overflow-hidden backdrop-blur-sm">
        <span className="absolute inset-0 bg-gradient-to-tr from-white/15 via-transparent to-transparent" />
        <svg viewBox="0 0 24 24" fill="none" className="w-5.5 h-5.5 text-white relative">
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
      <span className="font-display font-semibold tracking-tight text-2xl text-white">
        Peer<span className="text-gold-light">ly</span>
      </span>
    </span>
  );
}

// Small decorative "call tile" mockups — pure CSS/SVG, no imagery to
// source, just enough texture that the panel reads as a video-calling
// product at a glance rather than a plain illustration on a plain field.
function FloatingCallTile({ className, gradientFrom, gradientTo, initial, badge }) {
  return (
    <div
      className={`absolute w-24 rounded-2xl p-2 bg-white/10 backdrop-blur-md ring-1 ring-white/20 shadow-premium-lg animate-float-slow ${className}`}
    >
      <div
        className="w-full aspect-[4/3] rounded-lg flex items-center justify-center text-white font-display font-semibold text-base relative overflow-hidden"
        style={{ background: `linear-gradient(150deg, ${gradientFrom} 0%, ${gradientTo} 140%)` }}
      >
        <span className="absolute inset-0 bg-gradient-to-tr from-white/15 via-transparent to-transparent" />
        <span className="relative">{initial}</span>
        {badge && (
          <span className="absolute bottom-1 left-1 flex items-center gap-1 bg-black/40 backdrop-blur-sm rounded-full pl-1.5 pr-2 py-0.5">
            <span className="w-1.5 h-1.5 rounded-full bg-danger animate-pulse" />
            <span className="text-[8px] font-medium text-white tracking-wide">LIVE</span>
          </span>
        )}
        {!badge && (
          <span className="absolute bottom-1 right-1 w-4 h-4 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center">
            <Mic className="w-2 h-2 text-white" strokeWidth={2} />
          </span>
        )}
      </div>
    </div>
  );
}

// The panel's centerpiece: someone mid video-call on their phone, a chat
// bubble with a typing indicator floating beside them, warm light spilling
// out behind — the "screen glow" standing in for the doorway-light moment
// a generic welcome illustration would use, but built from Peerly's own
// product (a call in progress) rather than a stock scene that has nothing
// to do with what the app actually is.
function CallerIllustration({ className }) {
  return (
    <svg viewBox="0 0 300 380" fill="none" className={className} aria-hidden="true">
      <defs>
        <radialGradient id="glow" cx="50%" cy="46%" r="55%">
          <stop offset="0%" stopColor="#FFA733" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#FFA733" stopOpacity="0" />
        </radialGradient>
      </defs>

      <circle cx="150" cy="200" r="150" fill="url(#glow)" />
      <ellipse cx="150" cy="358" rx="72" ry="9" fill="black" opacity="0.28" />

      {/* legs */}
      <rect x="128" y="292" width="19" height="72" rx="9.5" fill="#241A14" />
      <rect x="153" y="288" width="19" height="72" rx="9.5" fill="#2E211A" transform="rotate(7 162.5 324)" />
      <rect x="122" y="358" width="30" height="11" rx="5.5" fill="#FFA733" />
      <rect x="154" y="356" width="30" height="11" rx="5.5" fill="#C9791C" transform="rotate(7 169 361.5)" />

      {/* relaxed arm */}
      <path d="M172 213 Q189 246 181 282" stroke="#C2440A" strokeWidth="17" strokeLinecap="round" />
      <circle cx="181" cy="284" r="8.5" fill="#E8A972" />

      {/* torso (hoodie) */}
      <rect x="117" y="198" width="66" height="102" rx="27" fill="#F4600F" />
      <path d="M133 198 Q150 214 167 198" stroke="#C2440A" strokeWidth="3.5" fill="none" strokeLinecap="round" />

      {/* raised arm holding the phone */}
      <path d="M127 214 Q158 202 187 231" stroke="#F4600F" strokeWidth="17" strokeLinecap="round" />
      <circle cx="188" cy="232" r="8.5" fill="#E8A972" />

      {/* neck + head */}
      <rect x="141" y="184" width="18" height="20" fill="#E8A972" />
      <circle cx="150" cy="168" r="27" fill="#E8A972" />
      <path
        d="M122 162 Q150 128 178 162 Q179 144 150 138 Q121 144 122 162 Z"
        fill="#20140C"
      />
      <circle cx="141" cy="169" r="2.2" fill="#20140C" />
      <circle cx="159" cy="169" r="2.2" fill="#20140C" />
      <path d="M141 178 Q150 184 159 178" stroke="#20140C" strokeWidth="2.2" fill="none" strokeLinecap="round" />

      {/* phone */}
      <rect x="176" y="204" width="35" height="59" rx="8" fill="#F4F1EA" />
      <rect x="180.5" y="211" width="26" height="38" rx="4" fill="#161213" />
      <circle cx="193.5" cy="208" r="1.6" fill="#161213" opacity="0.4" />
      <circle cx="186" cy="219" r="2.1" fill="#FFA733" />
      <rect x="184" y="228" width="19" height="2.2" rx="1.1" fill="#F4F1EA" opacity="0.55" />
      <rect x="184" y="234" width="14" height="2.2" rx="1.1" fill="#F4F1EA" opacity="0.4" />
      <path
        d="M209 199 A10 10 0 0 1 219 209 M212 203 A6 6 0 0 1 218 209"
        stroke="#FFA733"
        strokeWidth="1.8"
        strokeLinecap="round"
        fill="none"
        opacity="0.65"
      />

      {/* floating chat bubble with a typing indicator — a Peerly feature,
          not a generic decoration */}
      <g transform="translate(196 118)">
        <rect width="52" height="34" rx="12" fill="white" fillOpacity="0.1" stroke="white" strokeOpacity="0.22" />
        <path d="M14 34 L6 44 L20 34 Z" fill="white" fillOpacity="0.1" />
        <circle cx="16" cy="17" r="2.6" fill="white" fillOpacity="0.75" />
        <circle cx="26" cy="17" r="2.6" fill="white" fillOpacity="0.5" />
        <circle cx="36" cy="17" r="2.6" fill="white" fillOpacity="0.28" />
      </g>
    </svg>
  );
}

/**
 * Shared dark, diagonally-clipped hero panel for Login/Register — desktop
 * and up only (matches the pre-existing convention that this kind of
 * brand-forward panel doesn't appear on narrow screens, where the form
 * itself needs the full width instead).
 */
export default function AuthHero({ eyebrow, title, tagline }) {
  return (
    <div
      className="hidden lg:flex lg:w-[50%] xl:w-[47%] absolute inset-y-0 left-0 z-10 flex-col justify-between overflow-hidden bg-ink text-white p-12 xl:p-16"
      style={{ clipPath: "polygon(0 0, 100% 0, 76% 100%, 0 100%)" }}
    >
      <div className="pointer-events-none absolute inset-0 bg-grain opacity-[0.05] mix-blend-overlay" />
      <div className="pointer-events-none absolute -top-24 -left-24 w-[26rem] h-[26rem] rounded-full bg-brand/15 blur-3xl" />

      <div className="relative z-10">
        <HeroMark />
      </div>

      <div className="relative z-10 flex flex-col items-center text-center">
        <CallerIllustration className="w-56 xl:w-64 h-auto mb-2" />
        <span className="inline-flex items-center gap-2 text-gold-light/90 text-xs font-medium uppercase tracking-[0.2em] mb-3">
          <span className="w-6 h-px bg-gold-light/60" /> {eyebrow}
        </span>
        <h1 className="font-serif text-3xl xl:text-[2.15rem] leading-[1.15] font-medium max-w-xs">{title}</h1>
        <p className="text-white/65 text-[0.9rem] leading-relaxed mt-3 max-w-[19rem]">{tagline}</p>
      </div>

      <FloatingCallTile
        className="top-[15%] right-2 xl:right-6 rotate-[4deg] [animation-delay:-3s]"
        gradientFrom="#FFC069"
        gradientTo="rgba(0,0,0,0.35)"
        initial="A"
        badge
      />
      <FloatingCallTile
        className="bottom-[16%] right-6 xl:right-10 -rotate-6 [animation-delay:-7s]"
        gradientFrom="#F4600F"
        gradientTo="rgba(0,0,0,0.35)"
        initial="S"
      />

      <p className="relative z-10 text-white/40 text-xs">© {new Date().getFullYear()} Peerly · by Avneesh</p>
    </div>
  );
}
