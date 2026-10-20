import { backupAll, backupConfig } from "./backup-core.mjs";
import { dataDir } from "./env";

/**
 * Scheduled backups (see backup-core.mjs for the format). Runs on its own
 * timer, separate from the worker, so a slow upload never delays sending.
 * Status is kept in memory for /api/health and /admin.
 */

export interface BackupStatus {
  configured: boolean;
  encrypted: boolean;
  lastOkAt: number | null;
  lastError: string;
  lastStamp: string;
  running: boolean;
}

const g = globalThis as unknown as { __emoryBackup?: { timer?: NodeJS.Timeout; status: BackupStatus } };
const state = () =>
  (g.__emoryBackup ??= {
    status: { configured: false, encrypted: false, lastOkAt: null, lastError: "", lastStamp: "", running: false },
  });

export const backupStatus = (): BackupStatus => ({ ...state().status });

export async function runBackupNow(): Promise<void> {
  const cfg = backupConfig();
  const s = state().status;
  if (!cfg || s.running) return;
  s.running = true;
  try {
    const r = await backupAll({ dataDir: dataDir(), cfg });
    s.lastOkAt = Date.now();
    s.lastStamp = r.stamp;
    s.lastError = "";
    console.log(`[backup] ${r.files} database(s), ${(r.bytes / 1e6).toFixed(1)} MB → ${cfg.bucket}/${cfg.prefix}${r.stamp}${r.pruned ? ` · pruned ${r.pruned} old` : ""}`);
  } catch (err) {
    s.lastError = (err instanceof Error ? err.message : String(err)).slice(0, 300);
    console.error("[backup] failed:", s.lastError);
  } finally {
    s.running = false;
  }
}

export function startBackups(): void {
  const cfg = backupConfig();
  const st = state();
  st.status.configured = Boolean(cfg);
  st.status.encrypted = Boolean(cfg?.encryptionKey);
  if (!cfg) {
    console.warn("[backup] OFF: set BACKUP_S3_BUCKET, BACKUP_S3_ACCESS_KEY_ID and BACKUP_S3_SECRET_ACCESS_KEY. Without backups, losing the volume loses every workspace.");
    return;
  }
  if (!cfg.encryptionKey) console.warn("[backup] BACKUP_ENCRYPTION_KEY is not set: snapshots are stored unencrypted (only the bucket's own encryption applies).");
  if (st.timer) return;
  // First run shortly after boot, then on the interval.
  setTimeout(() => void runBackupNow(), 60_000);
  st.timer = setInterval(() => void runBackupNow(), cfg.intervalMs);
}

/** Healthy unless backups are configured and the last success is older than two intervals. */
export function backupHealthy(now = Date.now()): boolean {
  const cfg = backupConfig();
  const s = state().status;
  if (!cfg) return true;
  const since = s.lastOkAt ?? bootedAt;
  return now - since < cfg.intervalMs * 2 + 5 * 60_000;
}

const bootedAt = Date.now();
