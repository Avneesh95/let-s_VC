import { useState } from "react";
import { Navigate, Link, useNavigate } from "react-router-dom";
import { Video, ArrowRight, Loader2 } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import ThemeToggle from "../components/ThemeToggle";
import Logo from "../components/Logo";
import Footer from "../components/Footer";

export default function Home() {
  const { user, guestLogin } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // A real logged-in account goes straight to the full chat app —
  // this landing page is only for guests and signed-out visitors.
  if (user && !user.isGuest) return <Navigate to="/chat" />;

  const handleJoin = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Enter your name first");
      return;
    }
    if (!roomCode.trim()) {
      setError("Enter a room code");
      return;
    }
    setError("");
    setLoading(true);
    try {
      await guestLogin(name.trim());
      navigate(`/room/${roomCode.trim().toUpperCase()}`);
    } catch (err) {
      console.error("Guest join failed:", err.response?.status, err.response?.data || err.message);
      setError(
        err.response?.status === 404
          ? "Server error: guest login endpoint not found (backend may need redeploying)"
          : err.response?.data?.message || "Something went wrong — try again"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-dvh bg-paper flex items-center justify-center p-4 overflow-hidden">
      <div className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 w-[36rem] h-[36rem] rounded-full bg-brand/10 blur-3xl animate-float-slow" />
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <div className="relative w-full max-w-sm flex flex-col gap-6">
        <div className="text-center">
          <Logo size="lg" className="justify-center" />
        </div>

        <div className="relative bg-brand-gradient text-white rounded-2xl p-6 shadow-premium-lg flex flex-col gap-3 overflow-hidden">
          <span className="absolute top-0 left-6 right-6 h-px rule-gold" />
          <div className="flex items-center gap-2.5">
            <span className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center ring-1 ring-white/15">
              <Video className="w-4.5 h-4.5" strokeWidth={1.75} />
            </span>
            <h1 className="font-display text-xl font-semibold">Join a video room</h1>
          </div>
          <p className="text-sm text-white/60">
            No account needed — enter your name and a room code.
          </p>
          <form onSubmit={handleJoin} className="flex flex-col gap-2 mt-1">
            <input
              type="text"
              placeholder="Your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={30}
              className="rounded-xl px-3 py-2.75 text-sm text-ink bg-white/95 focus:outline-none focus:ring-2 focus:ring-gold/60 transition-shadow"
            />
            <input
              type="text"
              placeholder="Room code"
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value)}
              maxLength={6}
              className="rounded-xl px-3 py-2.75 text-sm text-ink bg-white/95 uppercase tracking-widest font-display focus:outline-none focus:ring-2 focus:ring-gold/60 transition-shadow"
            />
            {error && (
              <p className="text-xs bg-danger/70 rounded-lg px-2.5 py-1.5">{error}</p>
            )}
            <button
              type="submit"
              disabled={loading}
              className="bg-gold-gradient hover:brightness-110 transition-all text-callbg font-semibold rounded-xl py-2.75 mt-1 disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" strokeWidth={2} /> : <ArrowRight className="w-4 h-4" strokeWidth={2} />}
              {loading ? "Joining…" : "Join room"}
            </button>
          </form>
        </div>

        <div className="flex items-center gap-3 text-ink/30 text-xs tracking-wide">
          <div className="flex-1 h-px bg-ink/10" />
          OR
          <div className="flex-1 h-px bg-ink/10" />
        </div>

        <div className="bg-surface rounded-2xl p-6 shadow-premium border border-line/10 flex flex-col gap-3 text-center">
          <p className="text-sm text-ink/60">Have an account? Chat and call friends directly.</p>
          <div className="flex gap-2">
            <Link
              to="/login"
              className="flex-1 border border-line/15 rounded-xl py-2.25 text-sm font-medium hover:bg-paper hover:border-brand/30 transition-colors"
            >
              Log in
            </Link>
            <Link
              to="/register"
              className="flex-1 border border-line/15 rounded-xl py-2.25 text-sm font-medium hover:bg-paper hover:border-brand/30 transition-colors"
            >
              Register
            </Link>
          </div>
        </div>
        <Footer />
      </div>
    </div>
  );
}
