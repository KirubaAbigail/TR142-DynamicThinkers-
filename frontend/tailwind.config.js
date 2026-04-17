/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#0a0a0c",
        panel: "#16161e",
        accent: "#3b82f6",
        safe: "#10b981",
        warning: "#f59e0b",
        danger: "#ef4444",
      }
    },
  },
  plugins: [],
}
