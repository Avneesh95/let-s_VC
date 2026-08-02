import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div className="h-dvh flex items-center justify-center bg-paper px-4">
      <div className="text-center flex flex-col items-center gap-3">
        <span className="font-display font-semibold text-2xl text-ink tracking-tight">
          chat<span className="text-brand">/</span>app
        </span>
        <p className="text-ink/60 text-sm">That page doesn't exist.</p>
        <Link
          to="/"
          className="mt-2 bg-brand hover:bg-brand-dark transition-colors text-white font-semibold rounded-lg px-5 py-2 text-sm"
        >
          Go home
        </Link>
      </div>
    </div>
  );
}
