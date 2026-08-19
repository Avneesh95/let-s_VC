import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { User, Mail, ArrowRight, Loader2 } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import PasswordInput from "../components/PasswordInput";
import ThemeToggle from "../components/ThemeToggle";
import Logo from "../components/Logo";
import Footer from "../components/Footer";

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
    // The password confirmation check in particular didn't exist at all
    // before: a typo in the password field was previously only discovered
    // the next time the person tried to log in with what they *meant* to type.
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
    <div className="relative h-dvh flex items-center justify-center bg-paper px-4 overflow-hidden">
      <div className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 w-[36rem] h-[36rem] rounded-full bg-brand/10 blur-3xl animate-float-slow" />
      <div className="pointer-events-none absolute bottom-[-12rem] left-[-8rem] w-[26rem] h-[26rem] rounded-full bg-gold/10 blur-3xl" />
      <div className="pointer-events-none absolute inset-0 bg-grain opacity-[0.025] mix-blend-overlay" />

      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <div className="relative w-full max-w-sm flex flex-col gap-6">
        <div className="text-center">
          <Logo size="lg" className="justify-center" />
        </div>
        <form
          onSubmit={handleSubmit}
          noValidate
          className="relative bg-surface p-8 pt-7 rounded-2xl shadow-premium border border-line/10 flex flex-col gap-3.5 overflow-hidden"
        >
          <span className="absolute top-0 left-6 right-6 h-px rule-gold" />
          <div className="mb-1.5">
            <h1 className="font-serif text-[1.7rem] leading-tight font-medium text-ink">Create your account</h1>
            <p className="text-sm text-ink/60 mt-1">A few details and you're in.</p>
          </div>
          {error && (
            <p className="text-danger text-sm bg-danger/10 border border-danger/20 rounded-lg px-3 py-2">{error}</p>
          )}

          <div>
            <label className="relative flex items-center">
              <User className="absolute left-3.5 w-4 h-4 text-ink/30 pointer-events-none" strokeWidth={1.75} />
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
                className={`w-full border bg-paper/40 rounded-xl pl-10 pr-3 py-2.75 text-base sm:text-sm focus:outline-none focus:ring-2 transition-shadow ${
                  fieldErrors.username
                    ? "border-danger/50 focus:ring-danger/30 focus:border-danger"
                    : "border-line/15 focus:ring-brand/35 focus:border-brand"
                }`}
              />
            </label>
            {fieldErrors.username && <p className="text-danger text-xs mt-1 ml-1">{fieldErrors.username}</p>}
          </div>

          <div>
            <label className="relative flex items-center">
              <Mail className="absolute left-3.5 w-4 h-4 text-ink/30 pointer-events-none" strokeWidth={1.75} />
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
            className="group bg-brand-gradient hover:brightness-110 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold rounded-xl py-2.75 mt-1.5 transition-all flex items-center justify-center gap-2 shadow-neon-brand"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" strokeWidth={2} />
            ) : (
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" strokeWidth={2} />
            )}
            {loading ? "Creating account…" : "Sign up"}
          </button>
          <p className="text-sm text-center text-ink/60">
            Already have an account?{" "}
            <Link to="/login" className="text-brand dark:text-brand-light hover:underline font-medium">
              Log in
            </Link>
          </p>
        </form>
        <p className="text-center text-xs text-ink/60">
          Just here for a video call?{" "}
          <Link to="/" className="text-brand dark:text-brand-light hover:underline">
            Join a room instead
          </Link>
        </p>
        <Footer showCopyright />
      </div>
    </div>
  );
}
