import type { Config } from "tailwindcss";

/**
 * Emory. The brand is black and white; the agents carry the colour.
 * Agent colours are functional — they only appear where an agent owns the
 * thing being shown. No gradients, no tints, no secondary palettes.
 */
const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    // hero clamp(38,5.4vw,60) · section 31 · h3 22 · body 16.5 · caption 13.5
    fontSize: {
      caption: ["0.84375rem", { lineHeight: "1.25rem" }],
      sm: ["0.9375rem", { lineHeight: "1.4rem" }],
      body: ["1.03125rem", { lineHeight: "1.6rem" }],
      lead: ["1.1875rem", { lineHeight: "1.75rem" }],
      h3: ["1.375rem", { lineHeight: "1.75rem" }],
      h2: ["1.5625rem", { lineHeight: "1.95rem" }],
      section: ["1.9375rem", { lineHeight: "2.3rem" }],
      display: ["2.5rem", { lineHeight: "2.75rem" }],
      hero: ["clamp(2.375rem, 5.4vw, 3.75rem)", { lineHeight: "1.05" }],
    },
    extend: {
      colors: {
        ink: "var(--ink)",
        paper: "var(--paper)",
        wash: "var(--wash)",
        line: "var(--line)",
        mute: "var(--mute)",
        agent: {
          audit: "#4A5568",
          scout: "#2F6B3F",
          beacon: "#FF6B1A",
          write: "#3A3A3D",
          studio: "#F5C400",
          media: "#1B6FD4",
          envoy: "#0E9AA7",
          forge: "#B23A28",
          hunt: "#6B3FA0",
          ledge: "#24386B",
          guard: "#6B1218",
        },
      },
      fontFamily: {
        display: ["var(--font-display)", "Newsreader", "Georgia", "serif"],
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      maxWidth: {
        measure: "68ch",
        shell: "78rem",
      },
      spacing: {
        4.5: "1.125rem",
        13: "3.25rem",
        15: "3.75rem",
        18: "4.5rem",
        22: "5.5rem",
        30: "7.5rem",
        62: "15.5rem",
      },
      borderRadius: {
        DEFAULT: "0.25rem",
        md: "0.375rem",
        lg: "0.5rem",
      },
      boxShadow: {
        card: "0 1px 2px rgb(13 13 15 / 0.04), 0 8px 24px -16px rgb(13 13 15 / 0.18)",
        pop: "0 2px 8px rgb(13 13 15 / 0.06), 0 24px 56px -28px rgb(13 13 15 / 0.28)",
      },
      keyframes: {
        // Motion lives in two places only: analysis progress, and approval
        // queue state changes. Nothing else in the product animates.
        "queue-out": {
          from: { opacity: "1", transform: "translateY(0)" },
          to: { opacity: "0", transform: "translateY(-4px)" },
        },
        sweep: {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(300%)" },
        },
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
      },
      animation: {
        "queue-out": "queue-out 0.22s ease-in both",
        sweep: "sweep 1.4s ease-in-out infinite",
        "fade-in": "fade-in 0.2s ease-out both",
      },
    },
  },
  plugins: [],
};

export default config;
