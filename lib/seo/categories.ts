import { scoreSite, type Issue } from "./checks";

/** How the report groups issues, and what kind of change fixes each one. */
export const CATEGORIES = ["technical", "content", "mobile speed", "structured data"] as const;
export type Category = (typeof CATEGORIES)[number];
export type FixType = "code fix" | "content" | "redirects" | "server";

const META: Record<string, { category: Category; fix: FixType }> = {
  "not-https": { category: "technical", fix: "server" },
  "robots-blocks": { category: "technical", fix: "code fix" },
  "robots-missing": { category: "technical", fix: "code fix" },
  "sitemap-missing": { category: "technical", fix: "code fix" },
  broken: { category: "technical", fix: "redirects" },
  noindex: { category: "technical", fix: "code fix" },
  "no-canonical": { category: "technical", fix: "code fix" },
  "no-lang": { category: "technical", fix: "code fix" },
  "no-title": { category: "content", fix: "code fix" },
  "no-description": { category: "content", fix: "content" },
  "no-h1": { category: "content", fix: "content" },
  "dup-title": { category: "content", fix: "content" },
  "dup-description": { category: "content", fix: "content" },
  "title-long": { category: "content", fix: "content" },
  "title-short": { category: "content", fix: "content" },
  "description-long": { category: "content", fix: "content" },
  "description-short": { category: "content", fix: "content" },
  thin: { category: "content", fix: "content" },
  "multi-h1": { category: "content", fix: "code fix" },
  "img-alt": { category: "content", fix: "content" },
  "no-viewport": { category: "mobile speed", fix: "code fix" },
  slow: { category: "mobile speed", fix: "server" },
  "no-schema": { category: "structured data", fix: "code fix" },
  "no-og": { category: "structured data", fix: "code fix" },
};

export const issueCategory = (i: Pick<Issue, "id">): Category => META[i.id]?.category ?? "technical";
export const issueFix = (i: Pick<Issue, "id">): FixType => META[i.id]?.fix ?? "code fix";

/** 0-100 per category, scored like the overall site score but only over that category's issues. */
export function categoryScores(issues: Issue[], pageCount: number): Record<Category, number> {
  const out = {} as Record<Category, number>;
  for (const c of CATEGORIES) out[c] = scoreSite(issues.filter((i) => issueCategory(i) === c), pageCount);
  return out;
}

const RANK = { high: 0, medium: 1, low: 2 } as const;

/** Most damaging first: severity, then how many pages it touches. */
export const rankIssues = (issues: Issue[]): Issue[] =>
  [...issues].sort((a, b) => RANK[a.severity] - RANK[b.severity] || b.count - a.count);
