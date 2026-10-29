import { createHash, randomBytes } from "node:crypto";
import type Database from "better-sqlite3";
import { hashPassword, normalizeEmail, validPassword, verifyPassword, type Account } from "./accounts";

/**
 * Account lifecycle on top of accounts.ts: one-time links (password reset,
 * email verification), sessions that can be revoked, teammates, and deletion.
 * Links carry a random token; only its SHA-256 is stored, so a leaked
 * database can't be used to reset anyone's password.
 */

type DB = Database.Database;

const HOUR = 60 * 60_000;
export const RESET_TTL_MS = HOUR;
export const VERIFY_TTL_MS = 7 * 24 * HOUR;
export const INVITE_TTL_MS = 7 * 24 * HOUR;
const EMAIL_RE = /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/;

const newToken = () => randomBytes(32).toString("base64url");
const hashToken = (t: string) => createHash("sha256").update(t).digest("hex");

export interface UserRow {
  id: number;
  email: string;
  workspace_id: number;
  role: "owner" | "member";
  email_verified_at: number | null;
  session_version: number;
  created_at: number;
}

export const getUser = (db: DB, id: number): UserRow | undefined =>
  db.prepare(`SELECT id, email, workspace_id, role, email_verified_at, session_version, created_at FROM users WHERE id = ?`).get(id) as UserRow | undefined;

/** True when a session's claims still match the user: same workspace, not revoked. */
export function sessionIsCurrent(db: DB, claims: { userId: number; workspaceId: number; version: number }): boolean {
  const u = getUser(db, claims.userId);
  return Boolean(u && u.workspace_id === claims.workspaceId && u.session_version === claims.version);
}

/** Sign out every session of this user (the caller re-issues one for the current device). */
export function revokeSessions(db: DB, userId: number): number {
  db.prepare(`UPDATE users SET session_version = session_version + 1 WHERE id = ?`).run(userId);
  return getUser(db, userId)?.session_version ?? 1;
}

function issue(db: DB, userId: number, purpose: "reset" | "verify", ttl: number, now: number): string {
  const token = newToken();
  // One live link per purpose: a new one replaces the old.
  db.prepare(`UPDATE auth_tokens SET used_at = ? WHERE user_id = ? AND purpose = ? AND used_at IS NULL`).run(now, userId, purpose);
  db.prepare(`INSERT INTO auth_tokens (user_id, purpose, token_hash, created_at, expires_at) VALUES (?, ?, ?, ?, ?)`).run(userId, purpose, hashToken(token), now, now + ttl);
  return token;
}

/** Use a link once. Returns the user id, or null if unknown, used or expired. */
function consume(db: DB, token: string, purpose: "reset" | "verify", now: number): number | null {
  if (!/^[\w-]{20,100}$/.test(token)) return null;
  const row = db.prepare(`SELECT id, user_id, expires_at, used_at FROM auth_tokens WHERE token_hash = ? AND purpose = ?`).get(hashToken(token), purpose) as
    | { id: number; user_id: number; expires_at: number; used_at: number | null }
    | undefined;
  if (!row || row.used_at !== null || row.expires_at < now) return null;
  db.prepare(`UPDATE auth_tokens SET used_at = ? WHERE id = ?`).run(now, row.id);
  return row.user_id;
}

/** A reset link for this email, or null when there's no such account (the caller must not say which). */
export function startPasswordReset(db: DB, emailInput: string, now = Date.now()): { token: string; email: string } | null {
  const u = db.prepare(`SELECT id, email FROM users WHERE email = ?`).get(normalizeEmail(emailInput)) as { id: number; email: string } | undefined;
  return u ? { token: issue(db, u.id, "reset", RESET_TTL_MS, now), email: u.email } : null;
}

/** Set a new password from a reset link. Signs out every session. Opening the link also proves the email. */
export function finishPasswordReset(db: DB, token: string, password: string, now = Date.now()): Account {
  validPassword(password);
  const userId = consume(db, token, "reset", now);
  if (!userId) throw new Error("That reset link has expired or was already used. Ask for a new one.");
  db.prepare(`UPDATE users SET password_hash = ?, email_verified_at = COALESCE(email_verified_at, ?), session_version = session_version + 1 WHERE id = ?`).run(
    hashPassword(password),
    now,
    userId,
  );
  const u = getUser(db, userId)!;
  return { userId: u.id, workspaceId: u.workspace_id, email: u.email };
}

export function changePassword(db: DB, userId: number, current: string, next: string): number {
  const row = db.prepare(`SELECT password_hash FROM users WHERE id = ?`).get(userId) as { password_hash: string } | undefined;
  if (!row || !verifyPassword(current, row.password_hash)) throw new Error("Your current password isn't right.");
  validPassword(next);
  db.prepare(`UPDATE users SET password_hash = ?, session_version = session_version + 1 WHERE id = ?`).run(hashPassword(next), userId);
  return getUser(db, userId)!.session_version;
}

export function startVerification(db: DB, userId: number, now = Date.now()): string | null {
  const u = getUser(db, userId);
  return u && !u.email_verified_at ? issue(db, userId, "verify", VERIFY_TTL_MS, now) : null;
}

export function finishVerification(db: DB, token: string, now = Date.now()): boolean {
  const userId = consume(db, token, "verify", now);
  if (!userId) return false;
  db.prepare(`UPDATE users SET email_verified_at = COALESCE(email_verified_at, ?) WHERE id = ?`).run(now, userId);
  return true;
}

// --- team ------------------------------------------------------------------

export interface Member {
  id: number;
  email: string;
  role: "owner" | "member";
  verified: boolean;
  createdAt: number;
}

export function listMembers(db: DB, workspaceId: number): Member[] {
  return (db.prepare(`SELECT id, email, role, email_verified_at, created_at FROM users WHERE workspace_id = ? ORDER BY role = 'owner' DESC, id`).all(workspaceId) as {
    id: number;
    email: string;
    role: "owner" | "member";
    email_verified_at: number | null;
    created_at: number;
  }[]).map((r) => ({ id: r.id, email: r.email, role: r.role, verified: r.email_verified_at !== null, createdAt: r.created_at }));
}

export interface PendingInvite {
  id: number;
  email: string;
  createdAt: number;
  expiresAt: number;
}

export const listInvites = (db: DB, workspaceId: number, now = Date.now()): PendingInvite[] =>
  db
    .prepare(`SELECT id, email, created_at AS createdAt, expires_at AS expiresAt FROM invites WHERE workspace_id = ? AND accepted_at IS NULL AND expires_at > ? ORDER BY id DESC`)
    .all(workspaceId, now) as PendingInvite[];

const MAX_MEMBERS = 20;

/** An owner invites someone by email. Returns the token for the link. */
export function createInvite(db: DB, inviter: number, emailInput: string, now = Date.now()): { token: string; email: string; workspaceName: string } {
  const u = getUser(db, inviter);
  if (!u || u.role !== "owner") throw new Error("Only the workspace owner can invite people.");
  if (!u.email_verified_at) throw new Error("Verify your own email first.");
  const email = normalizeEmail(emailInput);
  if (!EMAIL_RE.test(email)) throw new Error("Enter a valid email address.");
  const existing = db.prepare(`SELECT workspace_id FROM users WHERE email = ?`).get(email) as { workspace_id: number } | undefined;
  if (existing) throw new Error(existing.workspace_id === u.workspace_id ? "They're already in this workspace." : "That email already has an Emory account in another workspace.");
  if (listMembers(db, u.workspace_id).length + listInvites(db, u.workspace_id, now).length >= MAX_MEMBERS) throw new Error(`A workspace can have up to ${MAX_MEMBERS} people.`);
  db.prepare(`DELETE FROM invites WHERE workspace_id = ? AND email = ? AND accepted_at IS NULL`).run(u.workspace_id, email);
  const token = newToken();
  db.prepare(`INSERT INTO invites (workspace_id, email, token_hash, invited_by, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?)`).run(
    u.workspace_id,
    email,
    hashToken(token),
    inviter,
    now,
    now + INVITE_TTL_MS,
  );
  const ws = db.prepare(`SELECT name FROM workspaces WHERE id = ?`).get(u.workspace_id) as { name: string };
  return { token, email, workspaceName: ws.name };
}

export function revokeInvite(db: DB, owner: number, inviteId: number): void {
  const u = getUser(db, owner);
  if (!u || u.role !== "owner") throw new Error("Only the workspace owner can do that.");
  db.prepare(`DELETE FROM invites WHERE id = ? AND workspace_id = ?`).run(inviteId, u.workspace_id);
}

export function findInvite(db: DB, token: string, now = Date.now()): { id: number; email: string; workspaceId: number; workspaceName: string } | null {
  if (!/^[\w-]{20,100}$/.test(token)) return null;
  const r = db
    .prepare(
      `SELECT i.id, i.email, i.workspace_id AS workspaceId, w.name AS workspaceName FROM invites i JOIN workspaces w ON w.id = i.workspace_id
       WHERE i.token_hash = ? AND i.accepted_at IS NULL AND i.expires_at > ?`,
    )
    .get(hashToken(token), now) as { id: number; email: string; workspaceId: number; workspaceName: string } | undefined;
  return r ?? null;
}

/** Join a workspace from an invite: creates the account. The invite link proves the email. */
export function acceptInvite(db: DB, token: string, password: string, now = Date.now()): Account {
  validPassword(password);
  return db.transaction((): Account => {
    const inv = findInvite(db, token, now);
    if (!inv) throw new Error("That invite has expired or was already used. Ask for a new one.");
    if (db.prepare(`SELECT 1 FROM users WHERE email = ?`).get(inv.email)) throw new Error("That email already has an account. Log in instead.");
    const userId = Number(
      db
        .prepare(`INSERT INTO users (email, password_hash, workspace_id, role, email_verified_at, created_at) VALUES (?, ?, ?, 'member', ?, ?)`)
        .run(inv.email, hashPassword(password), inv.workspaceId, now, now).lastInsertRowid,
    );
    db.prepare(`UPDATE invites SET accepted_at = ? WHERE id = ?`).run(now, inv.id);
    return { userId, workspaceId: inv.workspaceId, email: inv.email };
  })();
}

/** The owner removes a member. Their account is deleted and their sessions stop working. */
export function removeMember(db: DB, owner: number, memberId: number): void {
  const o = getUser(db, owner);
  const m = getUser(db, memberId);
  if (!o || o.role !== "owner") throw new Error("Only the workspace owner can remove people.");
  if (!m || m.workspace_id !== o.workspace_id) throw new Error("They aren't in this workspace.");
  if (m.id === o.id) throw new Error("You can't remove yourself; delete the workspace instead.");
  db.prepare(`DELETE FROM users WHERE id = ?`).run(memberId);
}

export interface Deletion {
  /** Workspace whose data files must now be deleted (owner deleting), or null (member leaving). */
  workspaceId: number | null;
  userIds: number[];
}

/**
 * Delete an account, confirmed with the password. A member's deletion removes
 * only them. The owner's deletes the whole workspace: every member, every
 * invite, and (by the caller) the workspace's data file.
 */
export function deleteAccount(db: DB, userId: number, password: string): Deletion {
  const row = db.prepare(`SELECT password_hash FROM users WHERE id = ?`).get(userId) as { password_hash: string } | undefined;
  const u = getUser(db, userId);
  if (!row || !u || !verifyPassword(password, row.password_hash)) throw new Error("That password isn't right.");
  return db.transaction((): Deletion => {
    if (u.role !== "owner") {
      db.prepare(`DELETE FROM users WHERE id = ?`).run(userId);
      return { workspaceId: null, userIds: [userId] };
    }
    const ids = (db.prepare(`SELECT id FROM users WHERE workspace_id = ?`).all(u.workspace_id) as { id: number }[]).map((r) => r.id);
    db.prepare(`DELETE FROM invites WHERE workspace_id = ?`).run(u.workspace_id);
    db.prepare(`UPDATE reports SET claimed_workspace_id = NULL WHERE claimed_workspace_id = ?`).run(u.workspace_id);
    db.prepare(`DELETE FROM users WHERE workspace_id = ?`).run(u.workspace_id);
    db.prepare(`DELETE FROM workspaces WHERE id = ?`).run(u.workspace_id);
    return { workspaceId: u.workspace_id, userIds: ids };
  })();
}
