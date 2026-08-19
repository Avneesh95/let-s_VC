import { useState } from "react";
import { Lock, Eye, EyeOff } from "lucide-react";

// Shared by Login and Register so both get the same behavior — a visible
// password field is one of the highest-value, lowest-cost things a login
// form can offer (catches typos, works with password managers pasting in
// odd characters) and previously neither form had it at all.
export default function PasswordInput({
  value,
  onChange,
  placeholder = "Password",
  autoComplete = "current-password",
  minLength,
  error,
  autoFocus,
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div>
      <label className="relative flex items-center">
        <Lock className="absolute left-3.5 w-4 h-4 text-ink/30 pointer-events-none" strokeWidth={1.75} />
        <input
          type={visible ? "text" : "password"}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          required
          minLength={minLength}
          autoComplete={autoComplete}
          autoFocus={autoFocus}
          aria-invalid={!!error}
          // text-base (16px) on mobile, not text-sm (14px) — iOS Safari
          // auto-zooms the whole page on focus for any input under 16px,
          // which then has to be manually pinched back out. Every input
          // in both forms had this at 14px.
          className={`w-full border bg-paper/40 rounded-xl pl-10 pr-11 py-2.75 text-base sm:text-sm focus:outline-none focus:ring-2 transition-shadow ${
            error
              ? "border-danger/50 focus:ring-danger/30 focus:border-danger"
              : "border-line/15 focus:ring-brand/35 focus:border-brand"
          }`}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          // Keep this out of the form's own tab sequence — a sighted
          // mouse/touch user reaches for it directly, and a keyboard user
          // tabbing through the form shouldn't be interrupted by it
          // between the two password fields on Register.
          tabIndex={-1}
          aria-label={visible ? "Hide password" : "Show password"}
          className="absolute right-3 w-6 h-6 flex items-center justify-center text-ink/35 hover:text-ink/70 transition-colors"
        >
          {visible ? <EyeOff className="w-4 h-4" strokeWidth={1.75} /> : <Eye className="w-4 h-4" strokeWidth={1.75} />}
        </button>
      </label>
      {error && <p className="text-danger text-xs mt-1 ml-1">{error}</p>}
    </div>
  );
}
