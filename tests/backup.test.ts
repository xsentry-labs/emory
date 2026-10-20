import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";
import { backupAll, backupConfig, databaseFiles, prune, restore, seal, unseal } from "../lib/backup-core.mjs";

/** In-memory S3: just enough of Put/Get/List/Delete for the backup code. */
function fakeS3() {
  const store = new Map<string, Buffer>();
  const send = async (cmd: { constructor: { name: string }; input: Record<string, unknown> }) => {
    const i = cmd.input;
    switch (cmd.constructor.name) {
      case "PutObjectCommand":
        store.set(String(i.Key), Buffer.isBuffer(i.Body) ? (i.Body as Buffer) : Buffer.from(String(i.Body)));
        return {};
      case "GetObjectCommand": {
        const b = store.get(String(i.Key));
        if (!b) throw new Error(`NoSuchKey ${i.Key}`);
        return { Body: { transformToByteArray: async () => new Uint8Array(b) } };
      }
      case "ListObjectsV2Command":
        return { Contents: [...store.keys()].filter((k) => k.startsWith(String(i.Prefix ?? ""))).map((Key) => ({ Key })), IsTruncated: false };
      case "DeleteObjectsCommand":
        for (const o of (i.Delete as { Objects: { Key: string }[] }).Objects) store.delete(o.Key);
        return {};
      default:
        throw new Error(`unexpected ${cmd.constructor.name}`);
    }
  };
  return { store, s3: { send } as never };
}

const tmp: string[] = [];
const dir = () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "emory-bk-"));
  tmp.push(d);
  return d;
};
afterEach(() => tmp.splice(0).forEach((d) => fs.rmSync(d, { recursive: true, force: true })));

const ENV = { BACKUP_S3_BUCKET: "b", BACKUP_S3_ACCESS_KEY_ID: "k", BACKUP_S3_SECRET_ACCESS_KEY: "s", BACKUP_ENCRYPTION_KEY: "secret-key" };

function seedDataDir() {
  const d = dir();
  fs.mkdirSync(path.join(d, "workspaces"));
  const open: Database.Database[] = [];
  for (const [file, value] of [["accounts.db", "acct"], ["workspaces/1.db", "one"], ["workspaces/2.db", "two"]]) {
    const db = new Database(path.join(d, file));
    db.pragma("journal_mode = WAL");
    db.exec(`CREATE TABLE t (v TEXT); INSERT INTO t VALUES ('${value}')`);
    open.push(db); // left open, with data still in the WAL, like the running app
  }
  fs.writeFileSync(path.join(d, "workspaces", "notes.txt"), "not a database");
  return { d, open };
}

describe("backups", () => {
  it("is off until the bucket and keys are set", () => {
    expect(backupConfig({})).toBeNull();
    expect(backupConfig(ENV)).toMatchObject({ bucket: "b", prefix: "emory/", intervalMs: 3_600_000, keepDays: 14 });
  });

  it("seals with gzip and AES-GCM, and refuses tampered or keyless restores", () => {
    const data = Buffer.from("hello database");
    const sealed = seal(data, "k1");
    expect(sealed.subarray(0, 4).toString()).toBe("EMB1");
    expect(unseal(sealed, "k1").toString()).toBe("hello database");
    expect(() => unseal(sealed, "")).toThrow(/encrypted/);
    expect(() => unseal(sealed, "wrong")).toThrow();
    expect(unseal(seal(data, ""), "").toString()).toBe("hello database");
  });

  it("snapshots every database while open and restores them byte-identical in content", async () => {
    const { d, open } = seedDataDir();
    expect(databaseFiles(d)).toEqual(["accounts.db", "workspaces/1.db", "workspaces/2.db"]);
    const { s3, store } = fakeS3();
    const cfg = backupConfig(ENV)!;
    const r = await backupAll({ dataDir: d, cfg, s3, at: Date.parse("2026-10-20T10:00:00Z") });
    expect(r.files).toBe(3);
    expect([...store.keys()]).toContain("emory/latest.json");
    expect([...store.keys()].some((k) => k.endsWith("workspaces/2.db.gz.enc"))).toBe(true);
    // Nothing readable in the bucket.
    for (const [k, v] of store) if (k.endsWith(".enc")) expect(v.includes(Buffer.from("two"))).toBe(false);

    const target = dir();
    await restore({ dataDir: target, cfg, s3 });
    const back = new Database(path.join(target, "workspaces", "2.db"), { readonly: true });
    expect(back.prepare("SELECT v FROM t").get()).toEqual({ v: "two" });
    back.close();
    await expect(restore({ dataDir: target, cfg, s3 })).rejects.toThrow(/--force/);
    await restore({ dataDir: target, cfg, s3, force: true });
    open.forEach((db) => db.close());
  });

  it("prunes old snapshots but always keeps the newest", async () => {
    const { d, open } = seedDataDir();
    const { s3, store } = fakeS3();
    const cfg = { ...backupConfig(ENV)!, keepDays: 7 };
    const day = 86_400_000;
    const t0 = Date.parse("2026-10-01T00:00:00Z");
    await backupAll({ dataDir: d, cfg, s3, at: t0 });
    await backupAll({ dataDir: d, cfg, s3, at: t0 + 3 * day });
    await backupAll({ dataDir: d, cfg, s3, at: t0 + 10 * day });
    const stamps = () => new Set([...store.keys()].map((k) => k.split("/")[1]).filter((s) => s.startsWith("2026")));
    expect(stamps().size).toBe(2); // the 1st went; the 4th is within 7 days of the 11th
    expect(await prune({ cfg, s3, at: t0 + 100 * day })).toBe(1);
    expect(stamps().size).toBe(1);
    open.forEach((db) => db.close());
  });
});
