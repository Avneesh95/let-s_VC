import { Link } from "react-router-dom";
import { Compass } from "lucide-react";
import Logo from "../components/Logo";

export default function NotFound() {
  return (
    <div className="relative h-dvh flex items-center justify-center bg-paper px-4 overflow-hidden">
      <div className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 w-[30rem] h-[30rem] rounded-full bg-brand/10 blur-3xl" />
      <div className="relative text-center flex flex-col items-center gap-4">
        <Logo size="md" />
        <span className="w-12 h-12 rounded-full bg-ink/5 flex items-center justify-center text-ink/30 mt-2">
          <Compass className="w-5 h-5" strokeWidth={1.5} />
        </span>
        <div>
          <p className="font-serif text-xl text-ink">That page doesn't exist.</p>
          <p className="text-sm text-ink/60 mt-1">Let's get you back on track.</p>
        </div>
        <Link
          to="/"
          className="mt-2 bg-brand-gradient hover:brightness-110 transition-all text-white font-semibold rounded-xl px-6 py-2.5 text-sm shadow-neon-brand"
        >
          Go home
        </Link>
      </div>
    </div>
  );
}
