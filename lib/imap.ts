import { ImapFlow } from "imapflow";
import { simpleParser, type AddressObject } from "mailparser";
import type { DB } from "./db";
import { getKv, ingestReply, setKv, type InboundEmail } from "./inbound";

export interface ImapConfig {
  host: string;
  port: number;
  user: string;
  pass: string;
  secure: boolean;
  /** Our own address, so we never log our own mail as a reply. */
  ownEmail: string;
  pollMs: number;
}

export function imapConfig(env: NodeJS.ProcessEnv = process.env): ImapConfig | null {
  const host = env.IMAP_HOST?.trim();
  const user = env.IMAP_USER?.trim();
  const pass = env.IMAP_PASS;
  if (!host || !user || !pass) return null;
  const port = Number(env.IMAP_PORT) || 993;
  const poll = Number(env.IMAP_POLL_SECONDS);
  return {
    host,
    port,
    user,
    pass,
    secure: env.IMAP_SECURE ? env.IMAP_SECURE !== "false" : port === 993,
    ownEmail: (env.FROM_EMAIL ?? user).trim().toLowerCase(),
    pollMs: (Number.isFinite(poll) && poll >= 30 ? poll : 120) * 1000,
  };
}

const MAX_PER_POLL = 50;
const STATE_KEY = "imap_state";

interface State {
  uidValidity: string;
  lastUid: number;
}

function toInbound(parsed: Awaited<ReturnType<typeof simpleParser>>): InboundEmail {
  const from = (parsed.from as AddressObject | undefined)?.value?.[0]?.address ?? "";
  const refs = parsed.references;
  const auto = String(parsed.headers.get("auto-submitted") ?? "no").toLowerCase();
  const precedence = String(parsed.headers.get("precedence") ?? "").toLowerCase();
  return {
    messageId: parsed.messageId ?? "",
    inReplyTo: parsed.inReplyTo ?? "",
    references: Array.isArray(refs) ? refs : refs ? [refs] : [],
    from: from.toLowerCase(),
    text: parsed.text ?? "",
    automated: (auto !== "no" && auto !== "") || ["bulk", "junk", "auto_reply"].includes(precedence),
  };
}

/**
 * Poll the inbox for mail that arrived since the last poll and log replies to
 * our outreach. Tracks the last seen UID (it does not touch read/unread flags),
 * and on first run starts from "now" so old mail is not imported.
 */
export async function pollInbox(db: DB, cfg: ImapConfig): Promise<{ logged: number }> {
  const client = new ImapFlow({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    auth: { user: cfg.user, pass: cfg.pass },
    logger: false,
  });
  let logged = 0;
  await client.connect();
  try {
    const lock = await client.getMailboxLock("INBOX");
    try {
      const box = client.mailbox;
      if (!box) return { logged };
      const validity = String(box.uidValidity);
      const raw = getKv(db, STATE_KEY);
      const state: State | null = raw ? (JSON.parse(raw) as State) : null;
      if (!state || state.uidValidity !== validity) {
        setKv(db, STATE_KEY, JSON.stringify({ uidValidity: validity, lastUid: box.uidNext - 1 }));
        return { logged };
      }
      if (box.uidNext - 1 <= state.lastUid) return { logged };

      let lastUid = state.lastUid;
      let n = 0;
      for await (const msg of client.fetch(`${state.lastUid + 1}:*`, { uid: true, source: true }, { uid: true })) {
        if (msg.uid <= state.lastUid) continue; // "N:*" always includes the newest message
        if (n++ >= MAX_PER_POLL) break;
        if (msg.source) {
          const result = ingestReply(db, toInbound(await simpleParser(msg.source)), cfg.ownEmail);
          if (result === "logged") logged++;
        }
        lastUid = msg.uid;
        setKv(db, STATE_KEY, JSON.stringify({ uidValidity: validity, lastUid }));
      }
    } finally {
      lock.release();
    }
  } finally {
    await client.logout().catch(() => {});
  }
  return { logged };
}
