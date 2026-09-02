import type { AuditRun, ModelCallLog, Suggestion } from "../types.js";
import { complete } from "../llm/openrouter.js";
import { bindCostTracker } from "../logging/costTracker.js";
import slugify from "../util/slugify.js";

export interface GeneratedFile {
  path: string;
  content: string;
}

const SYSTEM = `You write implementation-ready fix notes for a developer picking up an \
approved SEO/GEO suggestion. Given the suggestion (what to change, why, the exact \
evidence, any code guidance already drafted, and effort level), write a single \
Markdown file that a developer can act on without re-deriving anything:

1. A one-line summary of the change.
2. The exact evidence (URL + current value) so they can verify they're editing the right thing.
3. The concrete change: prefer a real code/markup snippet (HTML tag, JSON-LD block, \
   robots.txt line) over prose. If the suggestion already includes code guidance, \
   refine it into something directly pasteable; do not invent a different approach.
4. Where it goes: which template/page/file this kind of change usually lives in for \
   the stack implied by the evidence (if the stack isn't identifiable, say "the \
   template or CMS field that renders this page's <head>" rather than guessing a \
   specific filename).

Keep it under 200 words. Do not add a "risks" or "testing" section. Reply with ONLY \
the Markdown body, no surrounding commentary, no code fences around the whole thing.`;

/**
 * Generates one implementation-ready Markdown fix note per approved
 * suggestion (plus an index) rather than guessing at file paths in a target
 * codebase the coding agent has never seen. This is the safe, honest scope
 * for an MVP that has to work against *any* audited site: concrete,
 * pasteable code where the fix is self-contained (JSON-LD, robots.txt,
 * meta/head tags), clear placement guidance otherwise. A follow-up phase
 * that checks out the target site's own repo (when the user supplies one)
 * can extend this to real file diffs.
 */
export async function generateFixFiles(run: AuditRun): Promise<GeneratedFile[]> {
  const approved = run.suggestions.filter((s) => s.status === "approved");
  const tracker = bindCostTracker(run);
  const files: GeneratedFile[] = [];

  for (const suggestion of approved) {
    const body = await generateNote(suggestion, run.url, tracker.onUsage);
    files.push({
      path: `seo-fixes/${run.id}/${suggestion.priority.toLowerCase()}-${slugify(suggestion.title)}.md`,
      content: `# ${suggestion.title}\n\n${body}\n`,
    });
  }

  const llmsTxtSuggestion = approved.find((s) => /llms\.txt/i.test(s.title));
  if (llmsTxtSuggestion) {
    files.push({
      path: "public/llms.txt",
      content: buildLlmsTxt(run.url),
    });
  }

  files.push({
    path: `seo-fixes/${run.id}/README.md`,
    content: buildIndex(run, approved),
  });

  return files;
}

async function generateNote(
  suggestion: Suggestion,
  siteUrl: string,
  onUsage: (log: ModelCallLog) => void,
): Promise<string> {
  const user = `Site: ${siteUrl}

Suggestion: ${suggestion.title}
Priority: ${suggestion.priority}
Why: ${suggestion.why}
Evidence: ${suggestion.evidence.map((e) => `${e.url} :: ${e.currentValue}`).join(" | ")}
Recommended change: ${suggestion.edits?.recommendedChange ?? suggestion.recommendedChange}
Existing code guidance: ${suggestion.codeGuidance ?? "(none provided)"}
Effort: ${suggestion.estimatedEffort}
Reviewer note: ${suggestion.edits?.note ?? "(none)"}`;

  return complete({
    agent: "coding-agent",
    tier: "strong",
    system: SYSTEM,
    user,
    maxTokens: 500,
    onUsage,
  });
}

function buildLlmsTxt(siteUrl: string): string {
  const host = new URL(siteUrl).host;
  return `# llms.txt for ${host}
# Generated from an approved Emory Audit suggestion. Replace the placeholder
# links below with this site's actual canonical pages before merging.

## About
- [About](/about): what the company does and who it serves

## Product
- [Product](/product): what is offered
- [Pricing](/pricing): current pricing

## Docs
- [Documentation](/docs): how the product works
`;
}

function buildIndex(run: AuditRun, approved: Suggestion[]): string {
  const lines = [
    `# Approved SEO/GEO fixes — ${run.url}`,
    "",
    `Run ${run.id}. ${approved.length} suggestion(s) approved and included here.`,
    "",
    "| Priority | Suggestion | File |",
    "|---|---|---|",
  ];
  for (const s of approved) {
    lines.push(`| ${s.priority} | ${s.title} | \`${s.priority.toLowerCase()}-${slugify(s.title)}.md\` |`);
  }
  lines.push("");
  lines.push("Each file has the exact evidence, the pasteable change, and where it typically belongs. Nothing here was merged automatically — review each before shipping.");
  return lines.join("\n");
}
