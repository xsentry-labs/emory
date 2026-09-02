import type { AuditFinding, AuditRun, Priority, Suggestion } from "../types.js";

const SEVERITY_WEIGHT: Record<AuditFinding["severity"], number> = { critical: 12, warning: 5, notice: 1 };

/** 0-100. Starts at 100 and is docked per finding by severity, floored at 0. */
export function computeScore(findings: AuditFinding[]): number {
  const penalty = findings.reduce((sum, f) => sum + SEVERITY_WEIGHT[f.severity], 0);
  return Math.max(0, Math.min(100, Math.round(100 - penalty)));
}

const PRIORITY_LABEL: Record<Priority, string> = {
  P0: "P0 — Critical, fix first",
  P1: "P1 — High priority",
  P2: "P2 — Moderate priority",
  P3: "P3 — Low priority / nice to have",
};

export function renderMarkdown(run: AuditRun): string {
  const lines: string[] = [];
  lines.push(`# SEO + GEO/AEO Audit — ${run.url}`);
  lines.push("");
  lines.push(`Run ${run.id} · ${new Date(run.createdAt).toLocaleString()}`);
  lines.push("");
  lines.push(`**Score: ${run.score ?? "n/a"}/100**`);
  if (run.crawlSummary) {
    lines.push(`Crawled ${run.crawlSummary.pagesRead} pages via ${run.crawlSummary.crawler}${run.crawlSummary.truncated ? " (sample truncated — site is larger than the crawl limit)" : ""}.`);
  }
  lines.push("");

  if (run.warnings.length) {
    lines.push("> **This run is incomplete.** Some agents could not finish, so results below may be partial:");
    for (const w of run.warnings) lines.push(`> - ${w}`);
    lines.push("");
  }

  const byPriority = new Map<Priority, Suggestion[]>();
  for (const s of run.suggestions) {
    const list = byPriority.get(s.priority) ?? [];
    list.push(s);
    byPriority.set(s.priority, list);
  }

  for (const priority of ["P0", "P1", "P2", "P3"] as Priority[]) {
    const items = byPriority.get(priority);
    if (!items?.length) continue;
    lines.push(`## ${PRIORITY_LABEL[priority]}`);
    lines.push("");
    for (const s of items) {
      lines.push(`### ${s.title}`);
      lines.push("");
      lines.push(`**Status:** ${s.status}`);
      lines.push("");
      lines.push(`**Why:** ${s.why}`);
      lines.push("");
      lines.push("**Evidence:**");
      for (const e of s.evidence.slice(0, 8)) {
        lines.push(`- ${e.url} — \`${truncate(e.currentValue, 160)}\``);
      }
      lines.push("");
      lines.push(`**Recommended change:** ${s.edits?.recommendedChange ?? s.recommendedChange}`);
      if (s.codeGuidance) {
        lines.push("");
        lines.push("```");
        lines.push(s.codeGuidance);
        lines.push("```");
      }
      lines.push("");
      lines.push(`**Expected impact:** ${s.expectedImpact}  ·  **Effort:** ${s.estimatedEffort}`);
      if (s.edits?.note) {
        lines.push("");
        lines.push(`**Reviewer note:** ${s.edits.note}`);
      }
      lines.push("");
    }
  }

  lines.push("---");
  lines.push(`Model usage: ${run.modelCalls.length} calls, ~$${run.costUsd.toFixed(4)} estimated.`);

  return lines.join("\n");
}

function truncate(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n)}…` : s;
}
