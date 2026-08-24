import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** "14 Mar 2026" — masthead edition line. */
export function editionDate(date: Date = new Date()) {
  return date
    .toLocaleDateString("en-GB", {
      weekday: "long",
      day: "2-digit",
      month: "long",
      year: "numeric",
    })
    .toUpperCase();
}

/** Wire-desk filing stamp: "09:42 · TODAY" / "17:08 · 2 DAYS AGO". */
export function filedAt(iso: string) {
  const then = new Date(iso);
  const time = then.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const days = Math.floor((Date.now() - then.getTime()) / 86_400_000);
  if (days <= 0) return `${time} · TODAY`;
  if (days === 1) return `${time} · YESTERDAY`;
  if (days < 7) return `${time} · ${days} DAYS AGO`;
  return then
    .toLocaleDateString("en-GB", { day: "2-digit", month: "short" })
    .toUpperCase();
}

/** Minutes-ago badge for the wire ticker. */
export function relativeShort(iso: string) {
  const mins = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
  if (mins < 60) return `${mins}m`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.round(hours / 24)}d`;
}

/** Accepts "acme.com", "www.acme.com", "https://acme.com/pricing" — returns the bare host. */
export function normalizeDomain(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/.*$/, "");
}

export function isValidDomain(input: string) {
  const host = normalizeDomain(input);
  return /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(host) && host.length <= 253;
}

export function titleCase(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
