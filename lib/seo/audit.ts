import type { DB } from "../db";
import { logEvent } from "../audit";
import type { StructuredLlm } from "../llm";
import { charge } from "../quota";
import { getBusiness, getProfile } from "../repo";
import { fetchRaw } from "../safeFetch";
import type { PageSpeed } from "../integrations/pagespeed";
import { syncIssues } from "../site/issues";
import { runChecks, scoreSite, speedIssue, type Issue, type PageData } from "./checks";
import { crawlSite, type Fetcher } from "./crawl";
import { buildPlan, type SeoPlan } from "./plan";

export interface SeoReport {
  site: string;
  score: number;
  pagesCrawled: number;
  unreachable: string[];
  issues: Issue[];
  /** Per-page snapshot for the report table. */
  pages: Pick<PageData, "url" | "status" | "title" | "description" | "words" | "ms">[];
  plan: SeoPlan | null;
  /** Lighthouse mobile result for the homepage, when PageSpeed answered. */
  speed?: PageSpeed | null;
  /** Set if the AI plan failed; the automated findings are still valid. */
  planError: string;
}

export interface SeoAuditRow {
  id: number;
  site: string;
  status: "running" | "done" | "error";
  error: string;
  report: SeoReport | null;
  created_at: number;
  finished_at: number | null;
}

interface Raw {
  id: number;
  site: string;
  status: SeoAuditRow["status"];
  error: string;
  report_json: string;
  created_at: number;
  finished_at: number | null;
}

const toRow = (r: Raw): SeoAuditRow => ({
  id: r.id,
  site: r.site,
  status: r.status,
  error: r.error,
  report: r.report_json ? (JSON.parse(r.report_json) as SeoReport) : null,
  created_at: r.created_at,
  finished_at: r.finished_at,
});

export function latestAudit(db: DB): SeoAuditRow | null {
  const r = db.prepare(`SELECT * FROM seo_audits ORDER BY id DESC LIMIT 1`).get() as Raw | undefined;
  if (!r) return null;
  // A "running" audit whose process is gone (restart) can never finish.
  if (r.status === "running" && !running().has(db)) {
    return toRow({ ...r, status: "error", error: "Interrupted by a restart. Run it again." });
  }
  return toRow(r);
}

const g = globalThis as unknown as { __emorySeoRunning?: WeakSet<DB> };
const running = (): WeakSet<DB> => (g.__emorySeoRunning ??= new WeakSet());

export interface AuditDeps {
  llm: StructuredLlm | null;
  fetchPage?: Fetcher;
  maxPages?: number;
  /** Mobile speed test for the homepage; omitted in tests. A failure never fails the audit. */
  speed?: (url: string) => Promise<PageSpeed>;
}

/** Run the speed test if one was given; a failure (quota, timeout) just leaves it out. */
export async function measureSpeed(url: string, speed: AuditDeps["speed"]): Promise<PageSpeed | null> {
  if (!speed) return null;
  try {
    return await speed(url);
  } catch (err) {
    console.error("[seo] pagespeed failed:", err instanceof Error ? err.message : err);
    return null;
  }
}

/** Crawl, check, and (if an LLM is available) write the fix plan. Persists the result. Awaitable for tests. */
export async function runAudit(db: DB, id: number, site: string, deps: AuditDeps): Promise<void> {
  try {
    const crawl = await crawlSite(site, deps.fetchPage ?? fetchRaw, deps.maxPages);
    if (crawl.pages.length === 0) throw new Error("We couldn't read any pages on that site.");
    const speed = await measureSpeed(crawl.pages[0].url, deps.speed);
    const slow = speed ? speedIssue(speed) : null;
    const issues = [...runChecks(crawl.pages, crawl.site), ...(slow ? [slow] : [])];
    const score = scoreSite(issues, crawl.pages.length);
    const profile = getProfile(db);

    let plan: SeoPlan | null = null;
    let planError = "";
    if (deps.llm) {
      try {
        plan = await buildPlan(deps.llm, { site, offer: profile.offer, icp: profile.icp, issues, pages: crawl.pages, score });
      } catch (err) {
        planError = err instanceof Error ? err.message.slice(0, 200) : "The fix plan could not be written.";
      }
    } else {
      planError = "AI is not configured, so only the automated findings are shown.";
    }

    const report: SeoReport = {
      site,
      score,
      pagesCrawled: crawl.pages.length,
      unreachable: crawl.unreachable.slice(0, 10),
      issues,
      pages: crawl.pages.map(({ url, status, title, description, words, ms }) => ({ url, status, title, description, words, ms })),
      plan,
      speed,
      planError,
    };
    db.transaction(() => {
      db.prepare(`UPDATE seo_audits SET status = 'done', report_json = ?, finished_at = ? WHERE id = ?`).run(JSON.stringify(report), Date.now(), id);
      const { opened, fixed } = syncIssues(db, issues);
      logEvent(db, { track: "site", action: "crawled site", target: `${site} · score ${score} · ${opened} new, ${fixed} fixed` });
    })();
  } catch (err) {
    const message = err instanceof Error ? err.message.slice(0, 300) : "The audit failed.";
    console.error("[seo] audit failed:", message);
    db.prepare(`UPDATE seo_audits SET status = 'error', error = ?, finished_at = ? WHERE id = ?`).run(message, Date.now(), id);
  }
}

/** Start an audit in the background. Returns false if one is already running for this workspace. */
export function startAudit(db: DB, deps: AuditDeps, siteInput?: string, opts: { scheduled?: boolean } = {}): boolean {
  if (running().has(db)) return false;
  const site = (siteInput ?? "").trim() || getBusiness(db).website;
  if (!site) throw new Error("Enter your website address first.");
  if (!opts.scheduled) charge(db, "seo");
  const id = Number(
    db.prepare(`INSERT INTO seo_audits (site, status, created_at) VALUES (?, 'running', ?)`).run(site, Date.now()).lastInsertRowid,
  );
  running().add(db);
  void runAudit(db, id, site, deps).finally(() => running().delete(db));
  return true;
}
