import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Register() {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    try {
      await register(username, email, password);
      navigate("/chat");
    } catch (err) {
      setError(err.response?.data?.message || "Registration failed");
    }
  };

  return (
    <div className="h-dvh flex items-center justify-center bg-paper px-4">
      <div className="w-full max-w-sm flex flex-col gap-6">
        <div className="text-center">
          <span className="font-display font-semibold text-2xl text-ink tracking-tight">
            chat<span className="text-brand">/</span>app
          </span>
        </div>
        <form
          onSubmit={handleSubmit}
          className="bg-white p-8 rounded-2xl shadow-sm border border-black/5 flex flex-col gap-3"
        >
          <h1 className="font-display text-xl font-semibold text-ink mb-1">Create account</h1>
          {error && <p className="text-danger text-sm">{error}</p>}
          <input
            type="text"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            className="border border-black/10 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand transition-shadow"
          />
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="border border-black/10 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand transition-shadow"
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            className="border border-black/10 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand transition-shadow"
          />
          <button
            type="submit"
            className="bg-brand hover:bg-brand-dark text-white font-semibold rounded-lg py-2.5 mt-1 transition-colors"
          >
            Sign up
          </button>
          <p className="text-sm text-center text-ink/50">
            Already have an account?{" "}
            <Link to="/login" className="text-brand hover:underline font-medium">
              Log in
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
