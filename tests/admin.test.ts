import { describe, expect, it } from "vitest";
import { listWorkspaceSummaries, createAccount, openAccountsDb } from "../lib/accounts";
import { isAdminEmail } from "../lib/admin";

describe("isAdminEmail", () => {
  it("matches listed emails case-insensitively and fails closed", () => {
    const env = { ADMIN_EMAILS: " Boss@Acme.co , other@x.com " };
    expect(isAdminEmail("boss@acme.co", env)).toBe(true);
    expect(isAdminEmail("OTHER@x.com", env)).toBe(true);
    expect(isAdminEmail("intruder@x.com", env)).toBe(false);
    expect(isAdminEmail(undefined, env)).toBe(false);
    expect(isAdminEmail("", env)).toBe(false);
    expect(isAdminEmail("boss@acme.co", {})).toBe(false);
    expect(isAdminEmail("boss@acme.co", { ADMIN_EMAILS: "" })).toBe(false);
  });
});

describe("listWorkspaceSummaries", () => {
  it("lists workspaces with their owners", () => {
    const db = openAccountsDb(":memory:");
    createAccount(db, { email: "a@x.com", password: "password1", workspaceName: "Alpha" });
    createAccount(db, { email: "b@x.com", password: "password1", workspaceName: "Beta" });
    expect(listWorkspaceSummaries(db).map((w) => [w.name, w.ownerEmail])).toEqual([
      ["Alpha", "a@x.com"],
      ["Beta", "b@x.com"],
    ]);
  });
});
