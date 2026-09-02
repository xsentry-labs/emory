import type { AuditFinding, CrawlResult, CrawledPage, ModelCallLog } from "../types.js";
import { completeJson } from "../llm/openrouter.js";
import { newId } from "../util/id.js";

const BATCH_SIZE = 5;
const MAX_PAGES_SAMPLED = 20;

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

const SYSTEM = `You are an on-page SEO specialist. You are given extracted signals for a batch \
of web pages (title, meta description, headings, a text sample, word count). \
Judge title/description quality, heading structure, keyword alignment with the \
apparent page topic, and content depth (thin vs substantive).

Rules:
- Every finding MUST cite the exact "currentValue" you observed on that page (the actual \
  title text, the actual word count, etc.) — never a generic statement.
- Only report real problems. A good title/description is not a finding.
- Do not invent target keywords; infer topic from on-page content only.
- Reply with ONLY JSON: {"findings": LlmFinding[]}, where each item has \
  url, title, detail, currentValue, severity ("critical"|"warning"|"notice"), \
  recommendedChange, expectedImpact, estimatedEffort ("low"|"medium"|"high").`;

export async function runOnPageAudit(
  crawl: CrawlResult,
  constraints: string | null,
  onUsage: (log: ModelCallLog) => void,
  ceilingExceeded: () => boolean,
): Promise<AuditFinding[]> {
  const sample = crawl.pages.filter((p) => p.statusCode < 400).slice(0, MAX_PAGES_SAMPLED);
  const findings: AuditFinding[] = [];

  for (let i = 0; i < sample.length; i += BATCH_SIZE) {
    if (ceilingExceeded()) break;
    const batch = sample.slice(i, i + BATCH_SIZE);
    const user = buildUserPrompt(batch, constraints);

    try {
      const parsed = await completeJson<{ findings: LlmFinding[] }>({
        agent: "onpage",
        tier: "mid",
        system: SYSTEM,
        user,
        maxTokens: 2500,
        onUsage,
      });
      for (const f of parsed.findings ?? []) {
        if (!f.url || !sample.some((p) => p.url === f.url)) continue;
        findings.push({
          id: newId("f"),
          agent: "onpage",
          title: f.title,
          detail: f.detail,
          evidence: [{ url: f.url, currentValue: f.currentValue }],
          severity: f.severity ?? "notice",
          recommendedChange: f.recommendedChange,
          expectedImpact: f.expectedImpact,
          estimatedEffort: f.estimatedEffort ?? "medium",
          category: "on-page",
        });
      }
    } catch {
      // one batch failing shouldn't drop the whole audit; skip and continue
      continue;
    }
  }

  return findings;
}

function buildUserPrompt(pages: CrawledPage[], constraints: string | null): string {
  const constraintLine = constraints ? `Focus constraint from the user: ${constraints}\n\n` : "";
  const pageBlocks = pages
    .map(
      (p) => `URL: ${p.url}
Title: ${p.title ?? "(none)"}
Meta description: ${p.metaDescription ?? "(none)"}
H1: ${p.h1.join(" | ") || "(none)"}
H2s: ${p.h2.slice(0, 8).join(" | ") || "(none)"}
Word count: ${p.wordCount}
Text sample: ${p.textSample.slice(0, 1200)}`,
    )
    .join("\n---\n");

  return `${constraintLine}Analyze these pages for on-page SEO issues:\n\n${pageBlocks}`;
}
