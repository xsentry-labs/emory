import { schedule as cronSchedule, validate as cronValidate } from "node-cron";
import pino from "pino";
import { config } from "../config.js";
import { runAuditPipeline } from "../pipeline.js";
import { listRuns, loadRun } from "../approval/store.js";
import { diffFindings } from "../synth/diff.js";

const log = pino({ name: "beacon-scheduler" });

/**
 * Beacon Phase B1's continuous re-audit: a fixed, config-driven list of
 * target URLs (BEACON_TARGET_URLS), re-audited on a cron schedule
 * (BEACON_REAUDIT_CRON). Deliberately no workspace/connection model yet —
 * see BEACON_ARCHITECTURE.md §2/§7 for why that's the right scope for this
 * phase and where it stops being enough. A no-op if BEACON_TARGET_URLS is
 * unset, so this changes nothing for an Audit-only deployment.
 *
 * Single-instance only, like the rest of this service (ARCHITECTURE.md §9)
 * — running this on more than one Railway replica would re-audit the same
 * URLs multiple times over.
 */
export function startReauditScheduler(): void {
  if (!config.beaconTargetUrls.length) return;

  if (!cronValidate(config.beaconReauditCron)) {
    log.error(`Invalid BEACON_REAUDIT_CRON "${config.beaconReauditCron}" — scheduler not started.`);
    return;
  }

  log.info(
    { urls: config.beaconTargetUrls, cron: config.beaconReauditCron },
    `Beacon continuous re-audit scheduler started for ${config.beaconTargetUrls.length} target(s)`,
  );

  cronSchedule(config.beaconReauditCron, () => {
    runAllTargets().catch((err) => log.error({ err }, "scheduled re-audit batch failed"));
  });
}

async function runAllTargets(): Promise<void> {
  // Sequential, not parallel: these are full audits (crawl + many LLM
  // calls) — running a whole target list at once would spike cost and
  // crawl-concurrency well past what a single manually-triggered audit does.
  for (const url of config.beaconTargetUrls) {
    await runOne(url).catch((err) => log.error({ err, url }, "scheduled re-audit failed for one target"));
  }
}

async function runOne(url: string): Promise<void> {
  const run = await runAuditPipeline({ url });
  if (run.status === "failed") {
    log.warn({ url, runId: run.id, error: run.error }, "scheduled re-audit failed");
    return;
  }

  const allRuns = await listRuns();
  const previousSummary = allRuns
    .filter((r) => r.url === run.url && r.id !== run.id && r.createdAt < run.createdAt && r.status !== "failed")
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];

  if (!previousSummary) {
    log.info({ url, runId: run.id, findings: run.findings.length }, "scheduled re-audit complete (first run for this URL)");
    return;
  }

  const previous = await loadRun(previousSummary.id);
  if (!previous) {
    log.warn({ url, runId: run.id, previousRunId: previousSummary.id }, "could not load prior run to diff against");
    return;
  }

  const diff = diffFindings(previous.findings, run.findings);
  log.info(
    { url, runId: run.id, previousRunId: previous.id, added: diff.added.length, resolved: diff.resolved.length, persisting: diff.persisting.length },
    "scheduled re-audit complete",
  );
}
