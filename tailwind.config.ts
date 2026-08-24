import type { Config } from "tailwindcss";

/**
 * Emory — "The Daily Growth Wire"
 * Newsroom tokens: paper stock, ink, hairline rules, desk accents.
 */
const config: Config = {
  darkMode: ["class"],
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    // Modular scale, ratio ~1.22, base 15px — replaces Tailwind's default ramp.
    fontSize: {
      "2xs": ["0.6875rem", { lineHeight: "1rem" }],
      xs: ["0.75rem", { lineHeight: "1.125rem" }],
      sm: ["0.8125rem", { lineHeight: "1.25rem" }],
      base: ["0.9375rem", { lineHeight: "1.5rem" }],
      lg: ["1.0625rem", { lineHeight: "1.625rem" }],
      xl: ["1.1875rem", { lineHeight: "1.75rem" }],
      "2xl": ["1.375rem", { lineHeight: "1.875rem" }],
      "3xl": ["1.6875rem", { lineHeight: "2.125rem" }],
      "4xl": ["2.0625rem", { lineHeight: "2.375rem" }],
      "5xl": ["2.5rem", { lineHeight: "2.75rem" }],
      "6xl": ["3.0625rem", { lineHeight: "3.25rem" }],
      "7xl": ["3.75rem", { lineHeight: "3.875rem" }],
    },
    extend: {
      colors: {
        paper: "hsl(var(--paper))",
        card: "hsl(var(--card))",
        ink: {
          DEFAULT: "hsl(var(--ink))",
          soft: "hsl(var(--ink-soft))",
        },
        slate: "hsl(var(--slate))",
        line: "hsl(var(--line))",
        "wire-red": "hsl(var(--wire-red))",
        "teletype-green": "hsl(var(--teletype-green))",
        "desk-gold": "hsl(var(--desk-gold))",
        "desk-navy": "hsl(var(--desk-navy))",
        "desk-purple": "hsl(var(--desk-purple))",
        "desk-orange": "hsl(var(--desk-orange))",
        "desk-teal": "hsl(var(--desk-teal))",
        ring: "hsl(var(--ring))",
      },
      fontFamily: {
        display: ["var(--font-display)", "Iowan Old Style", "Georgia", "serif"],
        mono: ["var(--font-mono)", "ui-monospace", "SFMono-Regular", "monospace"],
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      letterSpacing: {
        wire: "0.12em",
        stamp: "0.2em",
        tight: "-0.01em",
        tighter: "-0.02em",
      },
      // 8px rhythm — every step below is a multiple of 8 (or a deliberate half-step).
      spacing: {
        1.5: "0.375rem",
        4.5: "1.125rem",
        7: "1.75rem",
        13: "3.25rem",
        15: "3.75rem",
        18: "4.5rem",
        22: "5.5rem",
        26: "6.5rem",
        30: "7.5rem",
        68: "17rem",
      },
      borderRadius: {
        sm: "0.125rem",
        DEFAULT: "0.1875rem",
        md: "0.25rem",
        lg: "0.375rem",
        xl: "0.5rem",
      },
      boxShadow: {
        // Soft layered stock — sheets of paper, not flat outlines.
        sheet:
          "0 1px 1px hsl(var(--ink) / 0.04), 0 2px 6px -1px hsl(var(--ink) / 0.05), 0 8px 20px -8px hsl(var(--ink) / 0.08)",
        "sheet-raised":
          "0 1px 1px hsl(var(--ink) / 0.05), 0 4px 10px -2px hsl(var(--ink) / 0.07), 0 16px 32px -12px hsl(var(--ink) / 0.14)",
        rail: "0 1px 2px hsl(var(--ink) / 0.05), 0 12px 32px -16px hsl(var(--ink) / 0.2)",
        stamp: "inset 0 0 0 2px hsl(var(--wire-red) / 0.55)",
        overlay:
          "0 4px 12px -2px hsl(var(--ink) / 0.1), 0 32px 64px -24px hsl(var(--ink) / 0.35)",
      },
      backgroundImage: {
        newsprint:
          "radial-gradient(hsl(var(--ink) / 0.035) 1px, transparent 1px)",
      },
      backgroundSize: {
        newsprint: "3px 3px",
      },
      keyframes: {
        "fade-up": {
          from: { opacity: "0", transform: "translateY(6px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "stamp-in": {
          "0%": { opacity: "0", transform: "scale(1.6) rotate(-14deg)" },
          "60%": { opacity: "1", transform: "scale(0.94) rotate(-6deg)" },
          "100%": { opacity: "1", transform: "scale(1) rotate(-8deg)" },
        },
        ticker: {
          from: { transform: "translateX(0)" },
          to: { transform: "translateX(-50%)" },
        },
        "pulse-dot": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.35" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.35s cubic-bezier(0.16, 1, 0.3, 1) both",
        "stamp-in": "stamp-in 0.4s cubic-bezier(0.16, 1, 0.3, 1) both",
        ticker: "ticker 40s linear infinite",
        "pulse-dot": "pulse-dot 1.8s ease-in-out infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
