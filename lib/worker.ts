import { getDb } from "./db";
import { workerIntervalMs } from "./env";
import { imapConfig, pollInbox } from "./imap";
import { sendConfig, smtpMailer } from "./mailer";
import { queueDueFollowups } from "./repo";
import { sendApproved } from "./send";

const g = globalThis as unknown as {
  __emoryWorker?: NodeJS.Timeout;
  __emoryBusy?: boolean;
  __emoryLastPoll?: number;
};

export function startWorker(): void {
  if (g.__emoryWorker) return;
  const tick = async () => {
    if (g.__emoryBusy) return;
    g.__emoryBusy = true;
    try {
      const db = getDb();
      const n = queueDueFollowups(db);
      if (n > 0) console.log(`[worker] queued ${n} follow-up draft(s) for approval`);
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
    } catch (err) {
      console.error("[worker] tick failed", err);
    } finally {
      g.__emoryBusy = false;
    }
  };
  void tick();
  g.__emoryWorker = setInterval(tick, workerIntervalMs());
}
