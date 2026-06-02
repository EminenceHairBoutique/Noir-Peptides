/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        gold: "#D4AF37",
        ivory: "#FAF8F5",
        charcoal: "#1B1B1B",
        softGray: "#EAE8E3",
      },
      fontFamily: {
        // Primary brand typography
        header: ["Playfair Display", "serif"],
        // Some pages already reference `font-display`; keep it as an alias.
        display: ["Playfair Display", "serif"],
        body: ["Poppins", "system-ui", "sans-serif"],
        cursive: ["Allura", "cursive"],
      },

      boxShadow: {
        goldGlow: "0 0 25px rgba(212,175,55,0.25)",
      },
      borderRadius: {
        card: "1rem",
      },
    },
  },
  plugins: [],
};
