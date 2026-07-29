/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        // WhatsApp-ish palette, named so class usage stays readable
        brand: {
          DEFAULT: "#4f46e5",
          dark: "#4338ca",
        },
        chatbg: "#efeae2",
        bubbleOwn: "#d9fdd3",
      },
    },
  },
  plugins: [],
};
