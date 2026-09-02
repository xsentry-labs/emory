import type { AuditFinding } from "../types.js";

export interface FindingDiff {
  added: AuditFinding[];
  resolved: AuditFinding[];
  persisting: AuditFinding[];
}

/**
 * Compares two audits of the same site so a scheduled re-audit can report
 * *change* ("3 new pages missing descriptions since last week") instead of
 * repeating the whole report every run. Findings are matched by
 * (agent, category, first evidence URL) rather than by id — ids are
 * regenerated every run, so an identity match would call every unchanged
 * finding "new."
 */
export function diffFindings(previous: AuditFinding[], current: AuditFinding[]): FindingDiff {
  const previousByKey = new Map(previous.map((f) => [findingKey(f), f]));
  const currentByKey = new Map(current.map((f) => [findingKey(f), f]));

  const added = current.filter((f) => !previousByKey.has(findingKey(f)));
  const resolved = previous.filter((f) => !currentByKey.has(findingKey(f)));
  const persisting = current.filter((f) => previousByKey.has(findingKey(f)));

  return { added, resolved, persisting };
}

function findingKey(finding: AuditFinding): string {
  // Deliberately coarse: (agent, category, primary URL) only, not the title.
  // Deterministic findings (technical.ts) have stable titles for stable
  // input, but LLM-generated ones (onpage/geo-aeo/eeat/ai-visibility) can
  // rephrase the same underlying issue slightly differently run to run —
  // matching on title would misclassify those as resolved+added instead of
  // persisting. The tradeoff is coarser matching: two genuinely different
  // findings from the same agent on the same URL collapse into one key.
  const primaryUrl = finding.evidence[0]?.url ?? "";
  return `${finding.agent}::${finding.category}::${primaryUrl}`;
}
