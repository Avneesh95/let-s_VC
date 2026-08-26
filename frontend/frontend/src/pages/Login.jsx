import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, Loader2 } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import PasswordInput from "../components/PasswordInput";
import ThemeToggle from "../components/ThemeToggle";
import Footer from "../components/Footer";
import AuthHero, { HeroMark } from "../components/AuthHero";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
    <div className="relative min-h-dvh lg:h-dvh bg-brand overflow-hidden">
      {/* Ambient texture on the orange field itself — subtle, desktop only
          (mobile's orange area is small enough it reads as flat color,
          which is the right call there). */}
      <div className="hidden lg:block pointer-events-none absolute inset-0 bg-grain opacity-[0.05] mix-blend-overlay" />
      <div className="hidden lg:block pointer-events-none absolute bottom-[-14rem] right-[-10rem] w-[30rem] h-[30rem] rounded-full bg-white/10 blur-3xl" />

      <AuthHero
        eyebrow="Video & chat, together"
        title="Real conversations, real time."
        tagline="Sign in to pick up your chats and calls right where you left them."
      />

      {/* ---- Form side ---- */}
      <div className="relative min-h-dvh lg:h-dvh flex items-center justify-center px-4 py-10 lg:pl-[46%] xl:pl-[43%] lg:pr-12 xl:pr-20">
        {/* Mobile-only ambient glow — desktop already gets its brand
            moment from the hero panel and the orange field itself. */}
        <div className="lg:hidden pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 w-[36rem] h-[36rem] rounded-full bg-white/10 blur-3xl animate-float-slow" />
        <div className="lg:hidden pointer-events-none absolute inset-0 bg-grain opacity-[0.04] mix-blend-overlay" />

        <div className="absolute top-4 right-4 z-20">
          <ThemeToggle />
        </div>

        <div className="relative w-full max-w-sm flex flex-col gap-5">
          <div className="text-center lg:hidden">
            <HeroMark />
          </div>

          <form
            onSubmit={handleSubmit}
            noValidate
            className="relative bg-surface rounded-2xl shadow-premium-lg overflow-hidden"
          >
            <div className="flex items-center justify-between px-7 pt-6 pb-4 border-b border-line/10">
              <span className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-brand dark:text-brand-light">
                Already a member
              </span>
              <Link to="/" className="text-xs text-ink/45 hover:text-ink/70 transition-colors">
                Guest access
              </Link>
            </div>

            <div className="p-7 pt-5 flex flex-col gap-3.5">
              {error && (
                <p className="text-danger text-sm bg-danger/10 border border-danger/20 rounded-lg px-3 py-2">{error}</p>
              )}

              <div>
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
                  className={`w-full bg-paper rounded-xl px-4 py-3 text-base sm:text-sm text-ink placeholder:text-ink/35 focus:outline-none focus:ring-2 transition-shadow ${
                    fieldErrors.email ? "ring-2 ring-danger/50 focus:ring-danger" : "ring-1 ring-line/10 focus:ring-brand/50"
                  }`}
                />
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
                className="group bg-ink hover:brightness-125 disabled:opacity-60 disabled:cursor-not-allowed text-paper font-semibold uppercase tracking-[0.1em] text-sm rounded-xl py-3 mt-1.5 transition-all flex items-center justify-center gap-2"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" strokeWidth={2} />
                ) : (
                  <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" strokeWidth={2} />
                )}
                {loading ? "Signing in…" : "Sign in"}
              </button>
            </div>
          </form>

          <p className="text-sm text-center text-white/85">
            Don&apos;t have an account yet?{" "}
            <Link to="/register" className="text-white font-semibold hover:underline">
              Create an account
            </Link>
          </p>

          <div className="lg:hidden">
            <Footer showCopyright light />
          </div>
        </div>
      </div>
    </div>
  );
}
