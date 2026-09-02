import type { AuditFinding, ModelCallLog, Priority, Suggestion } from "../types.js";
import { completeJson } from "../llm/openrouter.js";
import { newId } from "../util/id.js";

const FINDINGS_PER_CHUNK = 25;

interface LlmSuggestion {
  findingIds: string[];
  priority: Priority;
  title: string;
  why: string;
  recommendedChange: string;
  codeGuidance?: string;
  expectedImpact: string;
  estimatedEffort: "low" | "medium" | "high";
  falsifiable: boolean;
}

const SYSTEM = `You are the suggestion synthesizer for an SEO/GEO audit system. You are \
given a batch of raw findings (already evidence-backed: each has a URL and an \
observed current value) from specialist audit agents. Merge findings that describe \
the same underlying fix into one suggestion (e.g. "14 pages missing titles" and a \
related meta-description finding on the same pages can become one "fix missing \
title/description tags" suggestion if genuinely the same fix).

Prioritize P0 (critical, high-impact, do first) through P3 (low priority, nice to \
have) using this rubric:
- P0: severity critical AND low/medium effort, or blocks indexation/crawlability entirely.
- P1: severity critical with high effort, or severity warning with high site-wide impact (many pages/high traffic).
- P2: severity warning, moderate scope.
- P3: severity notice, or narrow/cosmetic scope.

A suggestion is "falsifiable" only if it cites specific evidence (a URL and an exact \
current value) that someone could go check right now. If a finding is vague, drop it \
rather than passing it through.

Reply with ONLY JSON: {"suggestions": LlmSuggestion[]}, where each item has \
findingIds (array of the input finding ids it merges), priority, title, why \
(business-language rationale referencing the evidence), recommendedChange, \
codeGuidance (optional, carry over from the source finding if present), \
expectedImpact, estimatedEffort, falsifiable.`;

export async function synthesize(
  findings: AuditFinding[],
  constraints: string | null,
  onUsage: (log: ModelCallLog) => void,
): Promise<Suggestion[]> {
  if (!findings.length) return [];

  const byId = new Map(findings.map((f) => [f.id, f]));
  const chunks = chunk(findings, FINDINGS_PER_CHUNK);
  const rawSuggestions: LlmSuggestion[] = [];

  for (const c of chunks) {
    const user = buildUserPrompt(c, constraints);
    try {
      const parsed = await completeJson<{ suggestions: LlmSuggestion[] }>({
        agent: "synthesizer",
        tier: "strong",
        system: SYSTEM,
        user,
        maxTokens: 3000,
        onUsage,
      });
      rawSuggestions.push(...(parsed.suggestions ?? []));
    } catch {
      continue;
    }
  }

  let finalList = rawSuggestions;
  if (chunks.length > 1 && rawSuggestions.length > 1) {
    finalList = await consolidate(rawSuggestions, constraints, onUsage);
  }

  const suggestions: Suggestion[] = [];
  for (const s of finalList) {
    const evidence = (s.findingIds ?? [])
      .map((id) => byId.get(id))
      .filter((f): f is AuditFinding => Boolean(f))
      .flatMap((f) => f.evidence);
    if (!s.falsifiable || evidence.length === 0) continue;

    suggestions.push({
      id: newId("s"),
      findingIds: s.findingIds ?? [],
      priority: s.priority ?? "P3",
      title: s.title,
      why: s.why,
      evidence,
      recommendedChange: s.recommendedChange,
      codeGuidance: s.codeGuidance,
      expectedImpact: s.expectedImpact,
      estimatedEffort: s.estimatedEffort ?? "medium",
      falsifiable: true,
      status: "pending",
    });
  }

  const order: Record<Priority, number> = { P0: 0, P1: 1, P2: 2, P3: 3 };
  suggestions.sort((a, b) => order[a.priority] - order[b.priority]);
  return suggestions;
}

async function consolidate(
  suggestions: LlmSuggestion[],
  constraints: string | null,
  onUsage: (log: ModelCallLog) => void,
): Promise<LlmSuggestion[]> {
  const user = `${constraints ? `Focus constraint from the user: ${constraints}\n\n` : ""}Here are suggestions gathered from multiple batches of findings. Merge any that \
are genuinely duplicates (same fix, same or overlapping URLs), re-rank priorities \
consistently across the whole set using the same rubric, and drop anything not \
falsifiable. Return the same JSON shape.\n\n${JSON.stringify(suggestions, null, 2)}`;

  try {
    const parsed = await completeJson<{ suggestions: LlmSuggestion[] }>({
      agent: "synthesizer-consolidate",
      tier: "strong",
      system: SYSTEM,
      user,
      maxTokens: 4000,
      onUsage,
    });
    return parsed.suggestions?.length ? parsed.suggestions : suggestions;
  } catch {
    return suggestions;
  }
}

function buildUserPrompt(findings: AuditFinding[], constraints: string | null): string {
  const constraintLine = constraints ? `Focus constraint from the user: ${constraints}\n\n` : "";
  const body = findings
    .map(
      (f) => `id: ${f.id}
agent: ${f.agent}
severity: ${f.severity}
title: ${f.title}
detail: ${f.detail}
evidence: ${f.evidence.map((e) => `${e.url} :: ${e.currentValue}`).join(" | ")}
recommendedChange: ${f.recommendedChange}
codeGuidance: ${f.codeGuidance ?? "(none)"}
estimatedEffort: ${f.estimatedEffort}`,
    )
    .join("\n---\n");
  return `${constraintLine}Findings:\n\n${body}`;
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}
