import { generateKeyPairSync, createVerify } from "node:crypto";
import { describe, expect, it } from "vitest";
import { openDb } from "../lib/db";
import { lineDiff } from "../lib/diff";
import { appJwt, pullRequestState, type Fetch } from "../lib/integrations/github";
import { matchProperty } from "../lib/integrations/google";
import { getConnection, saveConnection } from "../lib/integrations/store";
import type { StructuredLlm } from "../lib/llm";
import { saveBusiness } from "../lib/repo";
import { decrypt, encrypt, signState, verifyState } from "../lib/secrets";
import { speedIssue, type Issue } from "../lib/seo/checks";
import { applyPrState, createFixPr, fixesForPr, getPr, type RepoAccess } from "../lib/site/fixes";
import { getIssue, listIssues, syncIssues } from "../lib/site/issues";
import { resultsView, saveRows } from "../lib/site/results";
import { todayView } from "../lib/today";

const env = { SESSION_SECRET: "test-secret-for-site" };
process.env.SESSION_SECRET ??= env.SESSION_SECRET;

const issue = (id: string, severity: Issue["severity"] = "high", pages = ["https://acme.co/pricing"]): Issue => ({
  id,
  severity,
  title: `Problem ${id}`,
  detail: "detail",
  pages,
  count: pages.length,
});

describe("secrets and oauth state", () => {
  it("round-trips encrypted values and rejects tampering", () => {
    const sealed = encrypt("refresh-token", env);
    expect(sealed).not.toContain("refresh-token");
    expect(decrypt(sealed, env)).toBe("refresh-token");
    expect(() => decrypt(sealed.slice(0, -2) + "xx", env)).toThrow();
  });

  it("binds state to a workspace, provider and expiry", () => {
    const s = signState(7, "github", 1_000, env);
    expect(verifyState(s, "github", 2_000, env)).toBe(7);
    expect(verifyState(s, "google", 2_000, env)).toBeNull();
    expect(verifyState(s, "github", 1_000 + 16 * 60_000, env)).toBeNull();
    expect(verifyState(s.replace(/^7\./, "8."), "github", 2_000, env)).toBeNull();
  });

  it("stores connection secrets encrypted", () => {
    const db = openDb(":memory:");
    saveConnection(db, "google", { refreshToken: "rt-123", property: "sc-domain:acme.co" }, ["refreshToken"]);
    const raw = (db.prepare(`SELECT config FROM connections`).get() as { config: string }).config;
    expect(raw).not.toContain("rt-123");
    expect(getConnection<{ refreshToken: string }>(db, "google")?.config.refreshToken).toBe("rt-123");
  });
});

describe("issue tracking across audits", () => {
  it("opens, keeps, closes and reopens issues by rule", () => {
    const db = openDb(":memory:");
    expect(syncIssues(db, [issue("no-title"), issue("thin", "medium")], 1000)).toEqual({ opened: 2, fixed: 0 });
    expect(syncIssues(db, [issue("no-title")], 2000)).toEqual({ opened: 0, fixed: 1 });
    const thin = listIssues(db).find((i) => i.rule === "thin")!;
    expect(thin).toMatchObject({ status: "fixed", fixedAt: 2000 });
    expect(syncIssues(db, [issue("no-title"), issue("thin", "medium")], 3000)).toEqual({ opened: 1, fixed: 0 });
    expect(getIssue(db, thin.id)).toMatchObject({ status: "open", fixedAt: null });
  });

  it("leaves dismissed issues dismissed", () => {
    const db = openDb(":memory:");
    syncIssues(db, [issue("no-og", "low")]);
    db.prepare(`UPDATE site_issues SET status = 'dismissed'`).run();
    syncIssues(db, [issue("no-og", "low")]);
    expect(listIssues(db)[0].status).toBe("dismissed");
  });

  it("turns a slow mobile score into an issue", () => {
    expect(speedIssue({ url: "https://acme.co/", performance: 95, lcpMs: 1000 })).toBeNull();
    expect(speedIssue({ url: "https://acme.co/", performance: 40, lcpMs: 5200 })).toMatchObject({ id: "mobile-slow", severity: "high" });
    expect(speedIssue({ url: "https://acme.co/", performance: 70, lcpMs: null })?.severity).toBe("medium");
  });
});

const PAGE = `export const metadata = {};\n\nexport default function Pricing() {\n  return <h1>Pricing</h1>;\n}\n`;
const FIXED = `export const metadata = { title: "Pricing · Acme" };\n\nexport default function Pricing() {\n  return <h1>Pricing</h1>;\n}\n`;

function fakeRepo(): RepoAccess & { opened: { branch: string; edits: { path: string; content: string }[] }[] } {
  const opened: { branch: string; edits: { path: string; content: string }[] }[] = [];
  return {
    repo: "acme/web",
    base: "main",
    opened,
    files: async () => ["app/pricing/page.tsx", "public/robots.txt"],
    read: async (p) => (p === "app/pricing/page.tsx" ? PAGE : null),
    open: async (input) => {
      opened.push(input);
      return { number: 42, url: "https://github.com/acme/web/pull/42" };
    },
  };
}

/** A model that picks files, then returns the given edits. */
const llmWith = (edits: { path: string; rule: string; content: string }[]): StructuredLlm =>
  (async ({ system }: { system: string }) =>
    system.includes("choose the files")
      ? { files: ["app/pricing/page.tsx", "not/in/repo.ts"] }
      : { edits: edits.map((e) => ({ ...e, title: "give /pricing a title", why: "search showed 'home'." })) }) as never;

describe("fix pull requests", () => {
  it("opens one PR with validated edits and moves issues into it", async () => {
    const db = openDb(":memory:");
    saveBusiness(db, { website: "https://acme.co", context: "" });
    syncIssues(db, [issue("no-title"), issue("no-schema", "medium")]);
    const [title, schema] = listIssues(db);
    const repo = fakeRepo();
    const { prId, skipped } = await createFixPr(db, llmWith([{ path: "app/pricing/page.tsx", rule: "no-title", content: FIXED }]), repo, [title.id, schema.id], 5000);

    expect(repo.opened).toHaveLength(1);
    expect(repo.opened[0].branch).toMatch(/^emory\/seo-/);
    expect(repo.opened[0].edits).toEqual([{ path: "app/pricing/page.tsx", content: FIXED, rule: "no-title", title: "give /pricing a title", why: "search showed 'home'.", before: PAGE }]);
    expect(getPr(db, prId)).toMatchObject({ status: "open", number: 42 });
    expect(fixesForPr(db, prId)).toHaveLength(1);
    expect(getIssue(db, title.id)).toMatchObject({ status: "in_pr", prId });
    expect(skipped).toEqual(["no-schema"]);
    expect(getIssue(db, schema.id)?.status).toBe("open");
    expect(todayView(db).items.some((i) => i.key === `pr:${prId}`)).toBe(true);
  });

  it("rejects edits to unknown files, truncated rewrites and no-ops", async () => {
    const db = openDb(":memory:");
    syncIssues(db, [issue("no-title")]);
    const id = listIssues(db)[0].id;
    const llm = llmWith([
      { path: "not/in/repo.ts", rule: "no-title", content: "x" },
      { path: "app/pricing/page.tsx", rule: "no-title", content: "export {}\n" },
    ]);
    await expect(createFixPr(db, llm, fakeRepo(), [id])).rejects.toThrow(/safe code change/);
    expect(getIssue(db, id)?.status).toBe("open");
    expect(db.prepare(`SELECT status FROM site_prs`).get()).toEqual({ status: "failed" });
  });

  it("follows the PR: merge schedules a re-crawl, close reopens issues", async () => {
    const db = openDb(":memory:");
    syncIssues(db, [issue("no-title")]);
    const id = listIssues(db)[0].id;
    const { prId } = await createFixPr(db, llmWith([{ path: "app/pricing/page.tsx", rule: "no-title", content: FIXED }]), fakeRepo(), [id]);

    applyPrState(db, prId, { state: "open", mergedAt: null, checks: "2 checks passed" });
    expect(getPr(db, prId)?.checks).toBe("2 checks passed");
    expect(applyPrState(db, prId, { state: "merged", mergedAt: 10_000, checks: "" })).toEqual({ merged: true });
    expect((db.prepare(`SELECT value FROM kv WHERE key = 'recrawl_after'`).get() as { value: string }).value).toBe(String(10_000 + 15 * 60_000));

    const db2 = openDb(":memory:");
    syncIssues(db2, [issue("no-title")]);
    const id2 = listIssues(db2)[0].id;
    const pr2 = await createFixPr(db2, llmWith([{ path: "app/pricing/page.tsx", rule: "no-title", content: FIXED }]), fakeRepo(), [id2]);
    applyPrState(db2, pr2.prId, { state: "closed", mergedAt: null, checks: "" });
    expect(getIssue(db2, id2)).toMatchObject({ status: "open", prId: null });
  });
});

describe("github client", () => {
  it("signs an RS256 app JWT", () => {
    const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
    const jwt = appJwt({ appId: "123", privateKey: privateKey.export({ type: "pkcs1", format: "pem" }).toString(), slug: "emory" }, 1_700_000_000_000);
    const [h, b, s] = jwt.split(".");
    expect(JSON.parse(Buffer.from(b, "base64url").toString())).toMatchObject({ iss: "123", iat: 1_699_999_940 });
    expect(createVerify("RSA-SHA256").update(`${h}.${b}`).verify(publicKey, Buffer.from(s, "base64url"))).toBe(true);
  });

  it("reads merge state and summarises checks", async () => {
    const f = (async (url: string) => {
      const body = String(url).includes("/check-runs")
        ? { check_runs: [{ status: "completed", conclusion: "success" }, { status: "completed", conclusion: "failure" }] }
        : { state: "closed", merged_at: "2026-10-01T10:00:00Z", head: { sha: "abc" } };
      return new Response(JSON.stringify(body), { status: 200 });
    }) as Fetch;
    expect(await pullRequestState("t", "acme/web", 42, f)).toEqual({ state: "merged", mergedAt: Date.parse("2026-10-01T10:00:00Z"), checks: "1 check failed" });
  });
});

describe("search console", () => {
  it("matches a property to the website", () => {
    const sites = ["https://other.com/", "sc-domain:acme.co", "https://www.acme.co/"];
    expect(matchProperty(sites, "https://acme.co")).toBe("https://www.acme.co/");
    expect(matchProperty(["sc-domain:acme.co"], "https://www.acme.co")).toBe("sc-domain:acme.co");
    expect(matchProperty(sites, "https://nope.io")).toBeNull();
  });

  it("compares clicks either side of a confirmed fix", () => {
    const db = openDb(":memory:");
    saveConnection(db, "google", { refreshToken: "x", property: "sc-domain:acme.co" }, ["refreshToken"]);
    const DAY = 86_400_000;
    const fixedAt = Date.parse("2026-09-01T00:00:00Z");
    syncIssues(db, [issue("no-title")], fixedAt - 30 * DAY);
    syncIssues(db, [], fixedAt);
    const rows = [];
    for (let d = -14; d < 28; d++) {
      const day = new Date(fixedAt + d * DAY).toISOString().slice(0, 10);
      rows.push({ day, page: "https://acme.co/pricing", clicks: d < 0 ? 2 : 5, impressions: 100, position: d < 0 ? 20 : 12 });
    }
    saveRows(db, rows);
    const v = resultsView(db, fixedAt + 30 * DAY);
    expect(v.fixedCount).toBe(1);
    expect(v.pages[0]).toMatchObject({ page: "https://acme.co/pricing", before: { clicks: 14, position: 20 }, after: { clicks: 35, position: 12 } });
    expect(v.weeks).toHaveLength(8);
    expect(v.weeks.some((w) => w.fixed)).toBe(true);
    expect(v.clicksThisWeek).toBe(35);
  });
});

describe("line diff", () => {
  it("shows only changed lines with context", () => {
    const before = Array.from({ length: 20 }, (_, i) => `line ${i}`).join("\n");
    const after = before.replace("line 10", "line ten");
    const hunks = lineDiff(before, after, 1);
    expect(hunks).toHaveLength(1);
    expect(hunks[0].map((l) => l.kind)).toEqual(["same", "del", "add", "same"]);
    expect(hunks[0].find((l) => l.kind === "add")).toMatchObject({ text: "line ten", n: 11 });
  });
});
