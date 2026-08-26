import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { User, Mail, ArrowRight, Loader2 } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import PasswordInput from "../components/PasswordInput";
import ThemeToggle from "../components/ThemeToggle";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function Register() {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;

    const cleanUsername = username.trim();
    const cleanEmail = email.trim().toLowerCase();

    const nextErrors = {};
    if (cleanUsername.length < 2) nextErrors.username = "Username must be at least 2 characters";
    if (!EMAIL_RE.test(cleanEmail)) nextErrors.email = "Enter a valid email address";
    if (password.length < 6) nextErrors.password = "Password must be at least 6 characters";
    else if (confirmPassword !== password) nextErrors.confirmPassword = "Passwords don't match";
    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setError("");
    setLoading(true);
    try {
      await register(cleanUsername, cleanEmail, password);
      navigate("/chat");
    } catch (err) {
      setError(err.response?.data?.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  const clearFieldError = (field) => {
    if (fieldErrors[field]) setFieldErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  return (
    <div className="min-h-dvh bg-[#eef2f6] dark:bg-[#0c0f14] flex flex-col justify-between md:justify-center items-center p-0 md:p-6 transition-colors duration-200 relative overflow-x-hidden">
      {/* Top right theme toggle */}
      <div className="absolute top-4 right-4 z-30">
        <ThemeToggle />
      </div>

      {/* ===================== MOBILE HEADER (Visible on mobile only) ===================== */}
      <div className="md:hidden w-full relative">
        <div
          className="w-full h-36 bg-gradient-to-r from-[#FFA733] via-[#FA7B17] to-[#F4600F] relative flex items-start justify-between px-6 pt-5"
          style={{
            borderBottomLeftRadius: "60px",
            borderBottomRightRadius: "90px",
          }}
        >
          <div className="absolute -top-10 -left-10 w-32 h-32 bg-white/20 rounded-full blur-2xl pointer-events-none" />
          <Link to="/" className="text-white/90 text-sm font-semibold tracking-wide">
            Peerly
          </Link>
          <Link
            to="/login"
            className="text-white font-semibold text-sm hover:underline tracking-wide bg-white/15 px-3.5 py-1 rounded-full backdrop-blur-sm"
          >
            Sign In
          </Link>
        </div>
      </div>

      {/* ===================== MAIN CARD (Desktop 2-Panel + Mobile Form) ===================== */}
      <div className="w-full max-w-4xl bg-surface md:rounded-[2.25rem] md:shadow-[0_20px_60px_rgba(0,0,0,0.1)] border-0 md:border md:border-line/10 overflow-hidden flex-1 md:flex-none flex flex-col md:flex-row-reverse min-h-0 md:min-h-[580px] z-10">
        {/* ----- FORM PANE ----- */}
        <div className="flex-1 flex flex-col justify-center px-6 sm:px-10 md:px-12 py-8 md:py-10">
          {/* Mobile Heading */}
          <div className="md:hidden mb-6">
            <h1 className="text-3xl font-bold text-ink font-display tracking-tight">Sign Up</h1>
            <p className="text-sm text-ink/50 mt-1">Create an account to continue</p>
          </div>

          {/* Desktop Heading */}
          <div className="hidden md:block text-center mb-5">
            <h1 className="text-3xl font-extrabold text-ink font-display">Create Account</h1>
            {/* Social Login Buttons */}
            <div className="flex justify-center gap-3 my-3">
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
            <p className="text-xs text-ink/45">or use your email for registration</p>
          </div>

          {error && (
            <div className="mb-4 text-danger text-xs sm:text-sm bg-danger/10 border border-danger/20 rounded-2xl px-4 py-2.5 text-center font-medium">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-3.5">
            {/* Username Field */}
            <div className="w-full">
              <div className="relative flex items-center">
                <span className="absolute left-4 text-ink/40 pointer-events-none flex items-center justify-center">
                  <User className="w-4 h-4" strokeWidth={2} />
                </span>
                <input
                  type="text"
                  placeholder="Username"
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value);
                    clearFieldError("username");
                  }}
                  required
                  autoFocus
                  autoComplete="username"
                  maxLength={30}
                  aria-invalid={!!fieldErrors.username}
                  className={`w-full bg-[#f3f4f6] dark:bg-paper rounded-full pl-11 pr-4 py-3 text-base sm:text-sm text-ink placeholder:text-ink/35 focus:outline-none focus:ring-2 transition-all shadow-sm border border-line/5 ${
                    fieldErrors.username
                      ? "ring-2 ring-danger/50 focus:ring-danger"
                      : "focus:ring-brand/40 focus:bg-surface"
                  }`}
                />
              </div>
              {fieldErrors.username && <p className="text-danger text-xs mt-1 ml-4">{fieldErrors.username}</p>}
            </div>

            {/* Email Field */}
            <div className="w-full">
              <div className="relative flex items-center">
                <span className="absolute left-4 text-ink/40 pointer-events-none flex items-center justify-center">
                  <Mail className="w-4 h-4" strokeWidth={2} />
                </span>
                <input
                  type="email"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    clearFieldError("email");
                  }}
                  required
                  autoComplete="email"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck="false"
                  aria-invalid={!!fieldErrors.email}
                  className={`w-full bg-[#f3f4f6] dark:bg-paper rounded-full pl-11 pr-4 py-3 text-base sm:text-sm text-ink placeholder:text-ink/35 focus:outline-none focus:ring-2 transition-all shadow-sm border border-line/5 ${
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
                clearFieldError("password");
                clearFieldError("confirmPassword");
              }}
              placeholder="Password"
              autoComplete="new-password"
              minLength={6}
              error={fieldErrors.password}
              leftIcon={true}
              inputClassName={`w-full bg-[#f3f4f6] dark:bg-paper rounded-full pl-11 pr-11 py-3 text-base sm:text-sm text-ink placeholder:text-ink/35 focus:outline-none focus:ring-2 transition-all shadow-sm border border-line/5 ${
                fieldErrors.password
                  ? "ring-2 ring-danger/50 focus:ring-danger"
                  : "focus:ring-brand/40 focus:bg-surface"
              }`}
            />

            {/* Confirm Password Field */}
            <PasswordInput
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value);
                clearFieldError("confirmPassword");
              }}
              placeholder="Confirm Password"
              autoComplete="new-password"
              error={fieldErrors.confirmPassword}
              leftIcon={true}
              inputClassName={`w-full bg-[#f3f4f6] dark:bg-paper rounded-full pl-11 pr-11 py-3 text-base sm:text-sm text-ink placeholder:text-ink/35 focus:outline-none focus:ring-2 transition-all shadow-sm border border-line/5 ${
                fieldErrors.confirmPassword
                  ? "ring-2 ring-danger/50 focus:ring-danger"
                  : "focus:ring-brand/40 focus:bg-surface"
              }`}
            />

            {/* Desktop Submit Button */}
            <div className="hidden md:flex flex-col items-center gap-2.5 mt-3">
              <button
                type="submit"
                disabled={loading}
                className="bg-[#E53935] hover:bg-[#D32F2F] hover:shadow-lg disabled:opacity-60 text-white font-bold uppercase tracking-wider text-xs rounded-full py-3.5 px-12 transition-all active:scale-95 shadow-md flex items-center justify-center gap-2 cursor-pointer"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "SIGN UP"}
              </button>
              <Link to="/" className="text-xs text-ink/45 hover:text-brand transition-colors">
                Guest access
              </Link>
            </div>

            {/* Mobile Submit Button (Floating Circular Button) */}
            <div className="md:hidden flex items-center justify-between mt-6 pt-1">
              <Link to="/" className="text-xs text-ink/50 hover:text-brand font-medium">
                Guest access
              </Link>
              <button
                type="submit"
                disabled={loading}
                aria-label="Create account"
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
          <div className="md:hidden mt-8 text-center text-xs text-ink/60">
            Already have an account?{" "}
            <Link to="/login" className="text-brand font-semibold hover:underline">
              Sign In
            </Link>
          </div>
        </div>

        {/* ----- LEFT / OVERLAY PANE (Desktop Only - Mirrored Curved Panel) ----- */}
        <div
          className="hidden md:flex flex-1 bg-gradient-to-br from-[#FFA733] via-[#FA7B17] to-[#F4600F] text-white flex-col items-center justify-center p-10 text-center relative overflow-hidden"
          style={{
            borderTopRightRadius: "120px",
            borderBottomRightRadius: "120px",
          }}
        >
          <div className="pointer-events-none absolute -top-12 -left-12 w-48 h-48 bg-white/20 rounded-full blur-2xl" />
          <div className="pointer-events-none absolute -bottom-12 -right-12 w-48 h-48 bg-black/10 rounded-full blur-2xl" />

          <div className="relative z-10 max-w-xs flex flex-col items-center gap-3">
            <h2 className="text-3xl font-extrabold font-display text-white">Welcome Back!</h2>
            <p className="text-sm text-white/90 leading-relaxed font-light mt-1">
              To keep connected with friends please sign in with your personal info
            </p>
            <Link
              to="/login"
              className="mt-6 border-2 border-white hover:bg-white hover:text-[#F4600F] text-white font-bold uppercase tracking-wider text-xs rounded-full py-3 px-10 transition-all active:scale-95 shadow-sm inline-block"
            >
              SIGN IN
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
