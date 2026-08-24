import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/**
 * Our type scale and colour tokens are custom, so tailwind-merge has to be
 * told about them — otherwise it reads `text-paper` as a font size and drops
 * it when a size class is merged in beside it.
 */
const FONT_SIZES = [
  "caption",
  "sm",
  "body",
  "lead",
  "h3",
  "h2",
  "section",
  "display",
  "hero",
];

const COLORS = [
  "ink",
  "paper",
  "wash",
  "line",
  "mute",
  {
    agent: [
      "audit",
      "scout",
      "beacon",
      "write",
      "studio",
      "media",
      "envoy",
      "forge",
      "hunt",
      "ledge",
      "guard",
    ],
  },
];

const twMerge = extendTailwindMerge({
  override: {
    classGroups: {
      "font-size": [{ text: FONT_SIZES }],
    },
  },
  extend: {
    classGroups: {
      "text-color": [{ text: COLORS }],
      "bg-color": [{ bg: COLORS }],
      "border-color": [{ border: COLORS }],
      "ring-color": [{ ring: COLORS }],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function money(value: number) {
  return `$${value.toLocaleString("en-US")}`;
}

/** "9:17pm, Tuesday" — how a person would say it. */
export function whenLong(iso: string) {
  const date = new Date(iso);
  return date.toLocaleString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function whenShort(iso: string) {
  const minutes = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return `${Math.round(days / 30)}mo ago`;
}

export function confidenceLabel(confidence: number) {
  if (confidence >= 90) return "Certain";
  if (confidence >= 70) return "Confident";
  if (confidence >= 50) return "Unsure";
  return "Guessing";
}

export const SOURCE_LABEL: Record<string, string> = {
  inferred: "Read from your site",
  confirmed: "Confirmed by you",
  learned: "Learned from conversations",
  observed: "Observed from results",
};
