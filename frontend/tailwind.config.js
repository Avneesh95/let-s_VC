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
          DEFAULT: "#1F6F5C",
          dark: "#175545",
          light: "#2A8C74",
        },
        neon: "#39FFC0", // glow accent — used sparingly on active/live states
        accent: "#E8A33D",
        danger: "#C1443B",
        // Video call screens stay dark regardless of the app's light/dark
        // theme (same convention Zoom, WhatsApp, and every other calling
        // UI follows) — this is a fixed color, not a CSS variable, so it
        // never flips when the user toggles light/dark mode.
        callbg: "#0B0D12",
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
      },
      boxShadow: {
        neon: "0 0 12px rgb(57 255 192 / 0.5), 0 0 2px rgb(57 255 192 / 0.8)",
        "neon-brand": "0 0 16px rgb(31 111 92 / 0.45)",
      },
    },
  },
  plugins: [],
};
