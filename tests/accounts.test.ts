import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  adoptLegacyDb,
  createAccount,
  getAccount,
  hashPassword,
  inviteCodeMatches,
  listWorkspaceIds,
  openAccountsDb,
  verifyLogin,
  verifyPassword,
  workspaceDbPath,
} from "../lib/accounts";
import { openDb } from "../lib/db";
import { allow, resetRateLimits } from "../lib/ratelimit";
import { createProspect, listProspects } from "../lib/repo";
import { SESSION_TTL_MS, sessionSecret, signSession, verifySession } from "../lib/session-token";
import { consume, dailyLimit, usageSummary, usedToday } from "../lib/usage";

const tmp: string[] = [];
const tmpDir = () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "emory-test-"));
  tmp.push(d);
  return d;
};
afterEach(() => {
  resetRateLimits();
  for (const d of tmp.splice(0)) {
    try {
      fs.rmSync(d, { recursive: true, force: true });
    } catch {
      // Windows keeps SQLite files locked while handles are open; the OS clears temp later.
    }
  }
});

describe("session tokens", () => {
  it("round-trips, and rejects tampering, wrong secrets and expiry", async () => {
    const token = await signSession("s3cret", 7, 3, 1_000);
    expect(await verifySession("s3cret", token, 2_000)).toEqual({ userId: 7, workspaceId: 3 });
    expect(await verifySession("other", token, 2_000)).toBeNull();
    const [u, , exp, sig] = token.split(".");
    expect(await verifySession("s3cret", `${u}.99.${exp}.${sig}`, 2_000)).toBeNull(); // swapped workspace
    expect(await verifySession("s3cret", `${u}.3.${exp}.${sig}x`, 2_000)).toBeNull();
    expect(await verifySession("s3cret", token, 1_000 + SESSION_TTL_MS + 1)).toBeNull();
    expect(await verifySession("s3cret", "garbage", 2_000)).toBeNull();
    expect(await verifySession("s3cret", undefined, 2_000)).toBeNull();
  });

  it("prefers SESSION_SECRET, falls back to ADMIN_PASSWORD", () => {
    expect(sessionSecret({ SESSION_SECRET: "a", ADMIN_PASSWORD: "b" })).toBe("a");
    expect(sessionSecret({ ADMIN_PASSWORD: "b" })).toBe("b");
    expect(sessionSecret({})).toBeNull();
  });
});

describe("accounts", () => {
  it("hashes passwords with a salt and verifies them", () => {
    const h = hashPassword("correct horse");
    expect(h).not.toContain("correct horse");
    expect(hashPassword("correct horse")).not.toBe(h);
    expect(verifyPassword("correct horse", h)).toBe(true);
    expect(verifyPassword("wrong", h)).toBe(false);
    expect(verifyPassword("x", "garbage")).toBe(false);
  });

  it("creates accounts with their own workspace, logs in, and rejects bad input", () => {
    const db = openAccountsDb(":memory:");
    const a = createAccount(db, { email: " Ada@Example.com ", password: "password1", workspaceName: "Analytical" });
    const b = createAccount(db, { email: "grace@example.com", password: "password2" });
    expect(a.workspaceId).not.toBe(b.workspaceId);
    expect(listWorkspaceIds(db)).toEqual([a.workspaceId, b.workspaceId]);
    expect(verifyLogin(db, "ADA@example.com", "password1")).toEqual(a);
    expect(verifyLogin(db, "ada@example.com", "nope")).toBeNull();
    expect(verifyLogin(db, "nobody@example.com", "password1")).toBeNull();
    expect(getAccount(db, a.userId)).toEqual(a);
    expect(() => createAccount(db, { email: "ada@example.com", password: "password3" })).toThrow(/already exists/);
    expect(() => createAccount(db, { email: "bad", password: "password3" })).toThrow(/valid email/);
    expect(() => createAccount(db, { email: "c@example.com", password: "short" })).toThrow(/8 characters/);
  });

  it("checks the invite code in constant time and fails closed when unset", () => {
    expect(inviteCodeMatches(" abc ", "abc")).toBe(true);
    expect(inviteCodeMatches("abd", "abc")).toBe(false);
    expect(inviteCodeMatches("", "abc")).toBe(false);
    expect(inviteCodeMatches("abc", undefined)).toBe(false);
    expect(inviteCodeMatches("", "")).toBe(false);
  });

  it("moves single-user data into workspace 1, and the first signup claims it", () => {
    const dir = tmpDir();
    const legacy = openDb(path.join(dir, "emory.db"));
    createProspect(legacy, { name: "Old lead" });
    legacy.close();

    const accounts = openAccountsDb(":memory:");
    expect(adoptLegacyDb(accounts, dir)).toBe(true);
    expect(fs.existsSync(path.join(dir, "emory.db"))).toBe(false);
    expect(adoptLegacyDb(accounts, dir)).toBe(false);

    const first = createAccount(accounts, { email: "owner@example.com", password: "password1" });
    expect(first.workspaceId).toBe(1);
    const second = createAccount(accounts, { email: "next@example.com", password: "password1" });
    expect(second.workspaceId).toBe(2);

    expect(listProspects(openDb(workspaceDbPath(dir, 1))).map((p) => p.name)).toEqual(["Old lead"]);
  });
});

describe("workspace isolation", () => {
  it("keeps each workspace's data in a separate database file", () => {
    const dir = tmpDir();
    const a = openDb(workspaceDbPath(dir, 1));
    const b = openDb(workspaceDbPath(dir, 2));
    createProspect(a, { name: "A's lead" });
    createProspect(b, { name: "B's lead" });
    expect(listProspects(a).map((p) => p.name)).toEqual(["A's lead"]);
    expect(listProspects(b).map((p) => p.name)).toEqual(["B's lead"]);
  });
});

describe("usage limits", () => {
  it("allows up to the daily cap, then explains, and resets the next day", () => {
    const db = openDb(":memory:");
    const day1 = Date.UTC(2026, 9, 12, 10);
    for (let i = 0; i < 3; i++) consume(db, "hunt", day1, 3);
    expect(() => consume(db, "hunt", day1, 3)).toThrow(/Daily limit reached \(3 lead hunts per day\)/);
    expect(usedToday(db, "hunt", day1)).toBe(3);
    expect(() => consume(db, "hunt", day1 + 24 * 3600_000, 3)).not.toThrow();
    // Kinds are counted separately.
    expect(usedToday(db, "ai", day1)).toBe(0);
  });

  it("reads limits from the environment with safe defaults", () => {
    expect(dailyLimit("hunt", {})).toBe(3);
    expect(dailyLimit("hunt", { LIMIT_HUNTS_PER_DAY: "7" })).toBe(7);
    expect(dailyLimit("hunt", { LIMIT_HUNTS_PER_DAY: "-1" })).toBe(3);
    expect(usageSummary(openDb(":memory:")).map((u) => u.kind)).toEqual(["hunt", "onboarding", "ai"]);
  });
});

describe("rate limiter", () => {
  it("blocks past the limit within the window and recovers after it", () => {
    for (let i = 0; i < 3; i++) expect(allow("k", 3, 1000, 0)).toBe(true);
    expect(allow("k", 3, 1000, 10)).toBe(false);
    expect(allow("other", 3, 1000, 10)).toBe(true);
    expect(allow("k", 3, 1000, 1001)).toBe(true);
  });
});
