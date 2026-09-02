import type { AuditFinding, CrawlResult, ModelCallLog } from "../types.js";
import type { DocStore } from "../rag/docStore.js";
import { completeJson } from "../llm/openrouter.js";
import { newId } from "../util/id.js";
import { hasNonEmptyStrings } from "../util/validateLlm.js";

const MAX_PAGES_SAMPLED = 8;

interface LlmFinding {
  url: string;
  title: string;
  detail: string;
  currentValue: string;
  severity: "critical" | "warning" | "notice";
  recommendedChange: string;
  expectedImpact: string;
  estimatedEffort: "low" | "medium" | "high";
}

const SYSTEM = `You are an E-E-A-T (Experience, Expertise, Authoritativeness, \
Trust) and brand-voice reviewer. You are given page content and, when \
available, excerpts from the company's own brand/product documents as ground \
truth. Judge whether the page:
- Demonstrates real expertise/experience (specifics, evidence, named people or \
  credentials) rather than generic claims.
- Contradicts or drifts from the brand doc excerpts (wrong price, wrong \
  positioning, wrong claim, off-voice language) — only flag a contradiction you \
  can point to directly in the excerpts.
- Is missing trust signals a page like this would be expected to have (author, \
  date, contact/about info, evidence for a claim it makes).

Rules:
- Every finding MUST cite the exact "currentValue" text you observed on the page.
- If no brand docs were provided, skip the contradiction check and only judge \
  generic E-E-A-T signals.
- Do not invent facts about the company that aren't in the page or the doc \
  excerpts.
- Reply with ONLY JSON: {"findings": LlmFinding[]}.`;

export async function runEeatAudit(
  crawl: CrawlResult,
  docStore: DocStore | null,
  onUsage: (log: ModelCallLog) => void,
  ceilingExceeded: () => boolean,
  onWarning: (msg: string) => void,
): Promise<AuditFinding[]> {
  const sample = crawl.pages.filter((p) => p.statusCode < 400 && p.wordCount > 80).slice(0, MAX_PAGES_SAMPLED);
  const findings: AuditFinding[] = [];

  for (const page of sample) {
    if (ceilingExceeded()) break;

    let docContext = "No company documents were provided.";
    if (docStore) {
      try {
        const matches = await docStore.search(`${page.title ?? ""} ${page.textSample.slice(0, 500)}`, 4);
        if (matches.length) {
          docContext = matches.map((m) => `[${m.docName}] ${m.text}`).join("\n---\n");
        }
      } catch (err) {
        // Deliberately no page URL in this message: the same root cause fails
        // identically for every page, and the pipeline dedupes warnings by
        // exact text — a per-page URL would defeat that and flood the report.
        onWarning(`E-E-A-T audit: could not search company docs: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    const user = `Page URL: ${page.url}
Title: ${page.title ?? "(none)"}
Text sample: ${page.textSample.slice(0, 2500)}

Relevant excerpts from the company's own documents (ground truth, may be irrelevant if unrelated to this page):
${docContext}`;

    try {
      const parsed = await completeJson<{ findings: LlmFinding[] }>({
        agent: "eeat",
        tier: "mid",
        system: SYSTEM,
        user,
        maxTokens: 1500,
        onUsage,
      });
      for (const f of parsed.findings ?? []) {
        if (!hasNonEmptyStrings(f, ["title", "detail", "currentValue", "recommendedChange", "expectedImpact"])) continue;
        findings.push({
          id: newId("f"),
          agent: "eeat",
          title: f.title,
          detail: f.detail,
          evidence: [{ url: f.url || page.url, currentValue: f.currentValue }],
          severity: f.severity ?? "notice",
          recommendedChange: f.recommendedChange,
          expectedImpact: f.expectedImpact,
          estimatedEffort: f.estimatedEffort ?? "medium",
          category: "eeat",
        });
      }
    } catch (err) {
      onWarning(`E-E-A-T audit: ${err instanceof Error ? err.message : String(err)}`);
      continue;
    }
  }

  return findings;
}
