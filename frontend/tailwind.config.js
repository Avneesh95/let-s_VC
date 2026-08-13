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
          DEFAULT: "#0F6B52", // deep emerald — the primary brand color
          dark: "#0A4A3B",
          light: "#23997A",
        },
        gold: {
          DEFAULT: "#C9A24B", // muted brass gold — the premium accent, used sparingly
          light: "#DDBE73",
          dark: "#9C7C33",
        },
        // Reused for "live" states (online dot, active screen-share) —
        // a warm gold glow instead of a stock neon green reads far more
        // like a boutique product than a gamer-app accent.
        neon: "#D4AF6A",
        accent: "#C9A24B",
        danger: "#B23B33",
        // Video call screens stay dark regardless of the app's light/dark
        // theme (same convention Zoom, WhatsApp, and every other calling
        // UI follows) — this is a fixed color, not a CSS variable, so it
        // never flips when the user toggles light/dark mode.
        callbg: "#0A0C0B",
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
        neon: "0 0 14px rgb(212 175 106 / 0.45), 0 0 2px rgb(212 175 106 / 0.75)",
        "neon-brand": "0 0 22px rgb(15 107 82 / 0.4)",
        // Layered, low-contrast depth for cards and modals — the kind of
        // shadow that reads as "considered" rather than a flat drop-shadow.
        premium: "0 1px 2px rgb(0 0 0 / 0.04), 0 12px 28px -8px rgb(0 0 0 / 0.16), 0 3px 8px -3px rgb(0 0 0 / 0.08)",
        "premium-lg": "0 24px 64px -12px rgb(0 0 0 / 0.35), 0 8px 24px -8px rgb(0 0 0 / 0.22)",
      },
      backgroundImage: {
        "brand-gradient": "linear-gradient(135deg, #147A5D 0%, #0A4A3B 100%)",
        "gold-gradient": "linear-gradient(135deg, #DDBE73 0%, #9C7C33 100%)",
      },
    },
  },
  plugins: [],
};
