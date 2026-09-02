import type { AuditRun } from "./types.js";
import { newId } from "./util/id.js";
import { config } from "./config.js";
import { collect } from "./crawl/collect.js";
import { runTechnicalAudit } from "./audit/technical.js";
import { runOnPageAudit } from "./audit/onpage.js";
import { runGeoAeoAudit } from "./audit/geoAeo.js";
import { runPerformanceAudit } from "./audit/pagespeed.js";
import { runEeatAudit } from "./audit/eeat.js";
import { buildDocStore } from "./rag/docStore.js";
import { synthesize } from "./synth/synthesizer.js";
import { computeScore, renderMarkdown } from "./synth/report.js";
import { bindCostTracker } from "./logging/costTracker.js";
import { saveRun } from "./approval/store.js";

export interface StartAuditInput {
  url: string;
  constraints?: string | null;
  docs?: { name: string; text: string }[];
  maxPages?: number;
}

/**
 * Runs the full audit pipeline end to end and persists the run at each
 * stage, so a crash mid-run still leaves a readable partial result instead
 * of nothing. Returns once the run reaches "awaiting_approval" (or "failed").
 */
export async function runAuditPipeline(input: StartAuditInput): Promise<AuditRun> {
  const run: AuditRun = {
    id: newId("run"),
    url: input.url,
    constraints: input.constraints ?? null,
    docs: (input.docs ?? []).map((d) => ({ name: d.name, chars: d.text.length })),
    status: "collecting",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    findings: [],
    suggestions: [],
    modelCalls: [],
    costUsd: 0,
  };
  await saveRun(run);

  const tracker = bindCostTracker(run);

  try {
    const crawl = await collect(input.url, input.maxPages ?? config.maxPages);
    run.crawlSummary = { pagesRead: crawl.pages.length, crawler: crawl.crawler, truncated: crawl.truncated };
    run.status = "auditing";
    await saveRun(run);

    const docStorePromise = buildDocStore(input.docs ?? []).catch(() => null);

    const [technical, onpage, geoAeo, performance, docStore] = await Promise.all([
      Promise.resolve(runTechnicalAudit(crawl)),
      runOnPageAudit(crawl, run.constraints, tracker.onUsage, tracker.ceilingExceeded),
      runGeoAeoAudit(crawl, run.constraints, tracker.onUsage, tracker.ceilingExceeded),
      runPerformanceAudit(crawl),
      docStorePromise,
    ]);
    const eeat = await runEeatAudit(crawl, docStore, tracker.onUsage, tracker.ceilingExceeded);

    run.findings = [...technical, ...onpage, ...geoAeo, ...performance, ...eeat];
    run.score = computeScore(run.findings);
    run.status = "synthesizing";
    await saveRun(run);

    run.suggestions = await synthesize(run.findings, run.constraints, tracker.onUsage);
    run.reportMarkdown = renderMarkdown(run);
    run.status = "awaiting_approval";
    await saveRun(run);
  } catch (err) {
    run.status = "failed";
    run.error = err instanceof Error ? err.message : String(err);
    await saveRun(run);
  }

  return run;
}
