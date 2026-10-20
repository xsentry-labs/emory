import { EMORY, logEvent } from "./audit";
import type { DB } from "./db";

/**
 * Do not contact. An address or a whole domain, with the reason. Checked
 * before drafting and sending, and before adding people or companies, across
 * every track.
 */

export interface Suppression {
  id: number;
  kind: "email" | "domain";
  value: string;
  reason: string;
  created_at: number;
}

const norm = (s: string) => s.trim().toLowerCase().replace(/^www\./, "");
const domainOfEmail = (email: string) => norm(email.split("@")[1] ?? "");

export function suppress(db: DB, kind: Suppression["kind"], value: string, reason: string, actor = EMORY): boolean {
  const v = norm(value);
  if (!v || (kind === "email" && !v.includes("@"))) return false;
  const added = db.prepare(`INSERT OR IGNORE INTO suppressions (kind, value, reason, created_at) VALUES (?, ?, ?, ?)`).run(kind, v, reason.slice(0, 200), Date.now()).changes > 0;
  if (added) logEvent(db, { actor, track: "account", action: "suppressed", target: `${v} · ${reason}`, approvedBy: actor === EMORY ? "auto · rule" : "" });
  return added;
}

export function unsuppress(db: DB, id: number, actor: string): void {
  const row = db.prepare(`SELECT * FROM suppressions WHERE id = ?`).get(id) as Suppression | undefined;
  if (!row) return;
  db.prepare(`DELETE FROM suppressions WHERE id = ?`).run(id);
  logEvent(db, { actor, track: "account", action: "removed from do-not-contact", target: row.value });
}

export const listSuppressions = (db: DB): Suppression[] => db.prepare(`SELECT * FROM suppressions ORDER BY id DESC`).all() as Suppression[];

/** True when this address, or its domain, must not be contacted. */
export function isSuppressed(db: DB, email: string, website = ""): boolean {
  const e = norm(email);
  const domains = [e ? domainOfEmail(e) : "", website ? norm(website.replace(/^https?:\/\//, "").split("/")[0]) : ""].filter(Boolean);
  return Boolean(
    (e && db.prepare(`SELECT 1 FROM suppressions WHERE kind = 'email' AND value = ?`).get(e)) ||
      domains.some((d) => db.prepare(`SELECT 1 FROM suppressions WHERE kind = 'domain' AND value = ?`).get(d)),
  );
}

const OPT_OUT = /\b(unsubscribe|opt[\s-]?out|remove me|take me off|stop (emailing|contacting|sending)|do not (email|contact)|don'?t (email|contact) me|no more emails)\b/i;

/** A reply asking not to be contacted again. Deliberately narrow: a false "no" is worse than a missed one only by a little, and people can still mark it by hand. */
export const isOptOut = (text: string) => OPT_OUT.test(text.slice(0, 2000));
