import type { DB } from "../db";
import { getKv, setKv } from "../inbound";
import { pageSpeed } from "../integrations/pagespeed";
import { isLlmConfigured, openRouterLlm } from "../llm";
import { getBusiness } from "../repo";
import { latestAudit, startAudit } from "../seo/audit";
import { syncPrs } from "./fixes";
import { syncSearchConsole } from "./results";

const MIN = 60_000;
const DAY = 24 * 60 * MIN;

/** Real dependencies for an audit started by the server or a person. */
export const auditDeps = () => ({ llm: isLlmConfigured() ? openRouterLlm : null, speed: (url: string) => pageSpeed(url) });

/** Run `fn` at most once per `everyMs` per workspace, remembered across restarts. */
async function every(db: DB, key: string, everyMs: number, at: number, fn: () => Promise<unknown> | unknown) {
  const last = Number(getKv(db, key) ?? 0);
  if (at - last < everyMs) return;
  setKv(db, key, String(at));
  await fn();
}

/**
 * Site work the worker does for a workspace: keep pull requests in sync,
 * re-crawl nightly and after a fix merges (that's what closes issues), and
 * pull Search Console data daily.
 */
export async function siteTick(db: DB, at = Date.now()): Promise<void> {
  await every(db, "tick_prs", 5 * MIN, at, () => syncPrs(db));

  const site = getBusiness(db).website;
  const last = latestAudit(db);
  const recrawlAfter = Number(getKv(db, "recrawl_after") ?? 0);
  const stale = !last || (last.status !== "running" && at - (last.finished_at ?? last.created_at) > DAY);
  const afterMerge = recrawlAfter > 0 && at >= recrawlAfter && last?.status !== "running";
  if (site && (stale || afterMerge)) {
    setKv(db, "recrawl_after", "0");
    try {
      // Scheduled crawls skip the monthly allowance check: they confirm fixes rather than spend on new work.
      startAudit(db, auditDeps(), site, { scheduled: true });
    } catch (err) {
      console.error("[site] scheduled crawl not started:", err instanceof Error ? err.message : err);
    }
  }

  await every(db, "tick_gsc", DAY, at, () => syncSearchConsole(db));
}
