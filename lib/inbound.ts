import type { DB } from "./db";
import { logReply } from "./repo";

export interface InboundEmail {
  messageId: string;
  inReplyTo: string;
  references: string[];
  /** Sender address, lower-cased. */
  from: string;
  text: string;
  /** True for auto-replies, out-of-office notices and delivery reports. */
  automated: boolean;
}

export type IngestResult = "logged" | "duplicate" | "unmatched" | "ignored";

const SYSTEM_SENDER = /^(mailer-daemon|postmaster|no-?reply|do-?not-?reply)@/i;
const QUOTE_START = [/^On .{5,200} wrote:\s*$/i, /^-{2,}\s*Original Message\s*-{2,}/i, /^_{5,}\s*$/, /^From:\s.+/];

/** Drop the quoted earlier thread so only what the lead wrote remains. */
export function stripQuoted(text: string, maxChars = 10_000): string {
  const kept: string[] = [];
  for (const line of text.replace(/\r\n/g, "\n").split("\n")) {
    if (kept.some((l) => l.trim()) && QUOTE_START.some((re) => re.test(line.trim()))) break;
    if (line.startsWith(">")) continue;
    kept.push(line);
  }
  const out = kept.join("\n").trim();
  return (out || text.trim()).slice(0, maxChars);
}

function findProspectId(db: DB, mail: InboundEmail): number | undefined {
  const ids = [mail.inReplyTo, ...mail.references].filter(Boolean);
  if (ids.length) {
    const row = db
      .prepare(
        `SELECT prospect_id FROM messages
         WHERE direction = 'outbound' AND message_id IN (${ids.map(() => "?").join(",")}) LIMIT 1`,
      )
      .get(...ids) as { prospect_id: number } | undefined;
    if (row) return row.prospect_id;
  }
  const byEmail = db
    .prepare(`SELECT id FROM prospects WHERE lower(trim(email)) = ? AND email != '' ORDER BY updated_at DESC LIMIT 1`)
    .get(mail.from) as { id: number } | undefined;
  return byEmail?.id;
}

/**
 * Record an inbound email as a reply on the matching lead (threaded by
 * In-Reply-To/References, else by sender address). Skips automated mail,
 * system senders, our own address and duplicates. A logged reply stops
 * follow-ups for the lead.
 */
export function ingestReply(db: DB, mail: InboundEmail, ownEmail = ""): IngestResult {
  if (mail.automated || SYSTEM_SENDER.test(mail.from) || (ownEmail && mail.from === ownEmail.toLowerCase())) {
    return "ignored";
  }
  if (
    mail.messageId &&
    db.prepare(`SELECT 1 FROM messages WHERE direction = 'inbound' AND message_id = ?`).get(mail.messageId)
  ) {
    return "duplicate";
  }
  const prospectId = findProspectId(db, mail);
  if (prospectId === undefined) return "unmatched";
  logReply(db, prospectId, stripQuoted(mail.text), mail.messageId);
  return "logged";
}

export function getKv(db: DB, key: string): string | undefined {
  return (db.prepare(`SELECT value FROM kv WHERE key = ?`).get(key) as { value: string } | undefined)?.value;
}

export function setKv(db: DB, key: string, value: string): void {
  db.prepare(`INSERT INTO kv (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`).run(
    key,
    value,
  );
}
