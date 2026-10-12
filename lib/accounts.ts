import Database from "better-sqlite3";
import { randomBytes, scryptSync, timingSafeEqual, createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { dataDir } from "./env";

type DB = Database.Database;

const MIGRATIONS: string[] = [
  `
  CREATE TABLE workspaces (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    owner_user_id INTEGER,
    created_at INTEGER NOT NULL
  );
  CREATE TABLE users (
    id INTEGER PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    workspace_id INTEGER NOT NULL REFERENCES workspaces(id),
    created_at INTEGER NOT NULL
  );
  `,
];

export function openAccountsDb(file: string): DB {
  if (file !== ":memory:") fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new Database(file);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.pragma("busy_timeout = 5000");
  const current = db.pragma("user_version", { simple: true }) as number;
  for (let v = current; v < MIGRATIONS.length; v++) {
    db.transaction(() => {
      db.exec(MIGRATIONS[v]);
      db.pragma(`user_version = ${v + 1}`);
    })();
  }
  return db;
}

export const workspaceDbPath = (dir: string, id: number) => path.join(dir, "workspaces", `${id}.db`);

/**
 * Data from the single-user version lives in emory.db. Move it to workspace 1
 * (unowned) the first time accounts are set up; the first person to sign up
 * claims it, so nothing already collected is lost.
 */
export function adoptLegacyDb(db: DB, dir: string): boolean {
  const legacy = path.join(dir, "emory.db");
  const hasWorkspaces = (db.prepare(`SELECT COUNT(*) AS n FROM workspaces`).get() as { n: number }).n > 0;
  if (hasWorkspaces || !fs.existsSync(legacy)) return false;
  const target = workspaceDbPath(dir, 1);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  for (const suffix of ["", "-wal", "-shm"]) {
    if (fs.existsSync(legacy + suffix)) fs.renameSync(legacy + suffix, target + suffix);
  }
  db.prepare(`INSERT INTO workspaces (id, name, owner_user_id, created_at) VALUES (1, 'My workspace', NULL, ?)`).run(Date.now());
  return true;
}

const g = globalThis as unknown as { __emoryAccounts?: DB };

export function getAccountsDb(): DB {
  if (!g.__emoryAccounts) {
    const dir = dataDir();
    const db = openAccountsDb(path.join(dir, "accounts.db"));
    adoptLegacyDb(db, dir);
    g.__emoryAccounts = db;
  }
  return g.__emoryAccounts;
}

// --- passwords -----------------------------------------------------------

export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 64);
  return `scrypt$${salt.toString("hex")}$${hash.toString("hex")}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [scheme, saltHex, hashHex] = stored.split("$");
  if (scheme !== "scrypt" || !saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, "hex");
  const actual = scryptSync(password, Buffer.from(saltHex, "hex"), expected.length);
  return timingSafeEqual(actual, expected);
}

/** Constant-time check of a submitted invite code against the configured one. */
export function inviteCodeMatches(submitted: string, configured: string | undefined): boolean {
  if (!configured) return false;
  const a = createHash("sha256").update(submitted.trim()).digest();
  const b = createHash("sha256").update(configured.trim()).digest();
  return timingSafeEqual(a, b);
}

// --- accounts --------------------------------------------------------------

export interface Account {
  userId: number;
  workspaceId: number;
  email: string;
}

const EMAIL_RE = /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/;
export const normalizeEmail = (e: string) => e.trim().toLowerCase();

export function createAccount(db: DB, input: { email: string; password: string; workspaceName?: string }): Account {
  const email = normalizeEmail(input.email);
  if (!EMAIL_RE.test(email)) throw new Error("Enter a valid email address.");
  if (input.password.length < 8) throw new Error("Use a password of at least 8 characters.");
  if (db.prepare(`SELECT 1 FROM users WHERE email = ?`).get(email)) {
    throw new Error("An account with that email already exists. Log in instead.");
  }
  return db.transaction((): Account => {
    const t = Date.now();
    const unowned = db.prepare(`SELECT id FROM workspaces WHERE owner_user_id IS NULL ORDER BY id LIMIT 1`).get() as
      | { id: number }
      | undefined;
    const workspaceId =
      unowned?.id ??
      Number(
        db
          .prepare(`INSERT INTO workspaces (name, created_at) VALUES (?, ?)`)
          .run(input.workspaceName?.trim() || email.split("@")[0], t).lastInsertRowid,
      );
    const userId = Number(
      db
        .prepare(`INSERT INTO users (email, password_hash, workspace_id, created_at) VALUES (?, ?, ?, ?)`)
        .run(email, hashPassword(input.password), workspaceId, t).lastInsertRowid,
    );
    db.prepare(`UPDATE workspaces SET owner_user_id = ? WHERE id = ?`).run(userId, workspaceId);
    return { userId, workspaceId, email };
  })();
}

export function verifyLogin(db: DB, emailInput: string, password: string): Account | null {
  const email = normalizeEmail(emailInput);
  const row = db.prepare(`SELECT id, email, password_hash, workspace_id FROM users WHERE email = ?`).get(email) as
    | { id: number; email: string; password_hash: string; workspace_id: number }
    | undefined;
  // Hash even for unknown emails so response time doesn't reveal which exist.
  const ok = verifyPassword(password, row?.password_hash ?? "scrypt$00$00");
  return row && ok ? { userId: row.id, workspaceId: row.workspace_id, email: row.email } : null;
}

export function getAccount(db: DB, userId: number): Account | null {
  const row = db.prepare(`SELECT id, email, workspace_id FROM users WHERE id = ?`).get(userId) as
    | { id: number; email: string; workspace_id: number }
    | undefined;
  return row ? { userId: row.id, workspaceId: row.workspace_id, email: row.email } : null;
}

export function listWorkspaceIds(db: DB): number[] {
  return (db.prepare(`SELECT id FROM workspaces ORDER BY id`).all() as { id: number }[]).map((r) => r.id);
}

export interface WorkspaceSummary {
  id: number;
  name: string;
  ownerEmail: string | null;
  createdAt: number;
}

export function listWorkspaceSummaries(db: DB): WorkspaceSummary[] {
  return (
    db
      .prepare(
        `SELECT w.id, w.name, w.created_at AS createdAt, u.email AS ownerEmail
         FROM workspaces w LEFT JOIN users u ON u.id = w.owner_user_id ORDER BY w.id`,
      )
      .all() as WorkspaceSummary[]
  );
}
