import type { Config } from "tailwindcss";

/**
 * Emory. Grey ground, IBM Plex Mono for headings and controls, Plex Sans for
 * reading, one periwinkle accent for the next action. Dark by default; every
 * colour is a CSS variable so the light theme is a token swap (globals.css).
 */
// Relative colour syntax keeps Tailwind's /opacity modifiers working on CSS variables.
const c = (name: string) => `rgb(from var(--${name}) r g b / <alpha-value>)`;

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    // hero clamp(38,5.4vw,60) · section 31 · h3 22 · body 16.5 · caption 13.5
    fontSize: {
      xs: ["0.75rem", { lineHeight: "1.1rem" }],
      caption: ["0.84375rem", { lineHeight: "1.25rem" }],
      sm: ["0.9375rem", { lineHeight: "1.4rem" }],
      base: ["1rem", { lineHeight: "1.5rem" }],
      body: ["1.03125rem", { lineHeight: "1.6rem" }],
      lg: ["1.125rem", { lineHeight: "1.6rem" }],
      xl: ["1.25rem", { lineHeight: "1.75rem" }],
      lead: ["1.1875rem", { lineHeight: "1.75rem" }],
      h3: ["1.375rem", { lineHeight: "1.75rem" }],
      h2: ["1.5625rem", { lineHeight: "1.95rem" }],
      section: ["1.9375rem", { lineHeight: "2.3rem" }],
      display: ["2.5rem", { lineHeight: "2.75rem" }],
      hero: ["clamp(2.375rem, 5.4vw, 3.75rem)", { lineHeight: "1.05" }],
    },
    extend: {
      colors: {
        ink: c("ink"),
        paper: c("paper"),
        wash: c("wash"),
        line: c("line"),
        mute: c("mute"),
        field: "var(--field)",
        "line-soft": "var(--line-soft)",
        accent: c("accent"),
        "accent-ink": "var(--accent-ink)",
        "accent-wash": "var(--accent-wash)",
        danger: c("danger"),
      },
      fontFamily: {
        display: ["var(--font-mono)", "ui-monospace", "monospace"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
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
        // Motion lives in one place: approval queue state changes.
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
