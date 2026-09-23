import { useState } from "react";
import { Navigate, Link, useNavigate } from "react-router-dom";
import {
  Video,
  ArrowRight,
  Loader2,
  Sparkles,
  MessageSquare,
  ShieldCheck,
  RefreshCw,
  User,
  Lock,
  Zap,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import ThemeToggle from "../components/ThemeToggle";
import Logo from "../components/Logo";
import generateRoomCode from "../utils/generateRoomCode";

export default function Home() {
  const { user, guestLogin } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Logged-in accounts go straight to the chat app
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
    if (!name.trim()) setName("Guest " + Math.floor(100 + Math.random() * 900));
  };

  return (
    <div className="h-dvh max-h-dvh w-full overflow-hidden bg-[#08090C] text-white flex flex-col justify-between selection:bg-brand selection:text-white relative p-4 sm:p-6 lg:px-10 lg:py-6 font-sans">
      {/* Background Ambient Glows */}
      <div className="pointer-events-none absolute top-[-8rem] left-1/2 -translate-x-1/2 w-[40rem] h-[25rem] bg-gradient-to-b from-[#F4600F]/20 via-[#FFA733]/10 to-transparent rounded-full blur-[100px]" />
      <div className="pointer-events-none absolute bottom-[-8rem] right-[-5rem] w-[30rem] h-[20rem] bg-[#F4600F]/10 rounded-full blur-[100px]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(#ffffff08_1px,transparent_1px)] [background-size:20px_20px] opacity-40" />

      {/* ===================== TOP NAVBAR ===================== */}
      <header className="relative z-20 w-full max-w-7xl mx-auto flex items-center justify-between shrink-0">
        <Logo size="md" onDark={true} />

        <div className="flex items-center gap-2 sm:gap-3">
          <ThemeToggle />
          <Link
            to="/login"
            className="text-xs sm:text-sm font-semibold px-3.5 sm:px-4 py-2 rounded-xl text-white/80 hover:text-white hover:bg-white/10 transition-colors"
          >
            Sign In
          </Link>
          <Link
            to="/register"
            className="text-xs sm:text-sm font-bold px-4 sm:px-5 py-2 rounded-xl bg-gradient-to-r from-[#F4600F] to-[#FFA733] hover:brightness-110 text-white shadow-[0_4px_15px_rgba(244,96,15,0.4)] active:scale-95 transition-all"
          >
            Sign Up
          </Link>
        </div>
      </header>

      {/* ===================== HERO MAIN CONTENT (1 SCREEN, NO SCROLL) ===================== */}
      <main className="relative z-10 w-full max-w-7xl mx-auto flex-1 min-h-0 flex items-center justify-center my-auto py-2 sm:py-4">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-12 items-center w-full">
          {/* LEFT COLUMN: HERO TEXT & VALUE PROPS */}
          <div className="lg:col-span-7 flex flex-col gap-3 sm:gap-4 text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-brand/15 border border-brand/30 text-brand-light shadow-[0_0_15px_rgba(244,96,15,0.2)] w-fit backdrop-blur-md">
              <Sparkles className="w-3.5 h-3.5 text-gold animate-pulse" />
              <span>Next-Gen WebRTC Video &amp; Real-Time Chat</span>
            </div>

            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-[3.25rem] font-extrabold tracking-tight font-display text-white leading-[1.12]">
              Connect Freely in{" "}
              <span className="bg-gradient-to-r from-[#FFA733] via-[#F4600F] to-[#FF4500] bg-clip-text text-transparent drop-shadow-[0_4px_20px_rgba(244,96,15,0.4)]">
                Real Time
              </span>
            </h1>

            <p className="text-xs sm:text-sm md:text-base text-white/65 leading-relaxed max-w-xl">
              High-definition mesh group calls up to 6 people, zero-overflow instant messaging,
              and seamless screen sharing right from your browser.
            </p>

            {/* Feature Highlights Badges */}
            <div className="flex flex-wrap gap-2.5 pt-1">
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.04] border border-white/10 text-xs font-medium text-white/80">
                <Video className="w-3.5 h-3.5 text-brand-light" /> Mesh Calling
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.04] border border-white/10 text-xs font-medium text-white/80">
                <MessageSquare className="w-3.5 h-3.5 text-gold" /> Encrypted Chat
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.04] border border-white/10 text-xs font-medium text-white/80">
                <Zap className="w-3.5 h-3.5 text-emerald-400" /> Zero Install
              </span>
            </div>
          </div>

          {/* RIGHT COLUMN: INSTANT CALL JOIN CARD */}
          <div className="lg:col-span-5 w-full max-w-md mx-auto">
            <div className="relative">
              {/* Card Glow */}
              <div className="absolute -inset-0.5 bg-gradient-to-r from-[#F4600F] to-[#FFA733] rounded-3xl blur opacity-35" />

              <div className="relative bg-[#111319]/92 backdrop-blur-2xl border border-white/10 rounded-3xl p-5 sm:p-6 shadow-[0_20px_50px_rgba(0,0,0,0.85)] flex flex-col gap-4">
                <div className="flex items-center justify-between pb-3 border-b border-white/10">
                  <div className="flex items-center gap-3">
                    <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#F4600F] to-[#FFA733] flex items-center justify-center text-white shadow-sm">
                      <Video className="w-4.5 h-4.5" strokeWidth={2.2} />
                    </span>
                    <div>
                      <h2 className="font-display font-bold text-sm sm:text-base text-white">
                        Instant Video Room
                      </h2>
                      <p className="text-[11px] text-white/50">Enter code or generate one</p>
                    </div>
                  </div>
                </div>

                {error && (
                  <div className="text-xs bg-danger/20 border border-danger/40 text-danger-light rounded-xl px-3 py-2 text-center font-medium">
                    {error}
                  </div>
                )}

                <form onSubmit={handleJoin} className="flex flex-col gap-3">
                  {/* Name Input */}
                  <div className="relative flex items-center">
                    <span className="absolute left-3.5 text-white/40 pointer-events-none">
                      <User className="w-4 h-4" />
                    </span>
                    <input
                      type="text"
                      placeholder="Your Display Name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      maxLength={30}
                      className="w-full bg-white/[0.06] border border-white/10 rounded-xl pl-10 pr-3.5 py-2.5 text-xs sm:text-sm text-white placeholder:text-white/35 focus:outline-none focus:ring-2 focus:ring-brand/60 transition-all"
                    />
                  </div>

                  {/* Room Code Input + Generate Button */}
                  <div className="relative flex items-center">
                    <span className="absolute left-3.5 text-white/40 pointer-events-none">
                      <Lock className="w-4 h-4" />
                    </span>
                    <input
                      type="text"
                      placeholder="6-Digit Room Code"
                      value={roomCode}
                      onChange={(e) => setRoomCode(e.target.value)}
                      maxLength={6}
                      className="w-full bg-white/[0.06] border border-white/10 rounded-xl pl-10 pr-20 py-2.5 text-xs sm:text-sm text-white uppercase tracking-wider font-mono placeholder:normal-case placeholder:font-sans placeholder:tracking-normal placeholder:text-white/35 focus:outline-none focus:ring-2 focus:ring-brand/60 transition-all"
                    />
                    <button
                      type="button"
                      onClick={handleGenerateCode}
                      title="Generate new random room code"
                      className="absolute right-1.5 text-xs font-semibold px-2.5 py-1.2 rounded-lg bg-white/10 hover:bg-white/20 text-gold hover:text-white transition-all flex items-center gap-1 cursor-pointer"
                    >
                      <RefreshCw className="w-3 h-3" /> New
                    </button>
                  </div>

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full mt-1 bg-gradient-to-r from-[#F4600F] via-[#FA7B17] to-[#FFA733] hover:brightness-110 active:scale-[0.98] text-white font-bold text-xs sm:text-sm rounded-xl py-3 shadow-[0_6px_20px_rgba(244,96,15,0.4)] transition-all flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Joining Room…</span>
                      </>
                    ) : (
                      <>
                        <span>Join Video Call</span>
                        <ArrowRight className="w-4 h-4" strokeWidth={2.2} />
                      </>
                    )}
                  </button>
                </form>

                {/* Account Sign In Switch */}
                <div className="flex items-center justify-between text-xs text-white/60 bg-white/[0.02] border border-white/5 rounded-xl px-3 py-2">
                  <span>Have an account?</span>
                  <div className="flex items-center gap-2 font-medium">
                    <Link to="/login" className="text-brand-light hover:underline">
                      Log in
                    </Link>
                    <span className="text-white/20">&bull;</span>
                    <Link to="/register" className="text-white hover:underline">
                      Register
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* ===================== COMPACT BOTTOM FOOTER ===================== */}
      <footer className="relative z-10 w-full max-w-7xl mx-auto flex flex-row items-center justify-between text-[11px] text-white/40 pt-2 border-t border-white/5 shrink-0">
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
