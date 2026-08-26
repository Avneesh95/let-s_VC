import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, Loader2 } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import PasswordInput from "../components/PasswordInput";
import ThemeToggle from "../components/ThemeToggle";
import Footer from "../components/Footer";
import AuthHero, { HeroMark } from "../components/AuthHero";

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

    // Client-side validation ahead of the request — same rules the backend
    // enforces, so a bad value gets caught (and pointed at the specific
    // field) immediately instead of round-tripping to the server first.
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

  const inputClass = (field) =>
    `w-full bg-paper rounded-xl px-4 py-3 text-base sm:text-sm text-ink placeholder:text-ink/35 focus:outline-none focus:ring-2 transition-shadow ${
      fieldErrors[field] ? "ring-2 ring-danger/50 focus:ring-danger" : "ring-1 ring-line/10 focus:ring-brand/50"
    }`;

  return (
    <div className="relative min-h-dvh lg:h-dvh bg-brand overflow-hidden">
      <div className="hidden lg:block pointer-events-none absolute inset-0 bg-grain opacity-[0.05] mix-blend-overlay" />
      <div className="hidden lg:block pointer-events-none absolute bottom-[-14rem] right-[-10rem] w-[30rem] h-[30rem] rounded-full bg-white/10 blur-3xl" />

      <AuthHero
        eyebrow="Video & chat, together"
        title="Join the conversation."
        tagline="Create an account to start chatting and calling with friends in real time."
      />

      {/* ---- Form side ---- */}
      <div className="relative min-h-dvh lg:h-dvh flex items-center justify-center px-4 py-10 lg:pl-[46%] xl:pl-[43%] lg:pr-12 xl:pr-20">
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
                New here
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
                  className={inputClass("username")}
                />
                {fieldErrors.username && <p className="text-danger text-xs mt-1 ml-1">{fieldErrors.username}</p>}
              </div>

              <div>
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
                  // Compared exactly against what's typed at login — a
                  // mobile keyboard capitalizing/correcting it here is how
                  // an account becomes impossible to log back into.
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck="false"
                  aria-invalid={!!fieldErrors.email}
                  className={inputClass("email")}
                />
                {fieldErrors.email && <p className="text-danger text-xs mt-1 ml-1">{fieldErrors.email}</p>}
              </div>

              <PasswordInput
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  clearFieldError("password");
                  // A confirm-password error is about the *pair* — once the
                  // first field changes, that comparison needs redoing, so
                  // don't leave a stale mismatch warning under the second field.
                  clearFieldError("confirmPassword");
                }}
                placeholder="Password"
                autoComplete="new-password"
                minLength={6}
                error={fieldErrors.password}
              />

              <PasswordInput
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  clearFieldError("confirmPassword");
                }}
                placeholder="Confirm password"
                autoComplete="new-password"
                error={fieldErrors.confirmPassword}
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
                {loading ? "Creating account…" : "Sign up"}
              </button>
            </div>
          </form>

          <p className="text-sm text-center text-white/85">
            Already have an account?{" "}
            <Link to="/login" className="text-white font-semibold hover:underline">
              Log in
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
