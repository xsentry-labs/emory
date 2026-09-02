import type { AuditFinding, CrawlResult, CrawledPage, ModelCallLog } from "../types.js";
import { completeJson } from "../llm/openrouter.js";
import { newId } from "../util/id.js";

const BATCH_SIZE = 5;
const MAX_PAGES_SAMPLED = 15;

interface LlmFinding {
  url: string;
  title: string;
  detail: string;
  currentValue: string;
  severity: "critical" | "warning" | "notice";
  recommendedChange: string;
  codeGuidance?: string;
  expectedImpact: string;
  estimatedEffort: "low" | "medium" | "high";
}

const SYSTEM = `You are a GEO/AEO (Generative Engine Optimization / Answer Engine \
Optimization) specialist. You judge how citable and extractable a page is for AI \
assistants (ChatGPT, Claude, Perplexity, Google AI Overviews) that answer questions \
by quoting or paraphrasing web content.

Check for, per page:
- Answer-shaped content: does the page state its key facts (pricing, specs, definitions) \
  as short, self-contained sentences an assistant could quote directly, or is the \
  information only implied, buried in marketing prose, or rendered client-side?
- Whether headings and paragraphs stand alone out of context (a good citation unit) \
  vs. requiring the whole page to make sense.
- FAQ-shaped content and whether FAQPage/HowTo/Product schema would fit but is missing \
  (only flag if the schema is genuinely absent — check the provided jsonLdTypes list).
- Freshness signals (dated content, "last updated") for claims that go stale (pricing, \
  version numbers).

Rules:
- Every finding MUST cite the exact "currentValue" you observed (a quoted snippet, \
  "no dated content found", the actual jsonLdTypes list, etc.).
- Do not flag a page for missing schema types it doesn't need (e.g. a blog post doesn't \
  need Product schema).
- When you recommend a schema addition, put a minimal, valid JSON-LD example in \
  "codeGuidance".
- Reply with ONLY JSON: {"findings": LlmFinding[]}.`;

export async function runGeoAeoAudit(
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
    const user = buildUserPrompt(batch, constraints, crawl.llmsTxt.found);

    try {
      const parsed = await completeJson<{ findings: LlmFinding[] }>({
        agent: "geo-aeo",
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
          agent: "geo-aeo",
          title: f.title,
          detail: f.detail,
          evidence: [{ url: f.url, currentValue: f.currentValue }],
          severity: f.severity ?? "notice",
          recommendedChange: f.recommendedChange,
          codeGuidance: f.codeGuidance,
          expectedImpact: f.expectedImpact,
          estimatedEffort: f.estimatedEffort ?? "medium",
          category: "geo-aeo",
        });
      }
    } catch {
      continue;
    }
  }

  return findings;
}

function buildUserPrompt(pages: CrawledPage[], constraints: string | null, llmsTxtFound: boolean): string {
  const constraintLine = constraints ? `Focus constraint from the user: ${constraints}\n\n` : "";
  const siteLine = `Site-level: llms.txt ${llmsTxtFound ? "found" : "NOT found"}.\n\n`;
  const pageBlocks = pages
    .map(
      (p) => `URL: ${p.url}
H1: ${p.h1.join(" | ") || "(none)"}
H2s: ${p.h2.slice(0, 8).join(" | ") || "(none)"}
jsonLdTypes: ${p.jsonLd.map((j) => (typeof j === "object" && j && "@type" in (j as object) ? (j as { "@type": unknown })["@type"] : "unknown")).join(", ") || "(none)"}
Text sample: ${p.textSample.slice(0, 1500)}`,
    )
    .join("\n---\n");

  return `${constraintLine}${siteLine}Analyze these pages for GEO/AEO (AI-assistant citability) issues:\n\n${pageBlocks}`;
}
