import type { AuditFinding, AuditRun } from "../types.js";
import type { FindingDiff } from "./diff.js";

const SEVERITY_ICON: Record<AuditFinding["severity"], string> = {
  critical: "🔴",
  warning: "🟡",
  notice: "⚪",
};

/**
 * The change-over-time view Beacon's continuous re-audit is for: what's new
 * since the last run, what got fixed, what's still open — instead of
 * repeating the whole report every time (Phase B2, BEACON_ARCHITECTURE.md §7).
 */
export function renderDiffMarkdown(diff: FindingDiff, currentRun: AuditRun, previousRun: AuditRun): string {
  const lines: string[] = [];
  lines.push(`# What changed — ${currentRun.url}`);
  lines.push("");
  lines.push(
    `Comparing run ${currentRun.id} (${new Date(currentRun.createdAt).toLocaleString()}) against ${previousRun.id} (${new Date(previousRun.createdAt).toLocaleString()}).`,
  );
  lines.push("");

  const scoreDelta = (currentRun.score ?? 0) - (previousRun.score ?? 0);
  const scoreArrow = scoreDelta > 0 ? "↑" : scoreDelta < 0 ? "↓" : "→";
  lines.push(`**Score: ${previousRun.score ?? "n/a"} ${scoreArrow} ${currentRun.score ?? "n/a"}**`);
  lines.push("");
  lines.push(`${diff.added.length} new · ${diff.resolved.length} resolved · ${diff.persisting.length} still open`);
  lines.push("");

  if (diff.resolved.length) {
    lines.push("## Resolved since last time");
    lines.push("");
    for (const f of diff.resolved) lines.push(renderLine(f));
    lines.push("");
  }

  if (diff.added.length) {
    lines.push("## New since last time");
    lines.push("");
    for (const f of diff.added) lines.push(renderLine(f));
    lines.push("");
  }

  if (diff.persisting.length) {
    lines.push("## Still open");
    lines.push("");
    for (const f of diff.persisting) lines.push(renderLine(f));
    lines.push("");
  }

  if (!diff.added.length && !diff.resolved.length && !diff.persisting.length) {
    lines.push("No findings in either run.");
    lines.push("");
  }

  return lines.join("\n");
}

function renderLine(f: AuditFinding): string {
  const url = f.evidence[0]?.url ?? "";
  return `- ${SEVERITY_ICON[f.severity]} **${f.title}** — ${url}`;
}
