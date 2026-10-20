import { logEvent } from "./audit";
import type { DB } from "./db";
import { suppress } from "./suppress";
import type { Prospect } from "./types";

/**
 * Delete a person on request: their record, messages and planned steps go.
 * Their address stays on the do-not-contact list (that list holds only the
 * address and why), so a later search can't add them back.
 */
export function deletePerson(db: DB, id: number, actor: string): boolean {
  const p = db.prepare(`SELECT * FROM prospects WHERE id = ?`).get(id) as Prospect | undefined;
  if (!p) return false;
  db.transaction(() => {
    if (p.email) suppress(db, "email", p.email, "deleted on request", actor);
    db.prepare(`UPDATE prospects SET reports_to = NULL WHERE reports_to = ?`).run(id);
    db.prepare(`DELETE FROM messages WHERE prospect_id = ?`).run(id);
    db.prepare(`DELETE FROM prospects WHERE id = ?`).run(id);
    // The log names no personal details beyond what's needed to show it happened.
    logEvent(db, { actor, track: "account", action: "deleted contact", target: `on request · record, messages and plans · ${p.company || "no company"}`, approvedBy: actor });
  })();
  return true;
}

/** What we hold about a person and where each piece came from, for "what do you have on me?" requests. */
export function personRecord(p: Prospect): { field: string; value: string; source: string }[] {
  const rows: { field: string; value: string; source: string }[] = [
    { field: "name", value: p.name, source: p.source || "added by hand" },
    { field: "company", value: p.company, source: p.source || "added by hand" },
    { field: "title", value: p.title, source: p.apollo_id ? "apollo" : "" },
    { field: "email", value: p.email, source: p.email_source === "apollo" ? `apollo · ${p.email_status}` : p.email ? "entered by hand" : "" },
    { field: "linkedin", value: p.linkedin_url, source: p.apollo_id ? "apollo" : p.linkedin_url ? "search result or by hand" : "" },
    { field: "website", value: p.website, source: p.source_url || "" },
    { field: "notes", value: p.notes ? `${p.notes.slice(0, 120)}${p.notes.length > 120 ? "…" : ""}` : "", source: "research or by hand" },
  ];
  return rows.filter((r) => r.value);
}
