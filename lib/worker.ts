import { getAccountsDb, listWorkspaceIds } from "./accounts";
import { getWorkspaceDb } from "./db";
import { workerIntervalMs } from "./env";
import { imapConfig, pollInbox } from "./imap";
import { sendConfig, smtpMailer } from "./mailer";
import { queueDueFollowups } from "./repo";
import { sendApproved } from "./send";
import { siteTick } from "./site/tick";

const g = globalThis as unknown as {
  __emoryWorker?: NodeJS.Timeout;
  __emoryBusy?: boolean;
  __emoryLastPoll?: number;
};

/**
 * Server-side sending and inbox polling use ONE mailbox from the environment,
 * so they only ever run for the single workspace named by SENDING_WORKSPACE_ID.
 * Every other workspace sends by copying approved drafts into its own mail app.
 */
const sendingWorkspaceId = () => {
  const n = Number(process.env.SENDING_WORKSPACE_ID);
  return Number.isInteger(n) && n > 0 ? n : null;
};

export function startWorker(): void {
  if (g.__emoryWorker) return;
  const tick = async () => {
    if (g.__emoryBusy) return;
    g.__emoryBusy = true;
    try {
      for (const id of listWorkspaceIds(getAccountsDb())) {
        const db = getWorkspaceDb(id);
        const n = queueDueFollowups(db);
        if (n > 0) console.log(`[worker] workspace ${id}: queued ${n} follow-up draft(s) for approval`);
        try {
          await siteTick(db);
        } catch (err) {
          console.error(`[worker] workspace ${id}: site tick failed`, err);
        }
      }

      const sendingId = sendingWorkspaceId();
      if (sendingId) {
        const db = getWorkspaceDb(sendingId);
        const cfg = sendConfig();
        if (cfg) {
          const { sent, failed } = await sendApproved(db, smtpMailer(cfg), cfg);
          if (sent || failed) console.log(`[worker] sent ${sent}, failed ${failed}`);
        }
        const imap = imapConfig();
        if (imap && Date.now() - (g.__emoryLastPoll ?? 0) >= imap.pollMs) {
          g.__emoryLastPoll = Date.now();
          try {
            const { logged } = await pollInbox(db, imap);
            if (logged) console.log(`[worker] logged ${logged} repl${logged === 1 ? "y" : "ies"}`);
          } catch (err) {
            console.error("[worker] inbox poll failed", err);
          }
        }
      }
    } catch (err) {
      console.error("[worker] tick failed", err);
    } finally {
      g.__emoryBusy = false;
    }
  };
  void tick();
  g.__emoryWorker = setInterval(tick, workerIntervalMs());
}
