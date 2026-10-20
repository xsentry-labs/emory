// Backups of every SQLite database (accounts.db + workspaces/*.db) to any
// S3-compatible bucket. Plain JS so scripts/restore-backup.mjs can run it
// without a build. The app calls it through lib/backup.ts.
//
// Each snapshot is a consistent online copy (SQLite's backup API, safe while
// the app writes), gzipped, then encrypted with AES-256-GCM when
// BACKUP_ENCRYPTION_KEY is set. Layout in the bucket:
//   <prefix><stamp>/accounts.db.gz[.enc]
//   <prefix><stamp>/workspaces/<id>.db.gz[.enc]
//   <prefix><stamp>/manifest.json
//   <prefix>latest.json            -> { stamp }

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { gunzipSync, gzipSync } from "node:zlib";
import { DeleteObjectsCommand, GetObjectCommand, ListObjectsV2Command, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import Database from "better-sqlite3";

const MAGIC_ENC = Buffer.from("EMB1");

/**
 * @typedef {{ bucket: string, region: string, endpoint: string | undefined, accessKeyId: string, secretAccessKey: string,
 *   prefix: string, encryptionKey: string, intervalMs: number, keepDays: number }} BackupConfig
 */

/**
 * Backup settings from the environment, or null when backups aren't configured.
 * @param {Record<string, string | undefined>} [env]
 * @returns {BackupConfig | null}
 */
export function backupConfig(env = process.env) {
  const bucket = env.BACKUP_S3_BUCKET?.trim();
  const accessKeyId = env.BACKUP_S3_ACCESS_KEY_ID?.trim();
  const secretAccessKey = env.BACKUP_S3_SECRET_ACCESS_KEY?.trim();
  if (!bucket || !accessKeyId || !secretAccessKey) return null;
  const minutes = Number(env.BACKUP_INTERVAL_MINUTES);
  const keep = Number(env.BACKUP_KEEP_DAYS);
  return {
    bucket,
    region: env.BACKUP_S3_REGION?.trim() || "auto",
    endpoint: env.BACKUP_S3_ENDPOINT?.trim() || undefined,
    accessKeyId,
    secretAccessKey,
    prefix: (env.BACKUP_PREFIX?.trim() || "emory/").replace(/^\/+/, ""),
    encryptionKey: env.BACKUP_ENCRYPTION_KEY?.trim() || "",
    intervalMs: (Number.isFinite(minutes) && minutes >= 5 ? minutes : 60) * 60_000,
    keepDays: Number.isFinite(keep) && keep >= 1 ? keep : 14,
  };
}

export function s3For(cfg) {
  return new S3Client({
    region: cfg.region,
    endpoint: cfg.endpoint,
    forcePathStyle: Boolean(cfg.endpoint),
    credentials: { accessKeyId: cfg.accessKeyId, secretAccessKey: cfg.secretAccessKey },
  });
}

const keyBytes = (material) => createHash("sha256").update(`emory-backup:${material}`).digest();

/** gzip, then encrypt if a key is given. */
/** @param {Buffer} buf @param {string} material @returns {Buffer} */
export function seal(buf, material) {
  const gz = gzipSync(buf);
  if (!material) return gz;
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", keyBytes(material), iv);
  const body = Buffer.concat([c.update(gz), c.final()]);
  return Buffer.concat([MAGIC_ENC, iv, c.getAuthTag(), body]);
}

/** @param {Buffer} buf @param {string} material @returns {Buffer} */
export function unseal(buf, material) {
  if (buf.subarray(0, 4).equals(MAGIC_ENC)) {
    if (!material) throw new Error("This backup is encrypted: set BACKUP_ENCRYPTION_KEY.");
    const d = createDecipheriv("aes-256-gcm", keyBytes(material), buf.subarray(4, 16));
    d.setAuthTag(buf.subarray(16, 32));
    return gunzipSync(Buffer.concat([d.update(buf.subarray(32)), d.final()]));
  }
  return gunzipSync(buf);
}

/** Database files under the data directory, relative paths. */
export function databaseFiles(dataDir) {
  const out = [];
  if (fs.existsSync(path.join(dataDir, "accounts.db"))) out.push("accounts.db");
  const ws = path.join(dataDir, "workspaces");
  if (fs.existsSync(ws)) for (const f of fs.readdirSync(ws).sort()) if (/^\d+\.db$/.test(f)) out.push(`workspaces/${f}`);
  return out;
}

const stampOf = (at) => new Date(at).toISOString().replace(/[:.]/g, "-");

/** Consistent copy of a live database, as bytes. */
async function snapshot(file) {
  const tmp = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "emory-bak-")), "copy.db");
  const db = new Database(file, { readonly: true, fileMustExist: true });
  try {
    await db.backup(tmp);
  } finally {
    db.close();
  }
  try {
    return fs.readFileSync(tmp);
  } finally {
    fs.rmSync(path.dirname(tmp), { recursive: true, force: true });
  }
}

/**
 * Snapshot every database and upload it, then point latest.json at it and
 * prune snapshots older than keepDays. Returns a summary.
 */
/** @param {{ dataDir: string, cfg: BackupConfig, s3?: S3Client, at?: number }} opts */
export async function backupAll({ dataDir, cfg, s3 = s3For(cfg), at = Date.now() }) {
  const stamp = stampOf(at);
  const ext = cfg.encryptionKey ? ".gz.enc" : ".gz";
  const files = databaseFiles(dataDir);
  const manifest = { stamp, at, encrypted: Boolean(cfg.encryptionKey), files: [] };
  for (const rel of files) {
    const raw = await snapshot(path.join(dataDir, rel));
    const body = seal(raw, cfg.encryptionKey);
    await s3.send(new PutObjectCommand({ Bucket: cfg.bucket, Key: `${cfg.prefix}${stamp}/${rel}${ext}`, Body: body, ContentType: "application/octet-stream" }));
    manifest.files.push({ path: rel, bytes: raw.length, sha256: createHash("sha256").update(raw).digest("hex") });
  }
  await s3.send(new PutObjectCommand({ Bucket: cfg.bucket, Key: `${cfg.prefix}${stamp}/manifest.json`, Body: JSON.stringify(manifest), ContentType: "application/json" }));
  // Written last, so "latest" always names a complete snapshot.
  await s3.send(new PutObjectCommand({ Bucket: cfg.bucket, Key: `${cfg.prefix}latest.json`, Body: JSON.stringify({ stamp, at }), ContentType: "application/json" }));
  const pruned = await prune({ cfg, s3, at });
  return { stamp, files: files.length, bytes: manifest.files.reduce((n, f) => n + f.bytes, 0), pruned };
}

async function listAll(s3, cfg, Prefix) {
  const keys = [];
  let ContinuationToken;
  do {
    const r = await s3.send(new ListObjectsV2Command({ Bucket: cfg.bucket, Prefix, ContinuationToken }));
    for (const o of r.Contents ?? []) if (o.Key) keys.push(o.Key);
    ContinuationToken = r.IsTruncated ? r.NextContinuationToken : undefined;
  } while (ContinuationToken);
  return keys;
}

/** Delete snapshots older than keepDays. Never touches the newest snapshot. */
/** @param {{ cfg: BackupConfig, s3?: S3Client, at?: number }} opts */
export async function prune({ cfg, s3 = s3For(cfg), at = Date.now() }) {
  const cutoff = stampOf(at - cfg.keepDays * 86_400_000);
  const keys = await listAll(s3, cfg, cfg.prefix);
  const stamps = [...new Set(keys.map((k) => k.slice(cfg.prefix.length).split("/")[0]).filter((s) => /^\d{4}-\d\d-\d\dT/.test(s)))].sort();
  const newest = stamps[stamps.length - 1];
  const old = new Set(stamps.filter((s) => s < cutoff && s !== newest));
  const doomed = keys.filter((k) => old.has(k.slice(cfg.prefix.length).split("/")[0]));
  for (let i = 0; i < doomed.length; i += 1000) {
    await s3.send(new DeleteObjectsCommand({ Bucket: cfg.bucket, Delete: { Objects: doomed.slice(i, i + 1000).map((Key) => ({ Key })) } }));
  }
  return old.size;
}

const bytesOf = async (body) => Buffer.from(await body.transformToByteArray());

/**
 * Download a snapshot (latest unless `stamp` is given) into dataDir. Refuses to
 * overwrite existing databases unless `force`. Verifies each file's checksum.
 */
/** @param {{ dataDir: string, cfg: BackupConfig, s3?: S3Client, stamp?: string, force?: boolean }} opts */
export async function restore({ dataDir, cfg, s3 = s3For(cfg), stamp, force = false }) {
  const use = stamp ?? JSON.parse((await bytesOf((await s3.send(new GetObjectCommand({ Bucket: cfg.bucket, Key: `${cfg.prefix}latest.json` }))).Body)).toString()).stamp;
  const manifest = JSON.parse((await bytesOf((await s3.send(new GetObjectCommand({ Bucket: cfg.bucket, Key: `${cfg.prefix}${use}/manifest.json` }))).Body)).toString());
  const existing = databaseFiles(dataDir);
  if (existing.length && !force) throw new Error(`${dataDir} already has ${existing.length} database(s). Stop the app and pass --force to overwrite.`);
  const ext = manifest.encrypted ? ".gz.enc" : ".gz";
  for (const f of manifest.files) {
    const raw = unseal(await bytesOf((await s3.send(new GetObjectCommand({ Bucket: cfg.bucket, Key: `${cfg.prefix}${use}/${f.path}${ext}` }))).Body), cfg.encryptionKey);
    if (createHash("sha256").update(raw).digest("hex") !== f.sha256) throw new Error(`Checksum mismatch for ${f.path}; not restored.`);
    const dest = path.join(dataDir, f.path);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    for (const suffix of ["-wal", "-shm"]) fs.rmSync(dest + suffix, { force: true });
    fs.writeFileSync(`${dest}.restoring`, raw);
    fs.renameSync(`${dest}.restoring`, dest);
  }
  return { stamp: use, files: manifest.files.length };
}
