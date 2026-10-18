import { describe, expect, it } from "vitest";
import { createAccount, openAccountsDb } from "../lib/accounts";
import { chosenTracks } from "../lib/connections";
import { openDb } from "../lib/db";
import type { StructuredLlm } from "../lib/llm";
import { claimReport, getReport, parseTracks, runReport } from "../lib/report";
import { getBusiness, getProfile, saveProfile } from "../lib/repo";
import type { RawPage } from "../lib/safeFetch";
import { latestAudit } from "../lib/seo/audit";
import { CATEGORIES, categoryScores, issueCategory, rankIssues } from "../lib/seo/categories";
import type { Issue } from "../lib/seo/checks";

const page = (title: string, words = 300) =>
  `<!doctype html><html lang="en"><head><title>${title}</title><meta name="viewport" content="width=device-width"></head>
<body><h1>${title}</h1><p>${"shift scheduling for warehouses ".repeat(words / 4)}</p><a href="/pricing">pricing</a><a href="/about">about</a></body></html>`;

const site = (files: Record<string, string>) =>
  async (url: string): Promise<RawPage> => {
    const path = new URL(url).pathname || "/";
    const body = files[path];
    return body === undefined
      ? { url, status: 404, contentType: "text/html", body: "<html><body>nope</body></html>", ms: 5, redirected: false }
      : { url, status: 200, contentType: "text/html", body, ms: 5, redirected: false };
  };

const fetchPage = site({ "/": page("Loomwise"), "/pricing": page(""), "/about": page("About Loomwise") });

const guessLlm: StructuredLlm = async () =>
  ({
    sells: "shift scheduling software for warehouses.",
    facets: ["Warehousing", "ops director"],
    offer: "Loomwise schedules warehouse shifts.",
    icp: "Warehouse operators with 100-1,000 staff.",
  }) as never;

function insert(db: ReturnType<typeof openAccountsDb>, id: string) {
  db.prepare(`INSERT INTO reports (id, site, status, created_at) VALUES (?, 'https://loomwise.co', 'running', ?)`).run(id, Date.now());
}

describe("public site report", () => {
  it("crawls, scores by category and guesses the business", async () => {
    const db = openAccountsDb(":memory:");
    insert(db, "abcdefabcdef");
    await runReport(db, "abcdefabcdef", "https://loomwise.co", { llm: guessLlm, fetchPage });
    const r = getReport(db, "abcdefabcdef")!;
    expect(r.status).toBe("done");
    expect(r.report!.pagesCrawled).toBe(3);
    expect(r.report!.issues.some((i) => i.id === "no-title")).toBe(true);
    expect(Object.keys(r.report!.categories).sort()).toEqual([...CATEGORIES].sort());
    expect(r.guess).toMatchObject({ sells: "shift scheduling software for warehouses.", facets: ["warehousing", "ops director"] });
  });

  it("still finishes when the guess fails or no AI is configured", async () => {
    const db = openAccountsDb(":memory:");
    insert(db, "aaaaaaaaaaaa");
    const failing: StructuredLlm = async () => {
      throw new Error("model down");
    };
    await runReport(db, "aaaaaaaaaaaa", "https://loomwise.co", { llm: failing, fetchPage });
    expect(getReport(db, "aaaaaaaaaaaa")).toMatchObject({ status: "done", guess: null });
    insert(db, "bbbbbbbbbbbb");
    await runReport(db, "bbbbbbbbbbbb", "https://loomwise.co", { llm: null, fetchPage });
    expect(getReport(db, "bbbbbbbbbbbb")).toMatchObject({ status: "done", guess: null });
  });

  it("records an error when nothing can be read", async () => {
    const db = openAccountsDb(":memory:");
    insert(db, "cccccccccccc");
    await runReport(db, "cccccccccccc", "https://loomwise.co", {
      llm: null,
      fetchPage: async () => {
        throw new Error("ENOTFOUND");
      },
    });
    expect(getReport(db, "cccccccccccc")?.status).toBe("error");
  });

  it("rejects malformed ids and reports a lost run as interrupted", () => {
    const db = openAccountsDb(":memory:");
    expect(getReport(db, "../etc")).toBeNull();
    insert(db, "dddddddddddd");
    expect(getReport(db, "dddddddddddd")).toMatchObject({ status: "error" });
  });

  it("claims a finished report into a workspace exactly once", async () => {
    const accounts = openAccountsDb(":memory:");
    const a = createAccount(accounts, { email: "maya@loomwise.co", password: "longenough" });
    const b = createAccount(accounts, { email: "other@x.co", password: "longenough" });
    insert(accounts, "eeeeeeeeeeee");
    await runReport(accounts, "eeeeeeeeeeee", "https://loomwise.co", { llm: guessLlm, fetchPage });

    const ws = openDb(":memory:");
    expect(claimReport(accounts, "eeeeeeeeeeee", a.workspaceId, ws, parseTracks(["site", "bogus"]))).toBe(true);
    expect(latestAudit(ws)?.report?.score).toBe(getReport(accounts, "eeeeeeeeeeee")!.report!.score);
    expect(getProfile(ws)).toEqual({ offer: "Loomwise schedules warehouse shifts.", icp: "Warehouse operators with 100-1,000 staff." });
    expect(getBusiness(ws)).toMatchObject({ website: "https://loomwise.co" });
    expect(getBusiness(ws).onboardedAt).not.toBeNull();
    expect(chosenTracks(ws)).toEqual(["site"]);

    const other = openDb(":memory:");
    expect(claimReport(accounts, "eeeeeeeeeeee", b.workspaceId, other, ["site"])).toBe(false);
    expect(latestAudit(other)).toBeNull();
    expect(getReport(accounts, "eeeeeeeeeeee")?.claimed).toBe(true);
  });

  it("keeps an offer and ICP the workspace already wrote", async () => {
    const accounts = openAccountsDb(":memory:");
    const a = createAccount(accounts, { email: "maya@loomwise.co", password: "longenough" });
    insert(accounts, "ffffffffffff");
    await runReport(accounts, "ffffffffffff", "https://loomwise.co", { llm: guessLlm, fetchPage });
    const ws = openDb(":memory:");
    saveProfile(ws, { offer: "mine", icp: "mine too" });
    claimReport(accounts, "ffffffffffff", a.workspaceId, ws, []);
    expect(getProfile(ws)).toEqual({ offer: "mine", icp: "mine too" });
  });
});

describe("issue categories", () => {
  const issue = (id: string, severity: Issue["severity"], count = 1): Issue => ({ id, severity, title: id, detail: "", pages: [], count });

  it("groups issues and scores each category on its own", () => {
    const issues = [issue("no-title", "high", 3), issue("no-schema", "medium"), issue("slow", "low")];
    expect(issues.map(issueCategory)).toEqual(["content", "structured data", "mobile speed"]);
    const scores = categoryScores(issues, 3);
    expect(scores.technical).toBe(100);
    expect(scores.content).toBeLessThan(scores["structured data"]);
  });

  it("ranks by severity, then pages affected", () => {
    const ranked = rankIssues([issue("a", "low", 9), issue("b", "high", 1), issue("c", "high", 4), issue("d", "medium", 2)]);
    expect(ranked.map((i) => i.id)).toEqual(["c", "b", "d", "a"]);
  });
});
