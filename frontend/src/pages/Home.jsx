import { useState } from "react";
import { Navigate, Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import ThemeToggle from "../components/ThemeToggle";

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
    <div className="relative min-h-dvh bg-paper flex items-center justify-center p-4">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-sm flex flex-col gap-6">
        <div className="text-center">
          <span className="font-display font-semibold text-2xl text-ink tracking-tight">
            chat<span className="text-brand">/</span>app
          </span>
        </div>

        <div className="bg-ink text-white rounded-2xl p-6 shadow-lg shadow-ink/10 flex flex-col gap-3">
          <h1 className="font-display text-xl font-semibold">Join a video room</h1>
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
              className="rounded-lg px-3 py-2.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand-light"
            />
            <input
              type="text"
              placeholder="Room code"
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value)}
              maxLength={6}
              className="rounded-lg px-3 py-2.5 text-sm text-ink uppercase tracking-widest font-display focus:outline-none focus:ring-2 focus:ring-brand-light"
            />
            {error && <p className="text-xs bg-danger/60 rounded px-2 py-1.5">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="bg-brand hover:bg-brand-dark transition-colors text-white font-semibold rounded-lg py-2.5 mt-1 disabled:opacity-60"
            >
              {loading ? "Joining…" : "Join Room"}
            </button>
          </form>
        </div>

        <div className="flex items-center gap-3 text-ink/30 text-xs">
          <div className="flex-1 h-px bg-ink/10" />
          OR
          <div className="flex-1 h-px bg-ink/10" />
        </div>

        <div className="bg-surface rounded-2xl p-6 shadow-sm border border-line/10 flex flex-col gap-3 text-center">
          <p className="text-sm text-ink/60">Have an account? Chat and call friends directly.</p>
          <div className="flex gap-2">
            <Link
              to="/login"
              className="flex-1 border border-line/15 rounded-lg py-2 text-sm font-medium hover:bg-paper transition-colors"
            >
              Log in
            </Link>
            <Link
              to="/register"
              className="flex-1 border border-line/15 rounded-lg py-2 text-sm font-medium hover:bg-paper transition-colors"
            >
              Register
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
