import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  RESET_TTL_MS,
  acceptInvite,
  changePassword,
  createInvite,
  deleteAccount,
  finishPasswordReset,
  finishVerification,
  findInvite,
  getUser,
  listInvites,
  listMembers,
  removeMember,
  revokeSessions,
  sessionIsCurrent,
  startPasswordReset,
  startVerification,
} from "../lib/account-admin";
import { createAccount, openAccountsDb, verifyLogin } from "../lib/accounts";
import { dropWorkspaceDb, getWorkspaceDb } from "../lib/db";

const setup = () => {
  const db = openAccountsDb(":memory:");
  const owner = createAccount(db, { email: "maya@loomwise.co", password: "longenough1", workspaceName: "Loomwise" });
  return { db, owner };
};
const claims = (db: ReturnType<typeof openAccountsDb>, userId: number) => {
  const u = getUser(db, userId)!;
  return { userId, workspaceId: u.workspace_id, version: u.session_version };
};

describe("password reset", () => {
  it("works once, within an hour, and signs out other sessions", () => {
    const { db, owner } = setup();
    const before = claims(db, owner.userId);
    expect(startPasswordReset(db, "nobody@x.co")).toBeNull();
    const r = startPasswordReset(db, " MAYA@loomwise.co ", 1_000)!;
    // Only a hash is stored.
    expect(JSON.stringify(db.prepare(`SELECT * FROM auth_tokens`).all())).not.toContain(r.token);

    expect(() => finishPasswordReset(db, r.token, "short", 2_000)).toThrow(/8 characters/);
    const account = finishPasswordReset(db, r.token, "brand-new-pass", 2_000);
    expect(account.userId).toBe(owner.userId);
    expect(verifyLogin(db, "maya@loomwise.co", "brand-new-pass")).not.toBeNull();
    expect(verifyLogin(db, "maya@loomwise.co", "longenough1")).toBeNull();
    expect(sessionIsCurrent(db, before)).toBe(false);
    expect(getUser(db, owner.userId)?.email_verified_at).toBe(2_000);
    expect(() => finishPasswordReset(db, r.token, "another-pass", 3_000)).toThrow(/expired or was already used/);
  });

  it("expires, and a new link replaces the old one", () => {
    const { db } = setup();
    const old = startPasswordReset(db, "maya@loomwise.co", 0)!;
    expect(() => finishPasswordReset(db, old.token, "brand-new-pass", RESET_TTL_MS + 1)).toThrow();
    const a = startPasswordReset(db, "maya@loomwise.co", 10)!;
    const b = startPasswordReset(db, "maya@loomwise.co", 20)!;
    expect(() => finishPasswordReset(db, a.token, "brand-new-pass", 30)).toThrow();
    expect(finishPasswordReset(db, b.token, "brand-new-pass", 30).email).toBe("maya@loomwise.co");
  });
});

describe("sessions", () => {
  it("are revoked by a password change or an explicit sign-out-everywhere", () => {
    const { db, owner } = setup();
    const c1 = claims(db, owner.userId);
    expect(sessionIsCurrent(db, c1)).toBe(true);
    expect(() => changePassword(db, owner.userId, "wrong", "brand-new-pass")).toThrow(/current password/);
    changePassword(db, owner.userId, "longenough1", "brand-new-pass");
    expect(sessionIsCurrent(db, c1)).toBe(false);
    const c2 = claims(db, owner.userId);
    revokeSessions(db, owner.userId);
    expect(sessionIsCurrent(db, c2)).toBe(false);
    expect(sessionIsCurrent(db, { ...claims(db, owner.userId), workspaceId: 999 })).toBe(false);
  });
});

describe("email verification", () => {
  it("verifies once and stops issuing links after", () => {
    const { db, owner } = setup();
    const t = startVerification(db, owner.userId)!;
    expect(finishVerification(db, "not-a-real-token-at-all-xx")).toBe(false);
    expect(finishVerification(db, t)).toBe(true);
    expect(finishVerification(db, t)).toBe(false);
    expect(getUser(db, owner.userId)?.email_verified_at).not.toBeNull();
    expect(startVerification(db, owner.userId)).toBeNull();
  });
});

describe("teammates", () => {
  const verified = () => {
    const s = setup();
    finishVerification(s.db, startVerification(s.db, s.owner.userId)!);
    return s;
  };

  it("needs a verified owner and a fresh email", () => {
    const { db, owner } = setup();
    expect(() => createInvite(db, owner.userId, "ann@loomwise.co")).toThrow(/Verify your own email/);
    finishVerification(db, startVerification(db, owner.userId)!);
    expect(() => createInvite(db, owner.userId, "maya@loomwise.co")).toThrow(/already in this workspace/);
    createAccount(db, { email: "other@x.co", password: "longenough1" });
    expect(() => createInvite(db, owner.userId, "other@x.co")).toThrow(/another workspace/);
    expect(() => createInvite(db, owner.userId, "nope")).toThrow(/valid email/);
  });

  it("joins the inviter's workspace as a verified member, once", () => {
    const { db, owner } = verified();
    const inv = createInvite(db, owner.userId, "Ann@Loomwise.co", 1_000);
    expect(inv).toMatchObject({ email: "ann@loomwise.co", workspaceName: "Loomwise" });
    expect(listInvites(db, owner.workspaceId, 1_000)).toHaveLength(1);
    expect(findInvite(db, inv.token, 1_000)?.workspaceId).toBe(owner.workspaceId);
    const ann = acceptInvite(db, inv.token, "anns-password", 2_000);
    expect(ann.workspaceId).toBe(owner.workspaceId);
    expect(getUser(db, ann.userId)).toMatchObject({ role: "member", email_verified_at: 2_000 });
    expect(() => acceptInvite(db, inv.token, "anns-password", 3_000)).toThrow(/expired or was already used/);
    expect(listMembers(db, owner.workspaceId).map((m) => [m.email, m.role])).toEqual([
      ["maya@loomwise.co", "owner"],
      ["ann@loomwise.co", "member"],
    ]);
    // Members can't invite or remove.
    expect(() => createInvite(db, ann.userId, "bob@x.co")).toThrow(/Only the workspace owner/);
    expect(() => removeMember(db, ann.userId, owner.userId)).toThrow(/Only the workspace owner/);
  });

  it("expired invites don't work; removed members are signed out", () => {
    const { db, owner } = verified();
    const old = createInvite(db, owner.userId, "old@x.co", 0);
    expect(() => acceptInvite(db, old.token, "anns-password", 8 * 86_400_000)).toThrow();
    const inv = createInvite(db, owner.userId, "ann@x.co");
    const ann = acceptInvite(db, inv.token, "anns-password");
    const session = claims(db, ann.userId);
    expect(() => removeMember(db, owner.userId, owner.userId)).toThrow(/yourself/);
    removeMember(db, owner.userId, ann.userId);
    expect(sessionIsCurrent(db, session)).toBe(false);
    expect(verifyLogin(db, "ann@x.co", "anns-password")).toBeNull();
  });
});

describe("deleting an account", () => {
  const tmp: string[] = [];
  afterEach(() => {
    delete process.env.DATA_DIR;
    tmp.splice(0).forEach((d) => fs.rmSync(d, { recursive: true, force: true }));
  });

  it("a member removes only themselves", () => {
    const { db, owner } = setup();
    finishVerification(db, startVerification(db, owner.userId)!);
    const ann = acceptInvite(db, createInvite(db, owner.userId, "ann@x.co").token, "anns-password");
    expect(() => deleteAccount(db, ann.userId, "wrong")).toThrow(/password/);
    expect(deleteAccount(db, ann.userId, "anns-password")).toEqual({ workspaceId: null, userIds: [ann.userId] });
    expect(listMembers(db, owner.workspaceId)).toHaveLength(1);
  });

  it("the owner deletes the workspace, every member, and its data file", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "emory-del-"));
    tmp.push(dir);
    process.env.DATA_DIR = dir;
    const { db, owner } = setup();
    finishVerification(db, startVerification(db, owner.userId)!);
    const ann = acceptInvite(db, createInvite(db, owner.userId, "ann@x.co").token, "anns-password");
    getWorkspaceDb(owner.workspaceId).prepare(`SELECT 1`).get();
    const file = path.join(dir, "workspaces", `${owner.workspaceId}.db`);
    expect(fs.existsSync(file)).toBe(true);

    const d = deleteAccount(db, owner.userId, "longenough1");
    expect(d.workspaceId).toBe(owner.workspaceId);
    expect(d.userIds.sort()).toEqual([owner.userId, ann.userId].sort());
    dropWorkspaceDb(d.workspaceId!);
    expect(fs.existsSync(file)).toBe(false);
    expect(getUser(db, ann.userId)).toBeUndefined();
    expect(db.prepare(`SELECT COUNT(*) AS n FROM workspaces`).get()).toEqual({ n: 0 });
  });
});
