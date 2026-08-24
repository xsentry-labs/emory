import type { RiskClass } from "@/lib/types";

export const RISK: Record<RiskClass, { label: string; note: string }> = {
  low: {
    label: "Low risk",
    note: "Reversible, and nothing a visitor sees changes meaning. Emory can be allowed to do these on its own.",
  },
  medium: {
    label: "Needs you",
    note: "Changes meaning, or leaves your building. Always waits for you.",
  },
  high: {
    label: "Confirm carefully",
    note: "Hard to undo, or touches money. Emory will not run these without an explicit confirmation.",
  },
};
