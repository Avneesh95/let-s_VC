import { useState } from "react";
import { Navigate, Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

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
      // Surface the real reason instead of a generic message — a 404 here
      // usually means the backend hasn't been redeployed with this route yet.
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
    <div className="min-h-dvh bg-gray-100 flex items-center justify-center p-4">
      <div className="w-full max-w-sm flex flex-col gap-6">
        <div className="bg-brand text-white rounded-2xl p-6 shadow-lg flex flex-col gap-3">
          <h1 className="text-xl font-bold">🎥 Join a Video Room</h1>
          <p className="text-sm text-white/80">No account needed — enter your name and a room code.</p>
          <form onSubmit={handleJoin} className="flex flex-col gap-2">
            <input
              type="text"
              placeholder="Your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={30}
              className="rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-white"
            />
            <input
              type="text"
              placeholder="Room code"
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value)}
              maxLength={6}
              className="rounded-lg px-3 py-2 text-sm text-gray-900 uppercase focus:outline-none focus:ring-2 focus:ring-white"
            />
            {error && <p className="text-xs bg-red-600/60 rounded px-2 py-1.5">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="bg-white text-brand font-semibold rounded-lg py-2 mt-1 disabled:opacity-60"
            >
              {loading ? "Joining…" : "Join Room"}
            </button>
          </form>
        </div>

        <div className="flex items-center gap-3 text-gray-400 text-xs">
          <div className="flex-1 h-px bg-gray-300" />
          OR
          <div className="flex-1 h-px bg-gray-300" />
        </div>

        <div className="bg-white rounded-2xl p-6 shadow flex flex-col gap-3 text-center">
          <p className="text-sm text-gray-600">Have an account? Chat and call friends directly.</p>
          <div className="flex gap-2">
            <Link
              to="/login"
              className="flex-1 border border-gray-300 rounded-lg py-2 text-sm font-medium hover:bg-gray-50"
            >
              Log in
            </Link>
            <Link
              to="/register"
              className="flex-1 border border-gray-300 rounded-lg py-2 text-sm font-medium hover:bg-gray-50"
            >
              Register
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
