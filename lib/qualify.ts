/**
 * Lead qualification: ICP fit plus BANT (Budget, Authority, Need, Timing).
 * Each dimension is rated 0-3 and combined into a 0-100 score. Need and ICP
 * fit weigh most because a lead that has no problem we solve, or is outside
 * who we serve, is not worth chasing however much budget it has.
 */
export interface Qualification {
  icpFit: number;
  budget: number;
  authority: number;
  need: number;
  timing: number;
}

export const WEIGHTS = { icpFit: 30, need: 25, budget: 15, authority: 15, timing: 15 } as const;

export type Tier = "A" | "B" | "C";

export function scoreLead(q: Qualification): { score: number; tier: Tier } {
  let total = 0;
  for (const key of Object.keys(WEIGHTS) as (keyof typeof WEIGHTS)[]) {
    const v = Math.min(3, Math.max(0, q[key]));
    total += (v / 3) * WEIGHTS[key];
  }
  const score = Math.round(total);
  return { score, tier: tierFor(score) };
}

export function tierFor(score: number): Tier {
  return score >= 70 ? "A" : score >= 40 ? "B" : "C";
}

export const RATING_LABELS = ["Unknown / none", "Weak", "Moderate", "Strong"] as const;
