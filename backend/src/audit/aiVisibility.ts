import type { AuditFinding, ModelCallLog } from "../types.js";
import type { DocStore } from "../rag/docStore.js";
import { complete, completeJson } from "../llm/openrouter.js";
import { newId } from "../util/id.js";
import { hasNonEmptyStrings } from "../util/validateLlm.js";

export interface AiVisibilityInput {
  brand: string;
  siteUrl: string;
  /** What to ask each model — seeded from onboarding/company docs, editable per workspace in a later phase. */
  prompts: string[];
  /** OpenRouter model ids to check. Mixing families is the point here, not a cost decision — see BEACON_ARCHITECTURE.md §3.2. */
  models: string[];
}

export interface AiVisibilityCheck {
  prompt: string;
  model: string;
  response: string;
  brandMentioned: boolean;
}

const ANSWER_SYSTEM =
  "You are a helpful assistant answering a user's question naturally, the way you normally would. Do not mention that this is a test or that you are being evaluated.";

interface AccuracyFinding {
  claimQuoted: string;
  currentValue: string;
  severity: "critical" | "warning" | "notice";
  detail: string;
  recommendedChange: string;
  expectedImpact: string;
  estimatedEffort: "low" | "medium" | "high";
}

const ACCURACY_SYSTEM = `You check whether AI assistant answers about a company are factually \
consistent with that company's own documents. You are given several assistant answers that \
mention the brand, and excerpts from the company's own docs as ground truth.

Only flag a claim you can directly contradict using the provided excerpts (wrong price, wrong \
feature, wrong positioning) — silence or a generic mention is not a contradiction. If nothing in \
the answers contradicts the excerpts, return an empty array.

Reply with ONLY JSON: {"findings": AccuracyFinding[]}, where each item has claimQuoted (the exact \
wrong claim, quoted from an answer), currentValue (what the assistant said, briefly), severity \
("critical"|"warning"|"notice"), detail, recommendedChange, expectedImpact, estimatedEffort \
("low"|"medium"|"high").`;

/**
 * Checks whether AI assistants recommend/mention the brand at all (a
 * deterministic substring check — falsifiable by construction, no LLM
 * judgment needed for "is the brand name in this text") and, where they do
 * mention it, whether what they say is accurate against the company's own
 * docs (an LLM judgment call, mirroring eeat.ts's doc-grounding pattern).
 */
export async function runAiVisibilityAudit(
  input: AiVisibilityInput,
  docStore: DocStore | null,
  onUsage: (log: ModelCallLog) => void,
  ceilingExceeded: () => boolean,
  onWarning: (msg: string) => void,
): Promise<AuditFinding[]> {
  if (!input.prompts.length || !input.models.length) return [];

  const checks: AiVisibilityCheck[] = [];
  for (const prompt of input.prompts) {
    for (const model of input.models) {
      if (ceilingExceeded()) break;
      try {
        const response = await complete({
          agent: "ai-visibility",
          tier: "mid",
          model,
          system: ANSWER_SYSTEM,
          user: prompt,
          maxTokens: 400,
          onUsage,
        });
        checks.push({
          prompt,
          model,
          response,
          brandMentioned: mentionsBrand(response, input.brand),
        });
      } catch (err) {
        onWarning(`AI visibility: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }

  const findings: AuditFinding[] = [];
  findings.push(...mentionFindings(input, checks));

  const mentioning = checks.filter((c) => c.brandMentioned);
  if (mentioning.length && docStore && !ceilingExceeded()) {
    findings.push(...(await accuracyFindings(input, mentioning, docStore, onUsage, onWarning)));
  }

  return findings;
}

function mentionsBrand(response: string, brand: string): boolean {
  return response.toLowerCase().includes(brand.toLowerCase());
}

function mentionFindings(input: AiVisibilityInput, checks: AiVisibilityCheck[]): AuditFinding[] {
  const findings: AuditFinding[] = [];
  const byPrompt = new Map<string, AiVisibilityCheck[]>();
  for (const check of checks) {
    const list = byPrompt.get(check.prompt) ?? [];
    list.push(check);
    byPrompt.set(check.prompt, list);
  }

  for (const [prompt, promptChecks] of byPrompt) {
    const mentioned = promptChecks.filter((c) => c.brandMentioned);
    if (mentioned.length === promptChecks.length) continue; // every model mentioned it — nothing to flag

    const missed = promptChecks.filter((c) => !c.brandMentioned);
    findings.push({
      id: newId("f"),
      agent: "ai-visibility",
      title: `${input.brand} was not mentioned by ${missed.length} of ${promptChecks.length} AI assistants asked "${truncate(prompt, 60)}"`,
      detail: `Asked "${prompt}" to ${promptChecks.map((c) => c.model).join(", ")}. ${mentioned.length} of ${promptChecks.length} mentioned ${input.brand}.`,
      evidence: missed.map((c) => ({
        url: input.siteUrl,
        currentValue: `${c.model}: "${truncate(c.response, 200)}"`,
      })),
      severity: mentioned.length === 0 ? "critical" : "warning",
      recommendedChange:
        "Publish content that directly answers this question (a comparison or FAQ page) so assistants have something citable to draw from — see the GEO/AEO findings for content shape guidance.",
      expectedImpact: "Improves the odds of being named when buyers ask an AI assistant this question.",
      estimatedEffort: "medium",
      category: "ai-visibility",
    });
  }

  return findings;
}

async function accuracyFindings(
  input: AiVisibilityInput,
  mentioning: AiVisibilityCheck[],
  docStore: DocStore,
  onUsage: (log: ModelCallLog) => void,
  onWarning: (msg: string) => void,
): Promise<AuditFinding[]> {
  try {
    const docContext = await docStore.search(input.prompts.join(" "), 6);
    if (!docContext.length) return [];

    const user = `Company: ${input.brand}

Company doc excerpts (ground truth):
${docContext.map((c) => `[${c.docName}] ${c.text}`).join("\n---\n")}

Assistant answers that mentioned ${input.brand}:
${mentioning.map((c) => `[${c.model}] Q: ${c.prompt}\nA: ${c.response}`).join("\n---\n")}`;

    const parsed = await completeJson<{ findings: AccuracyFinding[] }>({
      agent: "ai-visibility-accuracy",
      tier: "mid",
      system: ACCURACY_SYSTEM,
      user,
      maxTokens: 1500,
      onUsage,
    });

    return (parsed.findings ?? [])
      .filter((f) => hasNonEmptyStrings(f, ["claimQuoted", "currentValue", "detail", "recommendedChange", "expectedImpact"]))
      .map((f) => ({
        id: newId("f"),
        agent: "ai-visibility" as const,
        title: `An AI assistant misstates: "${truncate(f.claimQuoted, 80)}"`,
        detail: f.detail,
        evidence: [{ url: input.siteUrl, currentValue: f.currentValue }],
        severity: f.severity,
        recommendedChange: f.recommendedChange,
        expectedImpact: f.expectedImpact,
        estimatedEffort: f.estimatedEffort ?? "medium",
        category: "ai-visibility",
      }));
  } catch (err) {
    onWarning(`AI visibility accuracy check: ${err instanceof Error ? err.message : String(err)}`);
    return [];
  }
}

function truncate(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n)}…` : s;
}
