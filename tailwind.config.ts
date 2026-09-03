import type { Config } from "tailwindcss";

// Design tokens: institutional, not "developer dashboard".
// Ink navy for authority/trust, warm brass as the single accent (status + primary actions),
// warm paper background so long attendance tables stay readable, not a dark hacker theme.
const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          950: "#0B1220",
          900: "#101A2B",
          800: "#182541",
          700: "#233257",
          600: "#334876",
        },
        paper: {
          50: "#FAF9F6",
          100: "#F3F1EA",
        },
        brass: {
          400: "#C9A15A",
          500: "#B08A3E",
          600: "#8F6E2E",
        },
        state: {
          verified: "#1E7A46",
          review: "#B08A3E",
          notverified: "#B23B3B",
          absent: "#6B7280",
          late: "#C9772E",
        },
      },
      fontFamily: {
        sans: ["ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      borderRadius: {
        sm: "4px",
        md: "6px",
        lg: "10px",
      },
    },
  },
  plugins: [],
};
export default config;
