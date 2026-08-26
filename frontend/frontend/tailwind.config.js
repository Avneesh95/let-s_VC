/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        // Brand/accent colors stay constant across themes — only surfaces
        // and text flip. paper/ink/surface/line are driven by CSS
        // variables (defined in index.css) so toggling the `dark` class
        // on <html> re-themes the whole app without per-component
        // dark: variants everywhere.
        brand: {
          DEFAULT: "#F4600F", // vivid burnt orange — the primary brand color
          dark: "#C2440A",
          light: "#FB8A3C",
        },
        gold: {
          DEFAULT: "#FFA733", // warm amber-orange — the secondary accent, used sparingly
          light: "#FFC069",
          dark: "#C9791C",
        },
        // Reused for "live" states (online dot, active screen-share) —
        // a warm amber glow that stays in the orange family instead of a
        // stock neon green or gamer-app cyan.
        neon: "#FFB454",
        accent: "#FFA733",
        danger: "#B23B33",
        // Video call screens stay dark regardless of the app's light/dark
        // theme (same convention Zoom, WhatsApp, and every other calling
        // UI follows) — this is a fixed color, not a CSS variable, so it
        // never flips when the user toggles light/dark mode.
        callbg: "#0A0A0A",
        paper: "rgb(var(--color-paper) / <alpha-value>)",
        ink: "rgb(var(--color-ink) / <alpha-value>)",
        surface: "rgb(var(--color-surface) / <alpha-value>)",
        line: "rgb(var(--color-line) / <alpha-value>)",
        chatbg: "rgb(var(--color-chatbg) / <alpha-value>)",
        bubbleOwn: "rgb(var(--color-bubble-own) / <alpha-value>)",
      },
      fontFamily: {
        display: ["'Space Grotesk'", "sans-serif"],
        sans: ["Inter", "system-ui", "sans-serif"],
        // A warm, editorial serif reserved for the handful of headline
        // moments (auth screens, empty states) that should feel like a
        // considered greeting rather than app chrome.
        serif: ["'Fraunces'", "serif"],
      },
      boxShadow: {
        neon: "0 0 14px rgb(255 167 51 / 0.45), 0 0 2px rgb(255 167 51 / 0.75)",
        "neon-brand": "0 0 22px rgb(244 96 15 / 0.45)",
        // Layered, low-contrast depth for cards and modals — the kind of
        // shadow that reads as "considered" rather than a flat drop-shadow.
        premium: "0 1px 2px rgb(0 0 0 / 0.04), 0 12px 28px -8px rgb(0 0 0 / 0.16), 0 3px 8px -3px rgb(0 0 0 / 0.08)",
        "premium-lg": "0 24px 64px -12px rgb(0 0 0 / 0.35), 0 8px 24px -8px rgb(0 0 0 / 0.22)",
      },
      backgroundImage: {
        "brand-gradient": "linear-gradient(135deg, #F4600F 0%, #A5390A 100%)",
        "gold-gradient": "linear-gradient(135deg, #FFC069 0%, #C9791C 100%)",
      },
    },
  },
  plugins: [],
};
