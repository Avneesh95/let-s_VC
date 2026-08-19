import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Mail, ArrowRight, Loader2, Video, MessageCircle, ShieldCheck, Mic } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import PasswordInput from "../components/PasswordInput";
import ThemeToggle from "../components/ThemeToggle";
import Logo from "../components/Logo";
import Footer from "../components/Footer";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const FEATURES = [
  { icon: Video, text: "Crystal-clear 1:1 and group video calls" },
  { icon: MessageCircle, text: "Real-time messaging, typing indicators & reactions" },
  { icon: ShieldCheck, text: "Private by default — friend-only connections" },
];

// The brand mark from Logo.jsx, redrawn locally — Logo hardcodes text-ink,
// which disappears against the dark hero gradient below, so the hero needs
// its own light-on-dark version of the same glyph to stay one consistent
// mark across the app rather than introducing a second logo design.
function HeroMark() {
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

// Small decorative "call tile" mockups floating on the hero panel — pure
// CSS/SVG, no imagery to source, just enough visual texture that the panel
// reads as a video-calling product at a glance instead of a plain gradient.
function FloatingCallTile({ className, gradientFrom, gradientTo, initial, badge }) {
  return (
    <div
      className={`absolute w-28 rounded-2xl p-2.5 bg-white/10 backdrop-blur-md ring-1 ring-white/20 shadow-premium-lg animate-float-slow ${className}`}
    >
      <div
        className="w-full aspect-[4/3] rounded-xl flex items-center justify-center text-white font-display font-semibold text-lg relative overflow-hidden"
        style={{ background: `linear-gradient(150deg, ${gradientFrom} 0%, ${gradientTo} 140%)` }}
      >
        <span className="absolute inset-0 bg-gradient-to-tr from-white/15 via-transparent to-transparent" />
        <span className="relative">{initial}</span>
        {badge && (
          <span className="absolute bottom-1.5 left-1.5 flex items-center gap-1 bg-black/40 backdrop-blur-sm rounded-full pl-1.5 pr-2 py-0.5">
            <span className="w-1.5 h-1.5 rounded-full bg-danger animate-pulse" />
            <span className="text-[9px] font-medium text-white tracking-wide">LIVE</span>
          </span>
        )}
        {!badge && (
          <span className="absolute bottom-1.5 right-1.5 w-5 h-5 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center">
            <Mic className="w-2.5 h-2.5 text-white" strokeWidth={2} />
          </span>
        )}
      </div>
    </div>
  );
}

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return; // guards against a double-submit from a fast double-click

    // Trim + lowercase before anything else — both so validation checks the
    // value that's actually going to be sent, and because the backend
    // normalizes email the same way. Sending it un-normalized used to be
    // able to fail login with a confusing "Invalid credentials" for an
    // account whose email has different casing, or a value with a stray
    // leading/trailing space from autofill.
    const cleanEmail = email.trim().toLowerCase();

    const nextErrors = {};
    if (!EMAIL_RE.test(cleanEmail)) nextErrors.email = "Enter a valid email address";
    if (!password) nextErrors.password = "Enter your password";
    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setError("");
    setLoading(true);
    try {
      await login(cleanEmail, password);
      navigate("/chat");
    } catch (err) {
      setError(err.response?.data?.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-dvh lg:h-dvh flex bg-paper overflow-hidden">
      {/* ---- Hero panel — brand story, desktop/tablet only ---- */}
      <div className="hidden lg:flex lg:w-[45%] xl:w-[42%] relative flex-col justify-between overflow-hidden bg-brand-gradient text-white p-12 xl:p-16">
        <div className="pointer-events-none absolute inset-0 bg-grain opacity-[0.04] mix-blend-overlay" />
        <div className="pointer-events-none absolute -top-24 -left-24 w-[26rem] h-[26rem] rounded-full bg-white/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -right-16 w-[24rem] h-[24rem] rounded-full bg-gold/20 blur-3xl" />

        <div className="relative z-10">
          <HeroMark />
        </div>

        <div className="relative z-10 max-w-md">
          <span className="inline-flex items-center gap-2 text-gold-light/90 text-xs font-medium uppercase tracking-[0.2em] mb-4">
            <span className="w-6 h-px bg-gold-light/60" /> Video &amp; chat, together
          </span>
          <h1 className="font-serif text-4xl xl:text-[2.75rem] leading-[1.12] font-medium">
            Real conversations,
            <br />
            real time.
          </h1>
          <p className="text-white/70 text-[0.95rem] leading-relaxed mt-4">
            Sign in to pick up your chats and calls right where you left them.
          </p>

          <ul className="mt-8 flex flex-col gap-4">
            {FEATURES.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3">
                <span className="w-9 h-9 shrink-0 rounded-xl bg-white/10 ring-1 ring-white/15 flex items-center justify-center">
                  <Icon className="w-4 h-4" strokeWidth={1.75} />
                </span>
                <span className="text-sm text-white/80">{text}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Floating call-tile decorations — layered around the copy, not on
            top of it, so they read as ambient texture rather than clutter */}
        <FloatingCallTile
          className="top-[18%] right-6 xl:right-10 rotate-[4deg] [animation-delay:-3s]"
          gradientFrom="#DDBE73"
          gradientTo="rgba(0,0,0,0.35)"
          initial="A"
          badge
        />
        <FloatingCallTile
          className="bottom-[22%] right-16 xl:right-24 -rotate-6 [animation-delay:-7s]"
          gradientFrom="#23997A"
          gradientTo="rgba(0,0,0,0.35)"
          initial="S"
        />

        <p className="relative z-10 text-white/40 text-xs">
          © {new Date().getFullYear()} Peerly · by Avneesh
        </p>
      </div>

      {/* ---- Form panel ---- */}
      <div className="relative flex-1 flex items-center justify-center px-4 py-10 overflow-hidden">
        {/* Ambient glow — the primary brand moment on mobile (no hero panel
            there), kept but toned down on desktop where the hero already
            carries most of the visual weight. */}
        <div className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 w-[36rem] h-[36rem] rounded-full bg-brand/10 blur-3xl animate-float-slow lg:opacity-60" />
        <div className="pointer-events-none absolute bottom-[-12rem] right-[-8rem] w-[26rem] h-[26rem] rounded-full bg-gold/10 blur-3xl" />
        <div className="pointer-events-none absolute inset-0 bg-grain opacity-[0.025] mix-blend-overlay" />

        <div className="absolute top-4 right-4 z-10">
          <ThemeToggle />
        </div>

        <div className="relative w-full max-w-sm flex flex-col gap-6">
          <div className="text-center lg:hidden">
            <Logo size="lg" className="justify-center" />
          </div>

          <form
            onSubmit={handleSubmit}
            noValidate
            className="relative bg-surface p-8 pt-7 rounded-2xl shadow-premium-lg border border-line/10 flex flex-col gap-3.5 overflow-hidden"
          >
            <span className="absolute top-0 left-6 right-6 h-px rule-gold" />
            <div className="mb-1.5">
              <h1 className="font-serif text-[1.7rem] leading-tight font-medium text-ink">Welcome back</h1>
              <p className="text-sm text-ink/60 mt-1">Sign in to pick up where you left off.</p>
            </div>
            {error && (
              <p className="text-danger text-sm bg-danger/10 border border-danger/20 rounded-lg px-3 py-2">{error}</p>
            )}

            <div>
              <label className="relative flex items-center">
                <Mail className="absolute left-3.5 w-4 h-4 text-ink/30 pointer-events-none" strokeWidth={1.75} />
                <input
                  type="email"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (fieldErrors.email) setFieldErrors((prev) => ({ ...prev, email: undefined }));
                  }}
                  required
                  autoFocus
                  autoComplete="email"
                  // Email is a login credential compared exactly — a mobile
                  // keyboard silently capitalizing the first letter or
                  // "helpfully" autocorrecting it is how you end up unable
                  // to log back into your own account.
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck="false"
                  aria-invalid={!!fieldErrors.email}
                  className={`w-full border bg-paper/40 rounded-xl pl-10 pr-3 py-2.75 text-base sm:text-sm focus:outline-none focus:ring-2 transition-shadow ${
                    fieldErrors.email
                      ? "border-danger/50 focus:ring-danger/30 focus:border-danger"
                      : "border-line/15 focus:ring-brand/35 focus:border-brand"
                  }`}
                />
              </label>
              {fieldErrors.email && <p className="text-danger text-xs mt-1 ml-1">{fieldErrors.email}</p>}
            </div>

            <PasswordInput
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (fieldErrors.password) setFieldErrors((prev) => ({ ...prev, password: undefined }));
              }}
              autoComplete="current-password"
              error={fieldErrors.password}
            />

            <button
              type="submit"
              disabled={loading}
              className="group bg-brand-gradient hover:brightness-110 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold rounded-xl py-2.75 mt-1.5 transition-all flex items-center justify-center gap-2 shadow-neon-brand"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" strokeWidth={2} />
              ) : (
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" strokeWidth={2} />
              )}
              {loading ? "Logging in…" : "Log in"}
            </button>
            <p className="text-sm text-center text-ink/60">
              No account?{" "}
              <Link to="/register" className="text-brand dark:text-brand-light hover:underline font-medium">
                Register
              </Link>
            </p>
          </form>
          <p className="text-center text-xs text-ink/60">
            Just here for a video call?{" "}
            <Link to="/" className="text-brand dark:text-brand-light hover:underline">
              Join a room instead
            </Link>
          </p>
          <div className="lg:hidden">
            <Footer showCopyright />
          </div>
        </div>
      </div>
    </div>
  );
}
