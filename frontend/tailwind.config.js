/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Hand-Drawn design system colors
        paper: {
          bg: "#fdfbf7",     // Warm Paper
          text: "#2d2d2d",   // Soft Pencil Black
          muted: "#e5e0d8",  // Old Paper / Erased Pencil
          accent: "#ff4d4d", // Red Correction Marker
          border: "#2d2d2d", // Pencil Lead
          blue: "#2d5da1",   // Blue Ballpoint Pen
          postit: "#fff9c4", // Post-it Yellow
        },
      },
      fontFamily: {
        kalam: ["var(--font-kalam)", "cursive"],
        patrick: ["var(--font-patrick-hand)", "cursive"],
      },
      boxShadow: {
        // Hard offset shadows with no blur
        solid: "4px 4px 0px 0px #2d2d2d",
        solidLg: "8px 8px 0px 0px #2d2d2d",
        solidSm: "2px 2px 0px 0px #2d2d2d",
      },
      animation: {
        wiggle: "wiggle 0.3s ease-in-out infinite",
        float: "float 3s ease-in-out infinite",
      },
      keyframes: {
        wiggle: {
          "0%, 100%": { transform: "rotate(-1deg)" },
          "50%": { transform: "rotate(1deg)" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-6px)" },
        },
      },
    },
  },
  plugins: [],
};
