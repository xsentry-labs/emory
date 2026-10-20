import type { DB } from "./db";

/**
 * The audit log: append-only (enforced by triggers), one row per thing Emory
 * did or a person decided. `actor` is "emory" or the person's email.
 */

export type AuditTrack = "site" | "leads" | "social" | "account";

export interface AuditEvent {
  id: number;
  at: number;
  actor: string;
  track: AuditTrack;
  action: string;
  target: string;
  approved_by: string;
}

export const EMORY = "emory";

export function logEvent(
  db: DB,
  e: { actor?: string; track: AuditTrack; action: string; target?: string; approvedBy?: string; at?: number },
): void {
  db.prepare(`INSERT INTO audit_log (at, actor, track, action, target, approved_by) VALUES (?, ?, ?, ?, ?, ?)`).run(
    e.at ?? Date.now(),
    (e.actor ?? EMORY).slice(0, 320),
    e.track,
    e.action.slice(0, 200),
    (e.target ?? "").slice(0, 400),
    (e.approvedBy ?? "").slice(0, 320),
  );
}

export function listEvents(db: DB, filter: { track?: AuditTrack; actor?: "people" | "emory"; limit?: number; since?: number } = {}): AuditEvent[] {
  const where: string[] = [];
  const args: unknown[] = [];
  if (filter.track) (where.push("track = ?"), args.push(filter.track));
  if (filter.actor === "emory") where.push("actor = 'emory'");
  if (filter.actor === "people") where.push("actor <> 'emory'");
  if (filter.since) (where.push("at >= ?"), args.push(filter.since));
  return db
    .prepare(`SELECT * FROM audit_log ${where.length ? `WHERE ${where.join(" AND ")}` : ""} ORDER BY at DESC, id DESC ${filter.limit ? `LIMIT ${Math.floor(filter.limit)}` : ""}`)
    .all(...args) as AuditEvent[];
}

const cell = (v: string | number) => {
  const s = String(v);
  // Quote, and defuse spreadsheet formulas.
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return `"${safe.replace(/"/g, '""')}"`;
};

export function eventsCsv(events: AuditEvent[]): string {
  const rows = events.map((e) => [new Date(e.at).toISOString(), e.actor, e.track, e.action, e.target, e.approved_by].map(cell).join(","));
  return ["time,actor,track,action,target,approved_by", ...rows].join("\n") + "\n";
}

export interface AuditTotals {
  prs: number;
  prsMerged: number;
  sent: number;
  sendFailed: number;
  approvals: number;
  contacts: number;
  deletions: number;
}

export function auditTotals(db: DB, since: number): AuditTotals {
  const n = (sql: string, ...a: unknown[]) => (db.prepare(sql).get(...a) as { n: number }).n;
  return {
    prs: n(`SELECT COUNT(*) AS n FROM site_prs WHERE created_at >= ? AND status <> 'failed'`, since),
    prsMerged: n(`SELECT COUNT(*) AS n FROM site_prs WHERE merged_at >= ?`, since),
    sent: n(`SELECT COUNT(*) AS n FROM messages WHERE status = 'sent' AND sent_at >= ?`, since),
    sendFailed: n(`SELECT COUNT(*) AS n FROM messages WHERE status = 'approved' AND send_error <> '' AND decided_at >= ?`, since),
    approvals: n(`SELECT COUNT(*) AS n FROM audit_log WHERE actor <> 'emory' AND action LIKE 'approved%' AND at >= ?`, since),
    contacts: n(`SELECT COUNT(*) AS n FROM prospects`),
    deletions: n(`SELECT COUNT(*) AS n FROM audit_log WHERE action = 'deleted contact' AND at >= ?`, since),
  };
}
