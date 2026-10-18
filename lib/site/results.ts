import type { DB } from "../db";
import { getKv, setKv } from "../inbound";
import { accessToken, googleConfig, listSites, matchProperty, searchAnalytics, type GscRow } from "../integrations/google";
import type { Fetch } from "../integrations/github";
import { getConnection, markConnectionError, updateConnection } from "../integrations/store";
import { getBusiness } from "../repo";
import { listIssues } from "./issues";

/**
 * Results: did the fixes move search traffic? Search Console data is synced
 * daily into gsc_daily; this compares clicks and position for fixed pages two
 * weeks either side of the fix, and says when it is too early to tell.
 */

export interface GoogleConnection extends Record<string, unknown> {
  refreshToken: string;
  property?: string;
}

const DAY = 86_400_000;
const isoDay = (t: number) => new Date(t).toISOString().slice(0, 10);

/** Search Console lags ~2 days; fetch 16 weeks on first sync, then the last 10 days. */
export async function syncSearchConsole(db: DB, f: Fetch = fetch, at = Date.now()): Promise<number> {
  const cfg = googleConfig();
  const conn = getConnection<GoogleConnection>(db, "google");
  if (!cfg || !conn) return 0;
  try {
    const access = await accessToken(cfg, conn.config.refreshToken, f);
    let property = conn.config.property;
    if (!property) {
      property = matchProperty(await listSites(access, f), getBusiness(db).website) ?? undefined;
      if (!property) throw new Error("No Search Console property matches your website. Add it in Search Console, then reconnect.");
      updateConnection<GoogleConnection>(db, "google", { property }, ["refreshToken"]);
    }
    const first = !getKv(db, "gsc_synced_at");
    const rows = await searchAnalytics(access, property, isoDay(at - (first ? 112 : 10) * DAY), isoDay(at - 2 * DAY), f);
    saveRows(db, rows);
    setKv(db, "gsc_synced_at", String(at));
    return rows.length;
  } catch (err) {
    markConnectionError(db, "google", err instanceof Error ? err.message : "Search Console sync failed");
    return 0;
  }
}

export function saveRows(db: DB, rows: GscRow[]): void {
  const put = db.prepare(
    `INSERT INTO gsc_daily (day, page, clicks, impressions, position) VALUES (@day, @page, @clicks, @impressions, @position)
     ON CONFLICT(day, page) DO UPDATE SET clicks = excluded.clicks, impressions = excluded.impressions, position = excluded.position`,
  );
  db.transaction(() => rows.forEach((r) => put.run(r)))();
}

export interface WeekPoint {
  /** Monday of the week, YYYY-MM-DD. */
  week: string;
  clicks: number;
  /** A fix was confirmed that week. */
  fixed: boolean;
}

export interface PageResult {
  page: string;
  fix: string;
  fixedAt: number;
  before: { clicks: number; position: number | null };
  after: { clicks: number; position: number | null } | null;
}

export interface ResultsView {
  connected: boolean;
  property: string | null;
  error: string;
  weeks: WeekPoint[];
  clicksThisWeek: number | null;
  clicksBefore: number | null;
  avgPosition: number | null;
  avgPositionBefore: number | null;
  fixedCount: number;
  /** Site health from the first finished audit, to compare against. */
  startScore: number | null;
  pages: PageResult[];
}

const monday = (t: number) => {
  const d = new Date(t);
  const day = (d.getUTCDay() + 6) % 7;
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - day);
};

/** Clicks per week (sum) and impression-weighted position over [from, to). */
function window(db: DB, from: number, to: number, page?: string) {
  const r = db
    .prepare(
      `SELECT COALESCE(SUM(clicks), 0) AS clicks, SUM(position * impressions) / NULLIF(SUM(impressions), 0) AS position, COUNT(DISTINCT day) AS days
       FROM gsc_daily WHERE day >= ? AND day < ? ${page ? "AND (page = ? OR page LIKE ?)" : ""}`,
    )
    .get(isoDay(from), isoDay(to), ...(page ? [page, `${page.replace(/\/$/, "")}/%`] : [])) as { clicks: number; position: number | null; days: number };
  return r;
}

function firstScore(db: DB): number | null {
  const r = db.prepare(`SELECT report_json FROM seo_audits WHERE status = 'done' ORDER BY id LIMIT 1`).get() as { report_json: string } | undefined;
  return r?.report_json ? (JSON.parse(r.report_json) as { score: number }).score : null;
}

export function resultsView(db: DB, at = Date.now(), weeks = 8): ResultsView {
  const conn = getConnection<GoogleConnection>(db, "google");
  const fixed = listIssues(db).filter((i) => i.status === "fixed" && i.fixedAt);
  const fixedWeeks = new Set(fixed.map((i) => isoDay(monday(i.fixedAt!))));
  const latest = (db.prepare(`SELECT MAX(day) AS d FROM gsc_daily`).get() as { d: string | null }).d;
  const end = latest ? Date.parse(latest) + DAY : at;

  const points: WeekPoint[] = [];
  for (let w = weeks - 1; w >= 0; w--) {
    const start = monday(end - DAY) - w * 7 * DAY;
    points.push({ week: isoDay(start), clicks: window(db, start, start + 7 * DAY).clicks, fixed: fixedWeeks.has(isoDay(start)) });
  }

  const firstFix = fixed.length ? Math.min(...fixed.map((i) => i.fixedAt!)) : null;
  const last7 = latest ? window(db, end - 7 * DAY, end) : null;
  const before7 = firstFix && latest ? window(db, firstFix - 7 * DAY, firstFix) : null;

  const pages: PageResult[] = [];
  for (const i of fixed) {
    for (const page of i.pages.slice(0, 3).map((p) => p.replace(/\s\(.*\)$/, ""))) {
      const b = window(db, i.fixedAt! - 14 * DAY, i.fixedAt!, page);
      // Too early to tell until two full weeks of data exist after the fix.
      const tooEarly = !latest || Date.parse(latest) < i.fixedAt! + 14 * DAY;
      const a = tooEarly ? null : window(db, i.fixedAt!, i.fixedAt! + 14 * DAY, page);
      pages.push({
        page,
        fix: i.title,
        fixedAt: i.fixedAt!,
        before: { clicks: Math.round(b.clicks / 2), position: b.position },
        after: a ? { clicks: Math.round(a.clicks / 2), position: a.position } : null,
      });
    }
  }

  return {
    connected: Boolean(conn),
    property: conn?.config.property ?? null,
    error: conn?.status === "error" ? conn.error : "",
    weeks: points,
    clicksThisWeek: last7 ? last7.clicks : null,
    clicksBefore: before7 ? before7.clicks : null,
    avgPosition: last7?.position ?? null,
    avgPositionBefore: before7?.position ?? null,
    fixedCount: fixed.length,
    startScore: firstScore(db),
    pages: pages.sort((a, b) => b.fixedAt - a.fixedAt).slice(0, 20),
  };
}
