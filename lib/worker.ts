import { getDb } from "./db";
import { workerIntervalMs } from "./env";
import { queueDueFollowups } from "./repo";

const g = globalThis as unknown as { __emoryWorker?: NodeJS.Timeout };

export function startWorker(): void {
  if (g.__emoryWorker) return;
  const tick = () => {
    try {
      const n = queueDueFollowups(getDb());
      if (n > 0) console.log(`[worker] queued ${n} follow-up draft(s) for approval`);
    } catch (err) {
      console.error("[worker] tick failed", err);
    }
  };
  tick();
  g.__emoryWorker = setInterval(tick, workerIntervalMs());
}
