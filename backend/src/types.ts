export type ModelTier = "cheap" | "mid" | "strong";

export interface CrawledPage {
  url: string;
  statusCode: number;
  title: string | null;
  metaDescription: string | null;
  h1: string[];
  h2: string[];
  canonical: string | null;
  robotsMeta: string | null;
  wordCount: number;
  textSample: string;
  html: string | null;
  links: { href: string; text: string; rel: string | null }[];
  images: { src: string; alt: string | null }[];
  jsonLd: unknown[];
  headers: Record<string, string>;
  fetchedAt: string;
}

export interface CrawlResult {
  rootUrl: string;
  pages: CrawledPage[];
  robotsTxt: { found: boolean; content: string | null; disallowsRoot: boolean };
  sitemap: { found: boolean; urlCount: number; urls: string[] };
  llmsTxt: { found: boolean; content: string | null };
  truncated: boolean;
  crawler: "firecrawl" | "fallback";
}

export type Severity = "critical" | "warning" | "notice";
export type Priority = "P0" | "P1" | "P2" | "P3";

export interface Evidence {
  url: string;
  currentValue: string;
}

export interface AuditFinding {
  id: string;
  agent: "technical" | "onpage" | "geo-aeo" | "performance" | "eeat";
  title: string;
  detail: string;
  evidence: Evidence[];
  severity: Severity;
  recommendedChange: string;
  codeGuidance?: string;
  expectedImpact: string;
  estimatedEffort: "low" | "medium" | "high";
  category: string;
}

export interface Suggestion {
  id: string;
  findingIds: string[];
  priority: Priority;
  title: string;
  why: string;
  evidence: Evidence[];
  recommendedChange: string;
  codeGuidance?: string;
  expectedImpact: string;
  estimatedEffort: "low" | "medium" | "high";
  falsifiable: boolean;
  status: "pending" | "approved" | "rejected" | "applied";
  edits?: { recommendedChange?: string; note?: string };
  decidedAt?: string;
  appliedAt?: string;
}

export interface ModelCallLog {
  agent: string;
  tier: ModelTier;
  model: string;
  promptTokens: number;
  completionTokens: number;
  estUsd: number;
  at: string;
}

export type RunStatus =
  | "collecting"
  | "auditing"
  | "synthesizing"
  | "awaiting_approval"
  | "applying"
  | "applied"
  | "failed";

export interface AuditRun {
  id: string;
  url: string;
  constraints: string | null;
  docs: { name: string; chars: number }[];
  status: RunStatus;
  createdAt: string;
  updatedAt: string;
  crawlSummary?: { pagesRead: number; crawler: string; truncated: boolean };
  findings: AuditFinding[];
  suggestions: Suggestion[];
  score?: number;
  reportMarkdown?: string;
  modelCalls: ModelCallLog[];
  costUsd: number;
  /** Non-fatal problems (a batch call failed, OPENROUTER_API_KEY missing, etc.) that make the results incomplete without failing the whole run. */
  warnings: string[];
  error?: string;
  prUrl?: string;
  patchDir?: string;
}
