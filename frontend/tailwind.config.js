/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        // A deliberate palette, not the default indigo every AI-generated
        // app reaches for. Emerald reads as "communication/connection"
        // without being WhatsApp-green or Signal-blue derivative.
        brand: {
          DEFAULT: "#1F6F5C",
          dark: "#175545",
          light: "#2A8C74",
        },
        ink: "#14171F",
        paper: "#F6F5F1",
        accent: "#E8A33D",
        danger: "#C1443B",
        chatbg: "#EFEEE9",
        bubbleOwn: "#DCEEE7",
      },
      fontFamily: {
        display: ["'Space Grotesk'", "sans-serif"],
        sans: ["Inter", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
