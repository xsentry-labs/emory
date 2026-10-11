import type { DB } from "./db";
import { getKv, setKv } from "./inbound";

/**
 * Per-workspace daily caps on model-spending actions, so one user (or a bug)
 * can't burn the whole OpenRouter budget. Counters live in the workspace's own
 * database and reset each UTC day.
 */
export type UsageKind = "hunt" | "onboarding" | "ai" | "seo";

const DEFAULTS: Record<UsageKind, number> = { hunt: 3, onboarding: 5, ai: 40, seo: 3 };
const ENV: Record<UsageKind, string> = { hunt: "LIMIT_HUNTS_PER_DAY", onboarding: "LIMIT_ONBOARDING_PER_DAY", ai: "LIMIT_AI_ACTIONS_PER_DAY", seo: "LIMIT_SEO_AUDITS_PER_DAY" };
const LABEL: Record<UsageKind, string> = { hunt: "lead hunts", onboarding: "business setups", ai: "AI actions", seo: "SEO audits" };

export const dailyLimit = (kind: UsageKind, env: Record<string, string | undefined> = process.env): number => {
  const n = Number(env[ENV[kind]]);
  return Number.isInteger(n) && n > 0 ? n : DEFAULTS[kind];
};

const dayKey = (kind: UsageKind, at: number) => `usage:${new Date(at).toISOString().slice(0, 10)}:${kind}`;

export function usedToday(db: DB, kind: UsageKind, at = Date.now()): number {
  return Number(getKv(db, dayKey(kind, at)) ?? 0);
}

/** Count one use; throws a user-readable error once today's cap is reached. */
export function consume(db: DB, kind: UsageKind, at = Date.now(), limit = dailyLimit(kind)): void {
  const used = usedToday(db, kind, at);
  if (used >= limit) {
    throw new Error(`Daily limit reached (${limit} ${LABEL[kind]} per day). It resets at midnight UTC.`);
  }
  setKv(db, dayKey(kind, at), String(used + 1));
}

export function usageSummary(db: DB, at = Date.now()) {
  return (Object.keys(DEFAULTS) as UsageKind[]).map((kind) => ({
    kind,
    label: LABEL[kind],
    used: usedToday(db, kind, at),
    limit: dailyLimit(kind),
  }));
}
