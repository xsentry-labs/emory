import type { SeoSeverity } from "@/lib/types";

export const SEVERITY: Record<
  SeoSeverity,
  { label: string; text: string; chip: string; bar: string; rule: string }
> = {
  critical: {
    label: "Critical",
    text: "text-wire-red",
    chip: "border-wire-red/40 bg-wire-red/10 text-wire-red",
    bar: "bg-wire-red",
    rule: "border-l-wire-red",
  },
  warning: {
    label: "Warning",
    text: "text-desk-gold",
    chip: "border-desk-gold/40 bg-desk-gold/10 text-desk-gold",
    bar: "bg-desk-gold",
    rule: "border-l-desk-gold",
  },
  notice: {
    label: "Notice",
    text: "text-slate",
    chip: "border-line bg-paper text-slate",
    bar: "bg-slate",
    rule: "border-l-slate",
  },
};
