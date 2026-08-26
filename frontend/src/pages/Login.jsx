import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Mail, ArrowRight, Loader2, Key } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import PasswordInput from "../components/PasswordInput";
import ThemeToggle from "../components/ThemeToggle";

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
    if (loading) return;

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
      setError(err.response?.data?.message || "Invalid email or password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-dvh bg-[#eef2f6] dark:bg-[#0c0f14] flex flex-col justify-between md:justify-center items-center p-0 md:p-6 transition-colors duration-200 relative overflow-x-hidden">
      {/* Top right theme toggle */}
      <div className="absolute top-4 right-4 z-30">
        <ThemeToggle />
      </div>

      {/* ===================== MOBILE HEADER (Visible on mobile only - Image 2) ===================== */}
      <div className="md:hidden w-full relative">
        <div
          className="w-full h-36 bg-gradient-to-r from-[#FFA733] via-[#FA7B17] to-[#F4600F] relative flex items-start justify-between px-6 pt-5"
          style={{
            borderBottomLeftRadius: "60px",
            borderBottomRightRadius: "90px",
          }}
        >
          {/* Subtle decorative glow */}
          <div className="absolute -top-10 -left-10 w-32 h-32 bg-white/20 rounded-full blur-2xl pointer-events-none" />
          <Link to="/" className="text-white/90 text-sm font-semibold tracking-wide">
            Peerly
          </Link>
          <Link
            to="/register"
            className="text-white font-semibold text-sm hover:underline tracking-wide bg-white/15 px-3.5 py-1 rounded-full backdrop-blur-sm"
          >
            Sign Up
          </Link>
        </div>
      </div>

      {/* ===================== MAIN CARD (Desktop 2-Panel + Mobile Form) ===================== */}
      <div className="w-full max-w-4xl bg-surface md:rounded-[2.25rem] md:shadow-[0_20px_60px_rgba(0,0,0,0.1)] border-0 md:border md:border-line/10 overflow-hidden flex-1 md:flex-none flex flex-col md:flex-row min-h-0 md:min-h-[540px] z-10">
        {/* ----- LEFT / FORM PANE ----- */}
        <div className="flex-1 flex flex-col justify-center px-6 sm:px-10 md:px-12 py-8 md:py-12">
          {/* Mobile Heading */}
          <div className="md:hidden mb-8">
            <h1 className="text-3xl font-bold text-ink font-display tracking-tight">Login</h1>
            <p className="text-sm text-ink/50 mt-1">Please sign-in to continue</p>
          </div>

          {/* Desktop Heading */}
          <div className="hidden md:block text-center mb-6">
            <h1 className="text-3xl font-extrabold text-ink font-display">Sign In</h1>
            {/* Social Login Buttons */}
            <div className="flex justify-center gap-3 my-4">
              <button
                type="button"
                className="w-10 h-10 rounded-xl border border-line/15 hover:border-brand/40 hover:bg-ink/5 flex items-center justify-center text-ink/70 hover:text-ink transition-all active:scale-95 text-xs font-bold"
                title="Google"
              >
                G+
              </button>
              <button
                type="button"
                className="w-10 h-10 rounded-xl border border-line/15 hover:border-brand/40 hover:bg-ink/5 flex items-center justify-center text-ink/70 hover:text-ink transition-all active:scale-95 text-xs font-bold font-serif"
                title="Facebook"
              >
                f
              </button>
              <button
                type="button"
                className="w-10 h-10 rounded-xl border border-line/15 hover:border-brand/40 hover:bg-ink/5 flex items-center justify-center text-ink/70 hover:text-ink transition-all active:scale-95 text-xs font-bold"
                title="LinkedIn"
              >
                in
              </button>
              <button
                type="button"
                className="w-10 h-10 rounded-xl border border-line/15 hover:border-brand/40 hover:bg-ink/5 flex items-center justify-center text-ink/70 hover:text-ink transition-all active:scale-95 text-xs font-bold"
                title="GitHub"
              >
                git
              </button>
            </div>
            <p className="text-xs text-ink/45">or use your email and password</p>
          </div>

          {error && (
            <div className="mb-4 text-danger text-xs sm:text-sm bg-danger/10 border border-danger/20 rounded-2xl px-4 py-2.5 text-center font-medium">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
            {/* Email Field */}
            <div className="w-full">
              <div className="relative flex items-center">
                <span className="absolute left-4 text-ink/40 pointer-events-none flex items-center justify-center">
                  <Mail className="w-4 h-4" strokeWidth={2} />
                </span>
                <input
                  type="email"
                  placeholder="Your Email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (fieldErrors.email) setFieldErrors((prev) => ({ ...prev, email: undefined }));
                  }}
                  required
                  autoFocus
                  autoComplete="email"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck="false"
                  aria-invalid={!!fieldErrors.email}
                  className={`w-full bg-[#f3f4f6] dark:bg-paper rounded-full pl-11 pr-4 py-3.5 text-base sm:text-sm text-ink placeholder:text-ink/35 focus:outline-none focus:ring-2 transition-all shadow-sm border border-line/5 ${
                    fieldErrors.email
                      ? "ring-2 ring-danger/50 focus:ring-danger"
                      : "focus:ring-brand/40 focus:bg-surface"
                  }`}
                />
              </div>
              {fieldErrors.email && <p className="text-danger text-xs mt-1 ml-4">{fieldErrors.email}</p>}
            </div>

            {/* Password Field */}
            <PasswordInput
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (fieldErrors.password) setFieldErrors((prev) => ({ ...prev, password: undefined }));
              }}
              placeholder="Password"
              autoComplete="current-password"
              error={fieldErrors.password}
              leftIcon={true}
              inputClassName={`w-full bg-[#f3f4f6] dark:bg-paper rounded-full pl-11 pr-11 py-3.5 text-base sm:text-sm text-ink placeholder:text-ink/35 focus:outline-none focus:ring-2 transition-all shadow-sm border border-line/5 ${
                fieldErrors.password
                  ? "ring-2 ring-danger/50 focus:ring-danger"
                  : "focus:ring-brand/40 focus:bg-surface"
              }`}
            />

            {/* Forgot Password Link */}
            <div className="flex justify-end text-xs text-ink/50 hover:text-brand transition-colors pt-1 px-1">
              <Link to="/register">Forgot Password ?</Link>
            </div>

            {/* Desktop Submit Button */}
            <div className="hidden md:flex flex-col items-center gap-3 mt-4">
              <button
                type="submit"
                disabled={loading}
                className="bg-[#E53935] hover:bg-[#D32F2F] hover:shadow-lg disabled:opacity-60 text-white font-bold uppercase tracking-wider text-xs rounded-full py-3.5 px-12 transition-all active:scale-95 shadow-md flex items-center justify-center gap-2 cursor-pointer"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "SIGN IN"}
              </button>
              <Link to="/" className="text-xs text-ink/45 hover:text-brand transition-colors mt-1">
                Guest access
              </Link>
            </div>

            {/* Mobile Submit Button (Floating Circular Button as in Image 2) */}
            <div className="md:hidden flex items-center justify-between mt-8 pt-2">
              <Link to="/" className="text-xs text-ink/50 hover:text-brand font-medium">
                Guest access
              </Link>
              <button
                type="submit"
                disabled={loading}
                aria-label="Sign in"
                className="w-16 h-16 rounded-full bg-gradient-to-tr from-[#F4600F] to-[#FFA733] text-white flex items-center justify-center shadow-[0_10px_25px_rgba(244,96,15,0.45)] hover:brightness-110 active:scale-90 transition-all disabled:opacity-60 cursor-pointer"
              >
                {loading ? (
                  <Loader2 className="w-6 h-6 animate-spin" strokeWidth={2.5} />
                ) : (
                  <ArrowRight className="w-6 h-6" strokeWidth={2.5} />
                )}
              </button>
            </div>
          </form>

          {/* Mobile Bottom Switch */}
          <div className="md:hidden mt-10 text-center text-xs text-ink/60">
            Don&apos;t have an account?{" "}
            <Link to="/register" className="text-brand font-semibold hover:underline">
              Sign Up
            </Link>
          </div>
        </div>

        {/* ----- RIGHT / OVERLAY PANE (Desktop Only - Image 1) ----- */}
        <div
          className="hidden md:flex flex-1 bg-gradient-to-br from-[#FFA733] via-[#FA7B17] to-[#F4600F] text-white flex-col items-center justify-center p-10 text-center relative overflow-hidden"
          style={{
            borderTopLeftRadius: "120px",
            borderBottomLeftRadius: "120px",
          }}
        >
          {/* Ambient Glows */}
          <div className="pointer-events-none absolute -top-12 -right-12 w-48 h-48 bg-white/20 rounded-full blur-2xl" />
          <div className="pointer-events-none absolute -bottom-12 -left-12 w-48 h-48 bg-black/10 rounded-full blur-2xl" />

          <div className="relative z-10 max-w-xs flex flex-col items-center gap-3">
            <h2 className="text-3xl font-extrabold font-display text-white">Hello, User!</h2>
            <p className="text-sm text-white/90 leading-relaxed font-light mt-1">
              Register with your personal details to use all of site features
            </p>
            <Link
              to="/register"
              className="mt-6 border-2 border-white hover:bg-white hover:text-[#F4600F] text-white font-bold uppercase tracking-wider text-xs rounded-full py-3 px-10 transition-all active:scale-95 shadow-sm inline-block"
            >
              SIGN UP
            </Link>
          </div>
        </div>
      </div>

      {/* Footer copyright */}
      <div className="text-center text-xs text-ink/35 py-3 hidden md:block">
        Peerly &copy; {new Date().getFullYear()} &bull; Video &amp; Chat
      </div>
    </div>
  );
}
