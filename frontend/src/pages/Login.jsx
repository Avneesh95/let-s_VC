import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import ThemeToggle from "../components/ThemeToggle";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    try {
      await login(email, password);
      navigate("/chat");
    } catch (err) {
      setError(err.response?.data?.message || "Login failed");
    }
  };

  return (
    <div className="relative h-dvh flex items-center justify-center bg-paper px-4">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-sm flex flex-col gap-6">
        <div className="text-center">
          <span className="font-display font-semibold text-2xl text-ink tracking-tight">
            chat<span className="text-brand">/</span>app
          </span>
        </div>
        <form
          onSubmit={handleSubmit}
          className="bg-surface p-8 rounded-2xl shadow-sm border border-line/10 flex flex-col gap-3"
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
            className="bg-brand hover:bg-brand-dark text-white font-semibold rounded-lg py-2.5 mt-1 transition-colors"
          >
            Log in
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
      </div>
    </div>
  );
}
