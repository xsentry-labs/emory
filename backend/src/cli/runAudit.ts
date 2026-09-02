import { readFile } from "node:fs/promises";
import path from "node:path";
import { runAuditPipeline } from "../pipeline.js";

/**
 * CLI entry for running a full audit without the HTTP server, e.g.:
 *   npm run audit:cli -- https://example.com --docs ./brand.txt --constraints "homepage only"
 */
async function main() {
  const args = process.argv.slice(2);
  const url = args.find((a) => !a.startsWith("--"));
  if (!url) {
    console.error("Usage: npm run audit:cli -- <url> [--docs <file>]... [--constraints \"...\"]");
    process.exit(1);
  }

  const docs: { name: string; text: string }[] = [];
  const constraintsIdx = args.indexOf("--constraints");
  const constraints = constraintsIdx >= 0 ? args[constraintsIdx + 1] : null;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--docs" && args[i + 1]) {
      const filePath = args[i + 1];
      const text = await readFile(filePath, "utf-8");
      docs.push({ name: path.basename(filePath), text });
    }
  }

  console.log(`Running audit for ${url}...`);
  const run = await runAuditPipeline({ url, constraints, docs });
  console.log(`\nStatus: ${run.status}`);
  console.log(`Score: ${run.score}`);
  console.log(`Findings: ${run.findings.length}, Suggestions: ${run.suggestions.length}`);
  console.log(`Estimated cost: $${run.costUsd.toFixed(4)}`);
  console.log(`\nRun saved as ${run.id}. Report:\n`);
  console.log(run.reportMarkdown ?? run.error ?? "(no report)");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
