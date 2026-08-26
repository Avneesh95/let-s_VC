import { useState } from "react";
import { Eye, EyeOff, Lock } from "lucide-react";

export default function PasswordInput({
  value,
  onChange,
  placeholder = "Password",
  autoComplete = "current-password",
  minLength,
  error,
  autoFocus,
  className = "",
  inputClassName = "",
  leftIcon = true,
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div className={`w-full ${className}`}>
      <label className="relative flex items-center">
        {leftIcon && (
          <span className="absolute left-4 text-ink/40 pointer-events-none flex items-center justify-center">
            <Lock className="w-4 h-4" strokeWidth={2} />
          </span>
        )}
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
          className={
            inputClassName ||
            `w-full bg-paper rounded-xl ${
              leftIcon ? "pl-11" : "pl-4"
            } pr-11 py-3 text-base sm:text-sm text-ink placeholder:text-ink/35 focus:outline-none focus:ring-2 transition-all ${
              error ? "ring-2 ring-danger/50 focus:ring-danger" : "ring-1 ring-line/10 focus:ring-brand/50"
            }`
          }
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          tabIndex={-1}
          aria-label={visible ? "Hide password" : "Show password"}
          className="absolute right-4 w-6 h-6 flex items-center justify-center text-ink/40 hover:text-ink/70 transition-colors"
        >
          {visible ? <EyeOff className="w-4 h-4" strokeWidth={1.75} /> : <Eye className="w-4 h-4" strokeWidth={1.75} />}
        </button>
      </label>
      {error && <p className="text-danger text-xs mt-1 ml-3">{error}</p>}
    </div>
  );
}

