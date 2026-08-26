import { useState } from "react";
import { Navigate, Link, useNavigate } from "react-router-dom";
import { Video, ArrowRight, Loader2, Sparkles, MessageCircle, ShieldCheck, Users, RefreshCw, User, Lock } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import ThemeToggle from "../components/ThemeToggle";
import Logo from "../components/Logo";
import Footer from "../components/Footer";
import generateRoomCode from "../utils/generateRoomCode";

export default function Home() {
  const { user, guestLogin } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // A real logged-in account goes straight to the full chat app
  if (user && !user.isGuest) return <Navigate to="/chat" />;

  const handleJoin = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Please enter your name");
      return;
    }
    if (!roomCode.trim()) {
      setError("Please enter a room code");
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
          ? "Server error: guest login endpoint not found"
          : err.response?.data?.message || "Something went wrong — please try again"
      );
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateCode = () => {
    const newCode = generateRoomCode();
    setRoomCode(newCode);
  };

  return (
    <div className="relative min-h-dvh bg-[#08090C] text-white flex flex-col justify-between selection:bg-brand selection:text-white overflow-x-hidden font-sans">
      {/* Background Ambient Glows & Grid */}
      <div className="pointer-events-none absolute top-[-10rem] left-1/2 -translate-x-1/2 w-[45rem] h-[30rem] bg-gradient-to-b from-[#F4600F]/25 via-[#FFA733]/10 to-transparent rounded-full blur-[110px]" />
      <div className="pointer-events-none absolute bottom-[-10rem] right-[-5rem] w-[35rem] h-[25rem] bg-[#F4600F]/10 rounded-full blur-[120px]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(#ffffff0a_1px,transparent_1px)] [background-size:24px_24px] opacity-40" />

      {/* ===================== NAVBAR ===================== */}
      <header className="relative z-20 w-full max-w-6xl mx-auto px-4 sm:px-6 py-5 flex items-center justify-between">
        <Logo size="md" onDark={true} />

        <div className="flex items-center gap-2.5 sm:gap-3">
          <ThemeToggle />
          <Link
            to="/login"
            className="text-xs sm:text-sm font-semibold px-3.5 sm:px-4 py-2 rounded-xl text-white/80 hover:text-white hover:bg-white/10 transition-colors"
          >
            Sign In
          </Link>
          <Link
            to="/register"
            className="text-xs sm:text-sm font-semibold px-4 sm:px-5 py-2 rounded-xl bg-gradient-to-r from-[#F4600F] to-[#FFA733] hover:brightness-110 text-white shadow-[0_4px_15px_rgba(244,96,15,0.4)] active:scale-95 transition-all"
          >
            Sign Up
          </Link>
        </div>
      </header>

      {/* ===================== HERO & MAIN CONTENT ===================== */}
      <main className="relative z-10 w-full max-w-6xl mx-auto px-4 sm:px-6 py-8 md:py-12 flex-1 flex flex-col items-center justify-center">
        {/* Hero Headline */}
        <div className="text-center max-w-2xl mx-auto flex flex-col items-center gap-4 mb-8 sm:mb-12">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-brand/15 border border-brand/30 text-brand-light shadow-[0_0_20px_rgba(244,96,15,0.25)] backdrop-blur-md">
            <Sparkles className="w-3.5 h-3.5 text-gold animate-pulse" />
            <span>High Quality WebRTC Video &amp; Messaging</span>
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight font-display text-white leading-[1.12]">
            Connect Freely in{" "}
            <span className="bg-gradient-to-r from-[#FFA733] via-[#F4600F] to-[#FF3D00] bg-clip-text text-transparent drop-shadow-[0_4px_24px_rgba(244,96,15,0.4)]">
              Real Time
            </span>
          </h1>

          <p className="text-sm sm:text-base text-white/60 leading-relaxed max-w-lg">
            Low-latency mesh video calls, responsive group layouts up to 6 people, and secure instant messaging with zero setup.
          </p>
        </div>

        {/* ===================== INTERACTIVE CALL CARD ===================== */}
        <div className="w-full max-w-md relative">
          {/* Card Border Glow */}
          <div className="absolute -inset-0.5 bg-gradient-to-r from-[#F4600F] to-[#FFA733] rounded-[2rem] blur opacity-40 group-hover:opacity-75 transition duration-500" />

          <div className="relative bg-[#111319]/90 backdrop-blur-2xl border border-white/10 rounded-[1.85rem] p-6 sm:p-8 shadow-[0_20px_50px_rgba(0,0,0,0.85)] flex flex-col gap-5">
            <div className="flex items-center justify-between pb-4 border-b border-white/10">
              <div className="flex items-center gap-3">
                <span className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#F4600F] to-[#FFA733] flex items-center justify-center text-white shadow-[0_0_15px_rgba(244,96,15,0.4)]">
                  <Video className="w-5 h-5" strokeWidth={2} />
                </span>
                <div>
                  <h2 className="font-display font-bold text-base sm:text-lg text-white">Instant Video Room</h2>
                  <p className="text-xs text-white/50">Join as guest with a room code</p>
                </div>
              </div>
            </div>

            {error && (
              <div className="text-xs sm:text-sm bg-danger/20 border border-danger/40 text-danger-light rounded-xl px-3.5 py-2.5 text-center font-medium">
                {error}
              </div>
            )}

            <form onSubmit={handleJoin} className="flex flex-col gap-3.5">
              {/* Name Input */}
              <div className="relative flex items-center">
                <span className="absolute left-4 text-white/40 pointer-events-none">
                  <User className="w-4 h-4" />
                </span>
                <input
                  type="text"
                  placeholder="Your Name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={30}
                  className="w-full bg-white/[0.06] border border-white/10 rounded-xl pl-11 pr-4 py-3 text-sm text-white placeholder:text-white/35 focus:outline-none focus:ring-2 focus:ring-brand/60 focus:bg-white/[0.09] transition-all"
                />
              </div>

              {/* Room Code Input + Generate Button */}
              <div className="relative flex items-center">
                <span className="absolute left-4 text-white/40 pointer-events-none">
                  <Lock className="w-4 h-4" />
                </span>
                <input
                  type="text"
                  placeholder="6-Digit Room Code"
                  value={roomCode}
                  onChange={(e) => setRoomCode(e.target.value)}
                  maxLength={6}
                  className="w-full bg-white/[0.06] border border-white/10 rounded-xl pl-11 pr-24 py-3 text-sm text-white uppercase tracking-widest font-mono placeholder:normal-case placeholder:tracking-normal placeholder:text-white/35 focus:outline-none focus:ring-2 focus:ring-brand/60 focus:bg-white/[0.09] transition-all"
                />
                <button
                  type="button"
                  onClick={handleGenerateCode}
                  title="Generate random room code"
                  className="absolute right-2 text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-gold hover:text-white transition-all flex items-center gap-1"
                >
                  <RefreshCw className="w-3 h-3" /> New
                </button>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full mt-1 bg-gradient-to-r from-[#F4600F] via-[#FA7B17] to-[#FFA733] hover:brightness-110 text-white font-bold text-sm tracking-wide rounded-xl py-3.5 shadow-[0_8px_25px_rgba(244,96,15,0.4)] active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Entering Room…</span>
                  </>
                ) : (
                  <>
                    <span>Join Video Call</span>
                    <ArrowRight className="w-4 h-4" strokeWidth={2.5} />
                  </>
                )}
              </button>
            </form>

            <div className="flex items-center gap-3 text-white/20 text-xs my-1">
              <div className="flex-1 h-px bg-white/10" />
              <span>OR</span>
              <div className="flex-1 h-px bg-white/10" />
            </div>

            {/* Account Sign In Row */}
            <div className="flex items-center justify-between text-xs text-white/60 bg-white/[0.03] border border-white/5 rounded-xl p-3">
              <span>Have an account?</span>
              <div className="flex items-center gap-2">
                <Link to="/login" className="text-brand-light font-semibold hover:underline">
                  Log in
                </Link>
                <span className="text-white/20">&bull;</span>
                <Link to="/register" className="text-white font-semibold hover:underline">
                  Register
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* ===================== 3-CARD FEATURE SHOWCASE ===================== */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 w-full max-w-4xl mt-12 sm:mt-16">
          <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-5 flex flex-col gap-2.5 hover:border-brand/40 hover:bg-white/[0.05] transition-all">
            <span className="w-9 h-9 rounded-xl bg-[#F4600F]/15 border border-[#F4600F]/30 text-brand-light flex items-center justify-center">
              <Video className="w-4.5 h-4.5" />
            </span>
            <h3 className="font-display font-semibold text-sm text-white">HD Mesh Calling</h3>
            <p className="text-xs text-white/50 leading-relaxed">
              Multi-peer WebRTC video with responsive grid layouts, draggable PiP bubble, and active camera switching.
            </p>
          </div>

          <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-5 flex flex-col gap-2.5 hover:border-brand/40 hover:bg-white/[0.05] transition-all">
            <span className="w-9 h-9 rounded-xl bg-[#FFA733]/15 border border-[#FFA733]/30 text-gold flex items-center justify-center">
              <MessageCircle className="w-4.5 h-4.5" />
            </span>
            <h3 className="font-display font-semibold text-sm text-white">Real-Time Chat</h3>
            <p className="text-xs text-white/50 leading-relaxed">
              Instant messaging with typing indicators, image sharing, emoji reactions, and push notifications.
            </p>
          </div>

          <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-5 flex flex-col gap-2.5 hover:border-brand/40 hover:bg-white/[0.05] transition-all">
            <span className="w-9 h-9 rounded-xl bg-[#F4600F]/15 border border-[#F4600F]/30 text-brand-light flex items-center justify-center">
              <ShieldCheck className="w-4.5 h-4.5" />
            </span>
            <h3 className="font-display font-semibold text-sm text-white">Zero Setup</h3>
            <p className="text-xs text-white/50 leading-relaxed">
              Instant guest room access for quick meetings, or create an account for persistent friends &amp; call history.
            </p>
          </div>
        </div>
      </main>

      {/* ===================== FOOTER ===================== */}
      <footer className="relative z-10 w-full max-w-6xl mx-auto px-4 sm:px-6 py-6 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-white/40">
        <div>Peerly &copy; {new Date().getFullYear()} &bull; Video &amp; Chat Platform</div>
        <div className="flex items-center gap-4">
          <Link to="/login" className="hover:text-white transition-colors">
            Sign In
          </Link>
          <Link to="/register" className="hover:text-white transition-colors">
            Create Account
          </Link>
        </div>
      </footer>
    </div>
  );
}
