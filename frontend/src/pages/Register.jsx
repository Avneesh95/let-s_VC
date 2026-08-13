import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { User, Mail, Lock, ArrowRight, Loader2 } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import ThemeToggle from "../components/ThemeToggle";
import Logo from "../components/Logo";
import Footer from "../components/Footer";

export default function Register() {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;
    setError("");
    setLoading(true);
    try {
      await register(username, email, password);
      navigate("/chat");
    } catch (err) {
      setError(err.response?.data?.message || "Registration failed");
    } finally {
      setLoading(false);
    }
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
          className="relative bg-surface p-8 pt-7 rounded-2xl shadow-premium border border-line/10 flex flex-col gap-3.5 overflow-hidden"
        >
          <span className="absolute top-0 left-6 right-6 h-px rule-gold" />
          <div className="mb-1.5">
            <h1 className="font-serif text-[1.7rem] leading-tight font-medium text-ink">Create your account</h1>
            <p className="text-sm text-ink/45 mt-1">A few details and you're in.</p>
          </div>
          {error && (
            <p className="text-danger text-sm bg-danger/10 border border-danger/20 rounded-lg px-3 py-2">{error}</p>
          )}

          <label className="relative flex items-center">
            <User className="absolute left-3.5 w-4 h-4 text-ink/30" strokeWidth={1.75} />
            <input
              type="text"
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              className="w-full border border-line/15 bg-paper/40 rounded-xl pl-10 pr-3 py-2.75 text-sm focus:outline-none focus:ring-2 focus:ring-brand/35 focus:border-brand transition-shadow"
            />
          </label>
          <label className="relative flex items-center">
            <Mail className="absolute left-3.5 w-4 h-4 text-ink/30" strokeWidth={1.75} />
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full border border-line/15 bg-paper/40 rounded-xl pl-10 pr-3 py-2.75 text-sm focus:outline-none focus:ring-2 focus:ring-brand/35 focus:border-brand transition-shadow"
            />
          </label>
          <label className="relative flex items-center">
            <Lock className="absolute left-3.5 w-4 h-4 text-ink/30" strokeWidth={1.75} />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full border border-line/15 bg-paper/40 rounded-xl pl-10 pr-3 py-2.75 text-sm focus:outline-none focus:ring-2 focus:ring-brand/35 focus:border-brand transition-shadow"
            />
          </label>

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
          <p className="text-sm text-center text-ink/50">
            Already have an account?{" "}
            <Link to="/login" className="text-brand dark:text-brand-light hover:underline font-medium">
              Log in
            </Link>
          </p>
        </form>
        <p className="text-center text-xs text-ink/40">
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
