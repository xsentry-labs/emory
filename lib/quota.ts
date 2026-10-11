import type { DB } from "./db";
import { getKv, setKv } from "./inbound";
import { PLAN_LIST, QUOTA_LABEL, defaultPlan, isPlanId, planById, quotaPhrase, type PlanDef, type PlanId, type QuotaKind } from "./pricing";

/**
 * Monthly plan allowances, stored per workspace (in its own database). The
 * daily caps in usage.ts remain as an abuse/cost guard on top of these.
 */
const monthKey = (kind: QuotaKind, at: number) => `quota:${new Date(at).toISOString().slice(0, 7)}:${kind}`;

export function planOf(db: DB): PlanDef {
  const stored = getKv(db, "plan");
  return planById(stored && isPlanId(stored) ? stored : defaultPlan()) ?? PLAN_LIST[0];
}

export function setPlan(db: DB, plan: PlanId): void {
  setKv(db, "plan", plan);
}

export function usedThisMonth(db: DB, kind: QuotaKind, at = Date.now()): number {
  return Number(getKv(db, monthKey(kind, at)) ?? 0);
}

export function remaining(db: DB, kind: QuotaKind, at = Date.now()): number {
  return Math.max(0, planOf(db).limits[kind] - usedThisMonth(db, kind, at));
}

export class QuotaError extends Error {}

/**
 * How many of `wanted` the plan still allows. Throws a user-readable error when
 * nothing is left, pointing at the upgrade path.
 */
export function allowance(db: DB, kind: QuotaKind, wanted = 1, at = Date.now()): number {
  const left = remaining(db, kind, at);
  if (left <= 0) {
    const plan = planOf(db);
    throw new QuotaError(
      `You've used all ${quotaPhrase(kind, plan.limits[kind])} included in the ${plan.name} plan this month. See the pricing page to upgrade.`,
    );
  }
  return Math.min(wanted, left);
}

export function recordUsage(db: DB, kind: QuotaKind, amount = 1, at = Date.now()): void {
  if (amount <= 0) return;
  setKv(db, monthKey(kind, at), String(usedThisMonth(db, kind, at) + amount));
}

/** Check there is room, then count it. For actions whose cost is known up front. */
export function charge(db: DB, kind: QuotaKind, amount = 1, at = Date.now()): void {
  allowance(db, kind, amount, at);
  recordUsage(db, kind, amount, at);
}

export function quotaSummary(db: DB, at = Date.now()) {
  const plan = planOf(db);
  return {
    plan: { id: plan.id, name: plan.name },
    items: (Object.keys(QUOTA_LABEL) as QuotaKind[]).map((kind) => ({
      kind,
      label: QUOTA_LABEL[kind],
      used: usedThisMonth(db, kind, at),
      limit: plan.limits[kind],
    })),
  };
}
