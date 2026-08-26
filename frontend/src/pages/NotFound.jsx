import { Link } from "react-router-dom";
import { Compass, ArrowLeft } from "lucide-react";
import Logo from "../components/Logo";

export default function NotFound() {
  return (
    <div className="relative min-h-dvh flex items-center justify-center bg-[#08090C] text-white px-4 overflow-hidden font-sans">
      {/* Glow */}
      <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[32rem] h-[32rem] bg-gradient-to-tr from-[#F4600F]/20 to-[#FFA733]/10 rounded-full blur-[100px]" />

      <div className="relative text-center flex flex-col items-center gap-5 max-w-sm">
        <Logo size="lg" onDark={true} />

        <span className="w-16 h-16 rounded-2xl bg-white/[0.05] border border-white/10 flex items-center justify-center text-gold shadow-[0_0_20px_rgba(244,96,15,0.2)] mt-2">
          <Compass className="w-8 h-8" strokeWidth={1.75} />
        </span>

        <div>
          <h1 className="font-display text-2xl font-bold text-white tracking-tight">Page Not Found</h1>
          <p className="text-sm text-white/50 mt-1.5">
            The page you are looking for doesn&apos;t exist or has been moved.
          </p>
        </div>

        <Link
          to="/"
          className="mt-2 bg-gradient-to-r from-[#F4600F] to-[#FFA733] hover:brightness-110 text-white font-bold rounded-xl px-7 py-3 text-sm shadow-[0_6px_20px_rgba(244,96,15,0.35)] active:scale-95 transition-all flex items-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Go back home</span>
        </Link>
      </div>
    </div>
  );
}
