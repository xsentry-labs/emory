/**
 * Plans and their monthly allowances. This is the single source of truth: the
 * pricing page, the in-app usage meter and the enforcement all read it.
 * Prices are proposals; change them here.
 */
export type PlanId = "free" | "starter" | "growth" | "scale";

export type QuotaKind = "leads" | "seo" | "ai";

export interface PlanDef {
  id: PlanId;
  name: string;
  /** USD per month, or null for "talk to us". */
  price: number | null;
  tagline: string;
  limits: Record<QuotaKind, number>;
  features: string[];
  highlight?: boolean;
  cta: string;
}

export const QUOTA_LABEL: Record<QuotaKind, string> = {
  leads: "Leads found",
  seo: "SEO audits",
  ai: "AI drafts & content",
};

const NOUN: Record<QuotaKind, [string, string]> = {
  leads: ["lead", "leads"],
  seo: ["SEO audit", "SEO audits"],
  ai: ["AI draft or content piece", "AI drafts and content pieces"],
};

/** "1 SEO audit", "25 leads": for sentences, unlike the capitalised meter labels. */
export const quotaPhrase = (kind: QuotaKind, n: number) => `${n.toLocaleString("en-US")} ${NOUN[kind][n === 1 ? 0 : 1]}`;

export const PLAN_LIST: PlanDef[] = [
  {
    id: "free",
    name: "Free",
    price: 0,
    tagline: "See what Emory finds for your business.",
    limits: { leads: 25, seo: 1, ai: 10 },
    features: ["25 leads a month, each with a reason and source", "Outreach drafted for every lead", "1 SEO audit with a fix plan", "10 AI drafts and content pieces", "You approve every message"],
    cta: "Start free",
  },
  {
    id: "starter",
    name: "Starter",
    price: 49,
    tagline: "For founders running their first outbound.",
    limits: { leads: 250, seo: 4, ai: 100 },
    features: ["250 leads a month", "All signal-based plays", "4 SEO audits a month", "100 AI drafts and content pieces", "Blog posts and X post drafts"],
    cta: "Get Starter",
  },
  {
    id: "growth",
    name: "Growth",
    price: 149,
    tagline: "For teams who want a steady pipeline.",
    limits: { leads: 1000, seo: 20, ai: 400 },
    features: ["1,000 leads a month", "All signal-based plays", "20 SEO audits a month", "400 AI drafts and content pieces", "Priority support"],
    highlight: true,
    cta: "Get Growth",
  },
  {
    id: "scale",
    name: "Scale",
    price: null,
    tagline: "Higher volume, more seats, custom needs.",
    limits: { leads: 5000, seo: 100, ai: 2000 },
    features: ["Custom lead volume", "Multiple workspaces and seats", "Onboarding help", "Security review and invoicing"],
    cta: "Talk to us",
  },
];

export const planById = (id: string): PlanDef | undefined => PLAN_LIST.find((p) => p.id === id);

export const isPlanId = (id: string): id is PlanId => PLAN_LIST.some((p) => p.id === id);

/** The plan new workspaces start on. Set DEFAULT_PLAN=growth to run a pilot without limits getting in the way. */
export function defaultPlan(env: Record<string, string | undefined> = process.env): PlanId {
  const p = env.DEFAULT_PLAN?.trim().toLowerCase() ?? "";
  return isPlanId(p) ? p : "free";
}

export const formatPrice = (p: PlanDef) => (p.price === null ? "Custom" : p.price === 0 ? "$0" : `$${p.price}`);
