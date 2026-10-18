import type { DB } from "./db";
import { fromHeader, type Mailer, type SendConfig } from "./mailer";
import type { Message, Prospect } from "./types";

export const MAX_SEND_ATTEMPTS = 3;
const DAY = 24 * 60 * 60 * 1000;
const EMAIL_RE = /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/;
// A follow-up must not go out once the lead has replied or the conversation is closed.
const STOPPED = new Set(["replied", "meeting", "won", "lost"]);

type Row = Message & { email: string; email_status: Prospect["email_status"]; prospect_status: Prospect["status"] };

/**
 * Send messages a human has approved. Rate-limited by a rolling 24h cap, retries
 * a failing message up to MAX_SEND_ATTEMPTS, threads follow-ups onto the earlier
 * emails, and never sends to leads without a valid address or who already replied.
 */
export async function sendApproved(
  db: DB,
  mailer: Mailer,
  cfg: SendConfig,
  at = Date.now(),
): Promise<{ sent: number; failed: number }> {
  const sentRecently = (
    db
      .prepare(`SELECT COUNT(*) AS n FROM messages WHERE status = 'sent' AND direction = 'outbound' AND sent_at > ?`)
      .get(at - DAY) as { n: number }
  ).n;
  const budget = cfg.dailyCap - sentRecently;
  if (budget <= 0) return { sent: 0, failed: 0 };

  const rows = db
    .prepare(
      `SELECT m.*, p.email AS email, p.email_status AS email_status, p.status AS prospect_status
       FROM messages m JOIN prospects p ON p.id = m.prospect_id
       WHERE m.status = 'approved' AND m.direction = 'outbound' AND m.send_attempts < ?
       ORDER BY m.decided_at, m.id LIMIT ?`,
    )
    .all(MAX_SEND_ATTEMPTS, budget) as Row[];

  let sent = 0;
  let failed = 0;
  /** Mark a message as permanently unsendable (never retried). */
  const giveUp = (id: number, error: string) =>
    db.prepare(`UPDATE messages SET send_error = ?, send_attempts = ? WHERE id = ?`).run(error, MAX_SEND_ATTEMPTS, id);

  for (const m of rows) {
    if (!EMAIL_RE.test(m.email.trim())) {
      giveUp(m.id, "Lead has no valid email address.");
      failed++;
      continue;
    }
    // Guessed or unavailable addresses bounce and hurt the sender's reputation; never send to them.
    if (m.email_status === "guessed" || m.email_status === "unavailable") {
      giveUp(m.id, "Not sent: this email isn't verified. Verify it or enter one you know.");
      failed++;
      continue;
    }
    if (m.kind === "followup" && STOPPED.has(m.prospect_status)) {
      giveUp(m.id, `Not sent: lead is ${m.prospect_status}.`);
      failed++;
      continue;
    }
    const prior = db
      .prepare(
        `SELECT message_id FROM messages
         WHERE prospect_id = ? AND direction = 'outbound' AND status = 'sent' AND message_id != ''
         ORDER BY sent_at, id`,
      )
      .all(m.prospect_id) as { message_id: string }[];
    const ids = prior.map((r) => r.message_id);

    // Count the attempt before sending so a crash mid-send can't loop forever.
    db.prepare(`UPDATE messages SET send_attempts = send_attempts + 1 WHERE id = ?`).run(m.id);
    try {
      const text = cfg.footer ? `${m.body}\n\n--\n${cfg.footer}` : m.body;
      const { messageId } = await mailer({
        to: m.email.trim(),
        from: fromHeader(cfg),
        subject: m.subject || "(no subject)",
        text,
        inReplyTo: ids.length ? ids[ids.length - 1] : undefined,
        references: ids.length ? ids : undefined,
      });
      db.prepare(
        `UPDATE messages SET status = 'sent', sent_at = ?, message_id = ?, send_error = '' WHERE id = ?`,
      ).run(Date.now(), messageId, m.id);
      sent++;
    } catch (err) {
      db.prepare(`UPDATE messages SET send_error = ? WHERE id = ?`).run(
        (err instanceof Error ? err.message : "Send failed").slice(0, 300),
        m.id,
      );
      failed++;
    }
  }
  return { sent, failed };
}
