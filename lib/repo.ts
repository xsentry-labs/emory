import type { DB } from "./db";
import { scoreLead, type Qualification } from "./qualify";
import type { Message, MessageKind, Profile, Prospect, ProspectStatus } from "./types";

const now = () => Date.now();
const DAY = 24 * 60 * 60 * 1000;

export const FOLLOWUP_DELAY_MS = 3 * DAY;

export function createProspect(
  db: DB,
  input: { name: string; company?: string; email?: string; website?: string; notes?: string; source?: string },
): number {
  const t = now();
  const r = db
    .prepare(
      `INSERT INTO prospects (name, company, email, website, notes, source, created_at, updated_at)
       VALUES (@name, @company, @email, @website, @notes, @source, @t, @t)`,
    )
    .run({ company: "", email: "", website: "", notes: "", source: "", ...input, t });
  return Number(r.lastInsertRowid);
}

export function listProspects(db: DB): (Prospect & { pending: number })[] {
  return db
    .prepare(
      `SELECT p.*, (SELECT COUNT(*) FROM messages m WHERE m.prospect_id = p.id AND m.status = 'draft') AS pending
       FROM prospects p ORDER BY p.score IS NULL, p.score DESC, p.updated_at DESC`,
    )
    .all() as (Prospect & { pending: number })[];
}

export function getProspect(db: DB, id: number): Prospect | undefined {
  return db.prepare(`SELECT * FROM prospects WHERE id = ?`).get(id) as Prospect | undefined;
}

/** Moving a lead out of active outreach also stops its follow-up clock. */
export function setProspectStatus(db: DB, id: number, status: ProspectStatus): void {
  const stop = ["replied", "meeting", "won", "lost"].includes(status);
  db.prepare(
    `UPDATE prospects SET status = ?, next_followup_at = CASE WHEN ? THEN NULL ELSE next_followup_at END, updated_at = ? WHERE id = ?`,
  ).run(status, stop ? 1 : 0, now(), id);
}

export function getProfile(db: DB): Profile {
  return db.prepare(`SELECT offer, icp FROM profile WHERE id = 1`).get() as Profile;
}

export function saveProfile(db: DB, p: Profile): void {
  db.prepare(`UPDATE profile SET offer = ?, icp = ? WHERE id = 1`).run(p.offer, p.icp);
}

/** Store the five qualification inputs and the derived 0-100 score. */
export function saveQualification(db: DB, id: number, q: Qualification): void {
  const { score } = scoreLead(q);
  db.prepare(
    `UPDATE prospects SET icp_fit = @icp_fit, bant_budget = @budget, bant_authority = @authority,
       bant_need = @need, bant_timing = @timing, score = @score,
       status = CASE WHEN status IN ('new','researching') AND @score >= 40 THEN 'qualified' ELSE status END,
       updated_at = @t WHERE id = @id`,
  ).run({ id, icp_fit: q.icpFit, budget: q.budget, authority: q.authority, need: q.need, timing: q.timing, score, t: now() });
}

export function listMessages(db: DB, prospectId: number): Message[] {
  return db
    .prepare(`SELECT * FROM messages WHERE prospect_id = ? ORDER BY created_at, id`)
    .all(prospectId) as Message[];
}

export function createDraft(
  db: DB,
  input: { prospectId: number; kind: Exclude<MessageKind, "reply">; subject: string; body: string },
): number {
  const t = now();
  const r = db
    .prepare(
      `INSERT INTO messages (prospect_id, direction, kind, subject, body, status, created_at)
       VALUES (?, 'outbound', ?, ?, ?, 'draft', ?)`,
    )
    .run(input.prospectId, input.kind, input.subject, input.body, t);
  db.prepare(`UPDATE prospects SET updated_at = ? WHERE id = ?`).run(t, input.prospectId);
  return Number(r.lastInsertRowid);
}

export function listPendingApprovals(db: DB): (Message & { prospect_name: string; company: string })[] {
  return db
    .prepare(
      `SELECT m.*, p.name AS prospect_name, p.company AS company
       FROM messages m JOIN prospects p ON p.id = m.prospect_id
       WHERE m.status = 'draft' ORDER BY m.created_at, m.id`,
    )
    .all() as (Message & { prospect_name: string; company: string })[];
}

/**
 * Human approval gate. Only drafts can be decided. Approving marks the message
 * ready for the sender (not wired yet) and starts the follow-up clock.
 * Returns false if the message was not a pending draft.
 */
export function decideDraft(
  db: DB,
  id: number,
  decision: "approved" | "rejected",
  edits?: { subject: string; body: string },
): boolean {
  return db.transaction(() => {
    const m = db.prepare(`SELECT * FROM messages WHERE id = ? AND status = 'draft'`).get(id) as
      | Message
      | undefined;
    if (!m) return false;
    const t = now();
    db.prepare(
      `UPDATE messages SET status = ?, decided_at = ?, subject = ?, body = ? WHERE id = ?`,
    ).run(decision, t, edits?.subject ?? m.subject, edits?.body ?? m.body, id);
    if (decision === "approved") {
      db.prepare(
        `UPDATE prospects SET status = CASE WHEN status IN ('new','researching','qualified') THEN 'contacted' ELSE status END,
           next_followup_at = ?, updated_at = ? WHERE id = ?`,
      ).run(t + FOLLOWUP_DELAY_MS, t, m.prospect_id);
    }
    return true;
  })();
}

/** Record an inbound reply: stops the follow-up clock and marks the prospect as replied. */
export function logReply(db: DB, prospectId: number, body: string): void {
  const t = now();
  db.transaction(() => {
    db.prepare(
      `INSERT INTO messages (prospect_id, direction, kind, subject, body, status, created_at)
       VALUES (?, 'inbound', 'reply', '', ?, 'received', ?)`,
    ).run(prospectId, body, t);
    db.prepare(
      `UPDATE prospects SET status = 'replied', next_followup_at = NULL, updated_at = ? WHERE id = ?`,
    ).run(t, prospectId);
  })();
}

/**
 * Worker step: for contacted prospects whose follow-up is due and who have no
 * draft already waiting, queue a follow-up draft for human approval.
 * Returns the number of drafts created. Never sends anything.
 */
export function queueDueFollowups(db: DB, at = now()): number {
  const due = db
    .prepare(
      `SELECT * FROM prospects p
       WHERE p.status = 'contacted' AND p.next_followup_at IS NOT NULL AND p.next_followup_at <= ?
         AND NOT EXISTS (SELECT 1 FROM messages m WHERE m.prospect_id = p.id AND m.status = 'draft')`,
    )
    .all(at) as Prospect[];
  for (const p of due) {
    db.transaction(() => {
      createDraft(db, {
        prospectId: p.id,
        kind: "followup",
        subject: "Following up",
        body: `Hi ${p.name.split(" ")[0]},\n\nJust following up on my earlier note. Happy to share how we could help ${p.company || "your team"} win more clients, if useful.\n\nBest`,
      });
      db.prepare(`UPDATE prospects SET next_followup_at = NULL WHERE id = ?`).run(p.id);
    })();
  }
  return due.length;
}
