import type { DB } from "./db";
import { getPipeline } from "./pipeline";
import { latestAudit } from "./seo/audit";

/**
 * The "today" hub: one queue across every track of the things Emory won't do
 * without a person, plus a short tally of the week. Each track contributes
 * items from its own tables; nothing here is stored separately.
 */

export const TRACKS = ["replies", "site", "leads", "social"] as const;
export type Track = (typeof TRACKS)[number];

export interface TodayItem {
  /** Stable across renders, e.g. "draft:12". */
  key: string;
  track: Track;
  /** Short label after the track, e.g. "reply · new". */
  label: string;
  title: string;
  detail: string;
  at: number;
  href: string;
  /** Hot items (a person wrote back) are pinned first and highlighted. */
  hot?: boolean;
  /** A draft that can be approved, edited or skipped in place. */
  draft?: { id: number; subject: string; body: string };
}

export interface TodayStats {
  siteScore: number | null;
  siteIssues: number;
  leadsFound: number;
  leadsScored: number;
  sent: number;
  replies: number;
  postsDrafted: number;
}

export interface TodayView {
  items: TodayItem[];
  counts: Record<Track | "all", number>;
  week: TodayStats;
  /** What Emory did in the last 24h without being asked. */
  overnight: string[];
}

const DAY = 24 * 60 * 60 * 1000;
const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);
const count = (db: DB, sql: string, ...args: unknown[]) => (db.prepare(sql).get(...args) as { n: number }).n;

function replyItems(db: DB): TodayItem[] {
  // The latest inbound message per lead, when nothing has been drafted or sent after it.
  const rows = db
    .prepare(
      `SELECT m.id, m.body, m.created_at, p.id AS pid, p.name, p.company
       FROM messages m JOIN prospects p ON p.id = m.prospect_id
       WHERE m.direction = 'inbound' AND p.status = 'replied'
         AND m.id = (SELECT MAX(id) FROM messages WHERE prospect_id = p.id AND direction = 'inbound')
         AND NOT EXISTS (SELECT 1 FROM messages o WHERE o.prospect_id = p.id AND o.direction = 'outbound' AND o.id > m.id)
       ORDER BY m.created_at DESC`,
    )
    .all() as { id: number; body: string; created_at: number; pid: number; name: string; company: string }[];
  return rows.map((r) => ({
    key: `reply:${r.id}`,
    track: "replies",
    label: "reply · needs an answer",
    title: `${r.name}${r.company ? `, ${r.company}` : ""} wrote back`,
    detail: `"${clip(r.body.replace(/\s+/g, " ").trim(), 160)}"`,
    at: r.created_at,
    href: `/prospects/${r.pid}`,
    hot: true,
  }));
}

function draftItems(db: DB): TodayItem[] {
  const rows = db
    .prepare(
      `SELECT m.id, m.kind, m.subject, m.body, m.created_at, p.id AS pid, p.name, p.company
       FROM messages m JOIN prospects p ON p.id = m.prospect_id
       WHERE m.status = 'draft' ORDER BY m.created_at, m.id`,
    )
    .all() as { id: number; kind: string; subject: string; body: string; created_at: number; pid: number; name: string; company: string }[];
  return rows.map((r) => ({
    key: `draft:${r.id}`,
    track: "leads",
    label: r.kind === "followup" ? "leads · follow-up ready" : "leads · first email ready",
    title: `${r.name}${r.company ? ` at ${r.company}` : ""}${r.subject ? `: ${r.subject}` : ""}`,
    detail: clip(r.body.replace(/\s+/g, " ").trim(), 180),
    at: r.created_at,
    href: `/prospects/${r.pid}`,
    draft: { id: r.id, subject: r.subject, body: r.body },
  }));
}

function leadItems(db: DB): TodayItem[] {
  const out: TodayItem[] = [];
  const unscored = count(db, `SELECT COUNT(*) AS n FROM prospects WHERE score IS NULL AND status IN ('new','researching')`);
  const noEmail = count(
    db,
    `SELECT COUNT(*) AS n FROM prospects WHERE email = '' AND score >= 40 AND status IN ('qualified','new','researching')`,
  );
  const pipeline = getPipeline(db);
  if (pipeline.status === "error" && pipeline.error) {
    out.push({
      key: "pipeline:error",
      track: "leads",
      label: "leads · search stopped",
      title: "the last lead search didn't finish",
      detail: pipeline.error,
      at: pipeline.finishedAt ?? pipeline.startedAt,
      href: "/leads",
    });
  }
  if (unscored > 0) {
    out.push({
      key: "leads:unscored",
      track: "leads",
      label: "leads · not scored yet",
      title: `${unscored} new lead${unscored === 1 ? "" : "s"} to research and score`,
      detail: "research reads each lead's site and rates fit and bant against your ideal customer.",
      at: Date.now(),
      href: "/leads",
    });
  }
  if (noEmail > 0) {
    out.push({
      key: "leads:no-email",
      track: "leads",
      label: "leads · missing contact",
      title: `${noEmail} qualified lead${noEmail === 1 ? " has" : "s have"} no email yet`,
      detail: "add an address so their outreach can be approved and sent.",
      at: Date.now(),
      href: "/leads",
    });
  }
  return out;
}

function siteItems(db: DB): TodayItem[] {
  const audit = latestAudit(db);
  if (!audit) {
    return [
      {
        key: "site:none",
        track: "site",
        label: "site · not audited",
        title: "run the first audit of your site",
        detail: "about two minutes. finds what's hurting search and writes the fixes.",
        at: Date.now(),
        href: "/seo",
      },
    ];
  }
  if (audit.status === "error") {
    return [
      {
        key: `site:error:${audit.id}`,
        track: "site",
        label: "site · audit failed",
        title: `couldn't finish the audit of ${audit.site}`,
        detail: audit.error,
        at: audit.finished_at ?? audit.created_at,
        href: "/seo",
      },
    ];
  }
  const report = audit.report;
  if (audit.status !== "done" || !report) return [];
  const high = report.issues.filter((i) => i.severity === "high");
  if (high.length === 0) return [];
  return [
    {
      key: `site:high:${audit.id}`,
      track: "site",
      label: "site · fixes waiting",
      title: `${high.length} high-impact issue${high.length === 1 ? "" : "s"} on ${report.site.replace(/^https?:\/\//, "")}`,
      detail: high
        .slice(0, 3)
        .map((i) => i.title.toLowerCase())
        .join(" · "),
      at: audit.finished_at ?? audit.created_at,
      href: "/seo",
    },
  ];
}

function socialItems(db: DB): TodayItem[] {
  const rows = db
    .prepare(`SELECT id, body, created_at FROM content_items WHERE kind = 'x_post' AND status = 'draft' ORDER BY id DESC LIMIT 5`)
    .all() as { id: number; body: string; created_at: number }[];
  return rows.map((r) => ({
    key: `post:${r.id}`,
    track: "social",
    label: "social · x post draft",
    title: `"${clip(r.body.replace(/\s+/g, " ").trim(), 140)}"`,
    detail: "copy it to x when you're happy with it, then mark it done.",
    at: r.created_at,
    href: "/content",
  }));
}

function weekStats(db: DB, at: number): TodayStats {
  const since = at - 7 * DAY;
  const audit = latestAudit(db);
  return {
    siteScore: audit?.report?.score ?? null,
    siteIssues: audit?.report?.issues.length ?? 0,
    leadsFound: count(db, `SELECT COUNT(*) AS n FROM prospects WHERE created_at >= ?`, since),
    leadsScored: count(db, `SELECT COUNT(*) AS n FROM prospects WHERE researched_at >= ?`, since),
    sent: count(db, `SELECT COUNT(*) AS n FROM messages WHERE status = 'sent' AND sent_at >= ?`, since),
    replies: count(db, `SELECT COUNT(*) AS n FROM messages WHERE direction = 'inbound' AND created_at >= ?`, since),
    postsDrafted: count(db, `SELECT COUNT(*) AS n FROM content_items WHERE kind = 'x_post' AND created_at >= ?`, since),
  };
}

function overnight(db: DB, at: number): string[] {
  const since = at - DAY;
  const parts: [number, string, string][] = [
    [count(db, `SELECT COUNT(*) AS n FROM seo_audits WHERE status = 'done' AND finished_at >= ?`, since), "audited the site", "audited the site"],
    [count(db, `SELECT COUNT(*) AS n FROM prospects WHERE created_at >= ?`, since), "found 1 lead", "found # leads"],
    [count(db, `SELECT COUNT(*) AS n FROM prospects WHERE researched_at >= ?`, since), "scored 1 lead", "scored # leads"],
    [
      count(db, `SELECT COUNT(*) AS n FROM messages WHERE direction = 'outbound' AND created_at >= ?`, since),
      "drafted 1 email",
      "drafted # emails",
    ],
    [count(db, `SELECT COUNT(*) AS n FROM messages WHERE status = 'sent' AND sent_at >= ?`, since), "sent 1 approved email", "sent # approved emails"],
    [count(db, `SELECT COUNT(*) AS n FROM messages WHERE direction = 'inbound' AND created_at >= ?`, since), "logged 1 reply", "logged # replies"],
  ];
  return parts.filter(([n]) => n > 0).map(([n, one, many]) => (n === 1 ? one : many.replace("#", String(n))));
}

export function todayView(db: DB, at = Date.now()): TodayView {
  const all = [...replyItems(db), ...siteItems(db), ...draftItems(db), ...leadItems(db), ...socialItems(db)];
  // Hot first, then oldest first within the rest so nothing waits forever.
  const items = [...all.filter((i) => i.hot), ...all.filter((i) => !i.hot)];
  const counts = { all: items.length, replies: 0, site: 0, leads: 0, social: 0 };
  for (const i of items) counts[i.track]++;
  return { items, counts, week: weekStats(db, at), overnight: overnight(db, at) };
}
