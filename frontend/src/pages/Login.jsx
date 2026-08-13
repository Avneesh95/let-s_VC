import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import ThemeToggle from "../components/ThemeToggle";
import Logo from "../components/Logo";
import Footer from "../components/Footer";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return; // guards against a double-submit from a fast double-click
    setError("");
    setLoading(true);
    try {
      await login(email, password);
      navigate("/chat");
    } catch (err) {
      setError(err.response?.data?.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative h-dvh flex items-center justify-center bg-paper px-4 overflow-hidden">
      {/* Soft brand-tinted glow — subtle, not a full gradient background */}
      <div className="pointer-events-none absolute -top-32 left-1/2 -translate-x-1/2 w-[32rem] h-[32rem] rounded-full bg-brand/10 blur-3xl" />
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-sm flex flex-col gap-6">
        <div className="text-center">
          <Logo size="lg" className="justify-center" />
        </div>
        <form
          onSubmit={handleSubmit}
          className="relative bg-surface p-8 rounded-2xl shadow-sm border border-line/10 flex flex-col gap-3"
        >
          <h1 className="font-display text-xl font-semibold text-ink mb-1">Welcome back</h1>
          {error && <p className="text-danger text-sm">{error}</p>}
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="border border-line/15 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand transition-shadow"
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="border border-line/15 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand transition-shadow"
          />
          <button
            type="submit"
            disabled={loading}
            className="bg-brand hover:bg-brand-dark disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold rounded-lg py-2.5 mt-1 transition-colors flex items-center justify-center gap-2"
          >
            {loading && (
              <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
              </svg>
            )}
            {loading ? "Logging in…" : "Log in"}
          </button>
          <p className="text-sm text-center text-ink/50">
            No account?{" "}
            <Link to="/register" className="text-brand hover:underline font-medium">
              Register
            </Link>
          </p>
        </form>
        <p className="text-center text-xs text-ink/40">
          Just here for a video call?{" "}
          <Link to="/" className="text-brand hover:underline">
            Join a room instead
          </Link>
        </p>
        <Footer showCopyright />
      </div>
    </div>
  );
}
