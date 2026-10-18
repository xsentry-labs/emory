import type { DB } from "../db";
import { issueCategory, issueFix, type Category, type FixType } from "../seo/categories";
import type { Issue, Severity } from "../seo/checks";

/**
 * Issues persist across audits, one row per rule. Each finished audit
 * upserts what it found; an open or in-PR issue the audit no longer finds is
 * closed as fixed, so a fix only counts once a crawl confirms it.
 */

export type IssueStatus = "open" | "in_pr" | "fixed" | "dismissed";

export interface SiteIssue {
  id: number;
  rule: string;
  title: string;
  detail: string;
  severity: Severity;
  category: Category;
  fixType: FixType;
  pages: string[];
  count: number;
  status: IssueStatus;
  prId: number | null;
  firstSeen: number;
  lastSeen: number;
  fixedAt: number | null;
}

interface Raw {
  id: number;
  rule: string;
  title: string;
  detail: string;
  severity: Severity;
  category: Category;
  fix_type: FixType;
  pages_json: string;
  count: number;
  status: IssueStatus;
  pr_id: number | null;
  first_seen: number;
  last_seen: number;
  fixed_at: number | null;
}

const toIssue = (r: Raw): SiteIssue => ({
  id: r.id,
  rule: r.rule,
  title: r.title,
  detail: r.detail,
  severity: r.severity,
  category: r.category,
  fixType: r.fix_type,
  pages: JSON.parse(r.pages_json) as string[],
  count: r.count,
  status: r.status,
  prId: r.pr_id,
  firstSeen: r.first_seen,
  lastSeen: r.last_seen,
  fixedAt: r.fixed_at,
});

export function syncIssues(db: DB, found: Issue[], at = Date.now()): { opened: number; fixed: number } {
  const upsert = db.prepare(
    `INSERT INTO site_issues (rule, title, detail, severity, category, fix_type, pages_json, count, status, first_seen, last_seen)
     VALUES (@rule, @title, @detail, @severity, @category, @fix_type, @pages, @count, 'open', @at, @at)
     ON CONFLICT(rule) DO UPDATE SET title = excluded.title, detail = excluded.detail, severity = excluded.severity,
       category = excluded.category, fix_type = excluded.fix_type, pages_json = excluded.pages_json, count = excluded.count,
       last_seen = excluded.last_seen,
       status = CASE WHEN site_issues.status = 'fixed' THEN 'open' ELSE site_issues.status END,
       fixed_at = CASE WHEN site_issues.status = 'fixed' THEN NULL ELSE site_issues.fixed_at END`,
  );
  // A fixed issue that comes back reopens; dismissed stays dismissed; in_pr stays with its PR.
  return db.transaction(() => {
    let opened = 0;
    for (const i of found) {
      const existed = db.prepare(`SELECT status FROM site_issues WHERE rule = ?`).get(i.id) as { status: IssueStatus } | undefined;
      upsert.run({
        rule: i.id,
        title: i.title,
        detail: i.detail,
        severity: i.severity,
        category: issueCategory(i),
        fix_type: issueFix(i),
        pages: JSON.stringify(i.pages.slice(0, 50)),
        count: i.count,
        at,
      });
      if (!existed || existed.status === "fixed") opened++;
    }
    const fixed = db
      .prepare(
        `UPDATE site_issues SET status = 'fixed', fixed_at = ?
         WHERE status IN ('open','in_pr') AND rule NOT IN (SELECT value FROM json_each(?))`,
      )
      .run(at, JSON.stringify(found.map((i) => i.id))).changes;
    return { opened, fixed };
  })();
}

const ORDER = `CASE status WHEN 'in_pr' THEN 0 WHEN 'open' THEN 1 WHEN 'fixed' THEN 2 ELSE 3 END,
  CASE severity WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END, count DESC, id`;

export function listIssues(db: DB): SiteIssue[] {
  return (db.prepare(`SELECT * FROM site_issues ORDER BY ${ORDER}`).all() as Raw[]).map(toIssue);
}

export function getIssue(db: DB, id: number): SiteIssue | null {
  const r = db.prepare(`SELECT * FROM site_issues WHERE id = ?`).get(id) as Raw | undefined;
  return r ? toIssue(r) : null;
}

export function setIssueStatus(db: DB, id: number, status: "open" | "dismissed"): void {
  db.prepare(`UPDATE site_issues SET status = ? WHERE id = ? AND status IN ('open','dismissed')`).run(status, id);
}

export const openIssues = (db: DB) => listIssues(db).filter((i) => i.status === "open" || i.status === "in_pr");
