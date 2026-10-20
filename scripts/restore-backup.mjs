#!/usr/bin/env node
// Restore the latest backup (or a given one) into DATA_DIR.
//
//   DATA_DIR=/data BACKUP_S3_BUCKET=... BACKUP_S3_ACCESS_KEY_ID=... BACKUP_S3_SECRET_ACCESS_KEY=... \
//   [BACKUP_S3_ENDPOINT=...] [BACKUP_ENCRYPTION_KEY=...] node scripts/restore-backup.mjs [--stamp <stamp>] [--force]
//
// Stop the app first: restoring under a running server corrupts nothing on
// disk, but the server would keep using its open handles to the old files.
import path from "node:path";
import { backupConfig, restore } from "../lib/backup-core.mjs";

const args = process.argv.slice(2);
const stampAt = args.indexOf("--stamp");
const stamp = stampAt >= 0 ? args[stampAt + 1] : undefined;
const force = args.includes("--force");
const cfg = backupConfig();
if (!cfg) {
  console.error("Set BACKUP_S3_BUCKET, BACKUP_S3_ACCESS_KEY_ID and BACKUP_S3_SECRET_ACCESS_KEY.");
  process.exit(1);
}
const dataDir = path.resolve(process.env.DATA_DIR || "./data");
try {
  const r = await restore({ dataDir, cfg, stamp, force });
  console.log(`Restored ${r.files} database(s) from ${r.stamp} into ${dataDir}.`);
} catch (err) {
  console.error(`Restore failed: ${err instanceof Error ? err.message : err}`);
  process.exit(1);
}
