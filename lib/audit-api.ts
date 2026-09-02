/**
 * Client for the real audit backend in backend/ (see backend/README.md).
 * Runs entirely from the browser — the backend takes a while (real crawl +
 * LLM calls), so this deliberately avoids a Next.js API route/serverless
 * function in between, which would be subject to a much shorter timeout.
 */

export const API_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8787").replace(/\/$/, "");

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
  status: RunStatus;
  createdAt: string;
  updatedAt: string;
  crawlSummary?: { pagesRead: number; crawler: string; truncated: boolean };
  findings: AuditFinding[];
  suggestions: Suggestion[];
  score?: number;
  reportMarkdown?: string;
  costUsd: number;
  warnings: string[];
  error?: string;
  prUrl?: string;
  patchDir?: string;
}

export class AuditApiError extends Error {
  constructor(
    message: string,
    public status?: number,
  ) {
    super(message);
    this.name = "AuditApiError";
  }
}

async function asJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new AuditApiError(
      (body && typeof body === "object" && "error" in body ? String((body as { error: unknown }).error) : null) ??
        `Request failed (${res.status})`,
      res.status,
    );
  }
  return res.json() as Promise<T>;
}

export async function startAudit(input: {
  url: string;
  constraints?: string | null;
  docs?: { name: string; text: string }[];
}): Promise<AuditRun> {
  const res = await fetch(`${API_BASE}/audits`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  }).catch(() => {
    throw new AuditApiError(
      `Could not reach the audit backend at ${API_BASE}. Is it running and is NEXT_PUBLIC_API_BASE_URL set correctly?`,
    );
  });
  return asJson<AuditRun>(res);
}

export async function getRun(id: string): Promise<AuditRun> {
  const res = await fetch(`${API_BASE}/audits/${id}`);
  return asJson<AuditRun>(res);
}

export async function decideSuggestion(
  runId: string,
  suggestionId: string,
  decision: "approve" | "reject",
): Promise<Suggestion> {
  const res = await fetch(`${API_BASE}/approvals/${runId}/suggestions/${suggestionId}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ decision }),
  });
  return asJson<Suggestion>(res);
}

export async function applyRun(
  runId: string,
  options?: { owner?: string; repo?: string; baseBranch?: string },
): Promise<AuditRun> {
  const res = await fetch(`${API_BASE}/audits/${runId}/apply`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(options ?? {}),
  });
  return asJson<AuditRun>(res);
}
