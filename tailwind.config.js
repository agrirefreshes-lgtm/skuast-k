/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        skuast: {
          green: "#0f5132",
          gold: "#d4af37",
          dark: "#0b2e1b",
        },
      },
    },
  },
  plugins: [],
};