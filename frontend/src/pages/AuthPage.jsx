import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, Loader2, Mail, User } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import PasswordInput from "../components/PasswordInput";
import ThemeToggle from "../components/ThemeToggle";
import { getPasswordStrength, validateLoginForm, validateSignupForm } from "../utils/authValidation";

const initialForm = { username: "", email: "", password: "", confirmPassword: "" };

export default function AuthPage({ initialMode = "login" }) {
  const navigate = useNavigate();
  const { login, register } = useAuth();
  const [mode, setMode] = useState(initialMode);
  const [form, setForm] = useState(initialForm);
  const [errors, setErrors] = useState({});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setMode(initialMode);
    setForm(initialForm);
    setErrors({});
    setError("");
  }, [initialMode]);

  const setField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
    if (field === "password") {
      setErrors((current) => ({ ...current, confirmPassword: undefined }));
    }
  };

  const switchMode = (nextMode) => {
    setMode(nextMode);
    setForm(initialForm);
    setErrors({});
    setError("");
    navigate(nextMode === "login" ? "/login" : "/register", { replace: true });
  };

  const strength = mode === "register" ? getPasswordStrength(form.password) : null;

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (loading) return;

    const validation =
      mode === "login"
        ? validateLoginForm({ email: form.email, password: form.password })
        : validateSignupForm({
            username: form.username,
            email: form.email,
            password: form.password,
            confirmPassword: form.confirmPassword,
          });

    setErrors(validation);
    if (Object.keys(validation).length > 0) return;

    setError("");
    setLoading(true);

    try {
      if (mode === "login") {
        await login(form.email.trim().toLowerCase(), form.password);
      } else {
        await register(form.username.trim(), form.email.trim().toLowerCase(), form.password);
      }
      navigate("/chat");
    } catch (err) {
      setError(err.response?.data?.message || "Authentication failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-dvh bg-[#eef2f6] dark:bg-[#0c0f14] flex items-center justify-center p-4 sm:p-6 transition-colors duration-200">
      <div className="absolute top-4 right-4 z-30">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-5xl overflow-hidden rounded-[28px] border border-line/10 bg-surface shadow-[0_20px_60px_rgba(15,23,42,0.12)]">
        <div className="grid md:grid-cols-[1.1fr_1.2fr]">
          <aside className="hidden md:flex flex-col justify-between bg-gradient-to-br from-[#ffa94d] via-[#fa7b17] to-[#f4600f] p-8 text-white">
            <div>
              <Link to="/" className="inline-flex items-center text-lg font-semibold tracking-[0.2em] uppercase">
                Peerly
              </Link>
              <div className="mt-10 space-y-5">
                <p className="text-sm uppercase tracking-[0.3em] text-white/70">Meet faster</p>
                <h1 className="text-4xl font-bold leading-tight">Private calls. Safe chats. One place to connect.</h1>
              </div>
            </div>

            <div className="rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur-sm">
              <p className="text-sm font-medium text-white/80">Trusted by teams and friends who want simple, secure communication.</p>
            </div>
          </aside>

          <section className="p-5 sm:p-8 lg:p-10">
            <div className="mb-6 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ink/45">Welcome</p>
                <h2 className="text-2xl font-bold text-ink">{mode === "login" ? "Log in" : "Create account"}</h2>
              </div>
              <Link to="/" className="text-sm font-medium text-ink/60 hover:text-brand">Guest access</Link>
            </div>

            <div className="mb-6 inline-flex w-full rounded-full bg-muted p-1">
              {[
                { key: "login", label: "Login" },
                { key: "register", label: "Sign Up" },
              ].map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => switchMode(key)}
                  className={`flex-1 rounded-full px-4 py-2.5 text-sm font-semibold transition-colors ${
                    mode === key ? "bg-white text-ink shadow-sm" : "text-ink/60 hover:text-ink"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {error && (
              <div className="mb-4 rounded-2xl border border-danger/20 bg-danger/10 px-4 py-3 text-sm text-danger">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} noValidate className="space-y-4">
              {mode === "register" && (
                <div>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink/40">
                      <User className="h-4 w-4" strokeWidth={2} />
                    </span>
                    <input
                      type="text"
                      value={form.username}
                      onChange={(event) => setField("username", event.target.value)}
                      placeholder="Username"
                      autoComplete="username"
                      className={`w-full rounded-full border bg-paper py-3 pl-11 pr-4 text-sm text-ink placeholder:text-ink/35 focus:outline-none focus:ring-2 ${
                        errors.username ? "border-danger/40 ring-danger/40" : "border-line/10 focus:ring-brand/40"
                      }`}
                    />
                  </div>
                  {errors.username && <p className="mt-1 text-xs text-danger">{errors.username}</p>}
                </div>
              )}

              <div>
                <div className="relative">
                  <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink/40">
                    <Mail className="h-4 w-4" strokeWidth={2} />
                  </span>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(event) => setField("email", event.target.value)}
                    placeholder="Email"
                    autoComplete={mode === "login" ? "email" : "new-email"}
                    autoCapitalize="none"
                    spellCheck="false"
                    className={`w-full rounded-full border bg-paper py-3 pl-11 pr-4 text-sm text-ink placeholder:text-ink/35 focus:outline-none focus:ring-2 ${
                      errors.email ? "border-danger/40 ring-danger/40" : "border-line/10 focus:ring-brand/40"
                    }`}
                  />
                </div>
                {errors.email && <p className="mt-1 text-xs text-danger">{errors.email}</p>}
              </div>

              <PasswordInput
                value={form.password}
                onChange={(event) => setField("password", event.target.value)}
                placeholder="Password"
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                error={errors.password}
                leftIcon
                inputClassName={`w-full rounded-full border bg-paper py-3 pl-11 pr-11 text-sm text-ink placeholder:text-ink/35 focus:outline-none focus:ring-2 ${
                  errors.password ? "border-danger/40 ring-danger/40" : "border-line/10 focus:ring-brand/40"
                }`}
              />

              {mode === "register" && (
                <>
                  <PasswordInput
                    value={form.confirmPassword}
                    onChange={(event) => setField("confirmPassword", event.target.value)}
                    placeholder="Confirm password"
                    autoComplete="new-password"
                    error={errors.confirmPassword}
                    leftIcon
                    inputClassName={`w-full rounded-full border bg-paper py-3 pl-11 pr-11 text-sm text-ink placeholder:text-ink/35 focus:outline-none focus:ring-2 ${
                      errors.confirmPassword ? "border-danger/40 ring-danger/40" : "border-line/10 focus:ring-brand/40"
                    }`}
                  />

                  {form.password && (
                    <div className="rounded-2xl border border-line/10 bg-muted p-3">
                      <div className="flex items-center justify-between text-xs text-ink/60">
                        <span>Password strength</span>
                        <span className={`font-semibold ${
                          strength?.tone === "danger" ? "text-danger" : strength?.tone === "warning" ? "text-warning" : "text-success"
                        }`}>
                          {strength.label}
                        </span>
                      </div>
                      <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-line/10">
                        <div
                          className={`h-full rounded-full ${
                            strength?.tone === "danger"
                              ? "bg-danger"
                              : strength?.tone === "warning"
                                ? "bg-warning"
                                : "bg-success"
                          }`}
                          style={{ width: `${Math.min((strength.score / 4) * 100, 100)}%` }}
                        />
                      </div>
                    </div>
                  )}
                </>
              )}

              <button
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-full bg-brand-gradient px-5 py-3 font-semibold uppercase tracking-[0.16em] text-white shadow-neon-brand transition-opacity hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>{mode === "login" ? "Logging in" : "Creating account"}</span>
                  </>
                ) : (
                  <>
                    <span>{mode === "login" ? "Log in" : "Sign up"}</span>
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </form>

            <p className="mt-6 text-center text-sm text-ink/60">
              {mode === "login" ? "Need an account?" : "Already have an account?"}{" "}
              <button
                type="button"
                onClick={() => switchMode(mode === "login" ? "register" : "login")}
                className="font-semibold text-brand underline-offset-4 hover:underline"
              >
                {mode === "login" ? "Create one" : "Log in"}
              </button>
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
