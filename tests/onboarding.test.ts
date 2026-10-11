import { describe, expect, it } from "vitest";
import { openDb } from "../lib/db";
import { countWords, extractDocumentText, readUploads } from "../lib/documents";
import { runOnboarding } from "../lib/onboarding";
import { getPipeline, run } from "../lib/pipeline";
import { getBusiness, getProfile, listLeadsWithDrafts, listPendingApprovals } from "../lib/repo";
import type { Searcher } from "../lib/sourcing";
import { leadsPayload } from "../lib/leads-view";

const derived = { offer: "We run SEO for B2B SaaS.", icp: "Series A SaaS, 20-200 staff, head of marketing." };
const research = {
  summary: "Builds compilers.", hook: "", icpFit: 3, need: 3, budget: 2, authority: 2, timing: 1, rationale: "Great fit.",
};
const draft = { subject: "Quick idea", body: "Hi there, saw your launch." };

/** Fake LLM that answers whichever schema is asked for, by its shape. */
const fakeLlm = ((req: { schema: { shape: Record<string, unknown> } }) => {
  const keys = Object.keys(req.schema.shape);
  if (keys.includes("icp")) return Promise.resolve(derived);
  if (keys.includes("rationale")) return Promise.resolve(research);
  return Promise.resolve(draft);
}) as never;

describe("documents", () => {
  it("counts words and reads text-like files", async () => {
    expect(countWords("  one two\nthree ")).toBe(3);
    expect(countWords("")).toBe(0);
    expect(await extractDocumentText("a.md", new TextEncoder().encode("# Hello  world"))).toBe("# Hello  world");
    expect(await extractDocumentText("b.html", new TextEncoder().encode("<p>Hi <b>there</b></p>"))).toBe("Hi there");
  });

  it("rejects unsupported, empty and oversized files, and too many uploads", async () => {
    await expect(extractDocumentText("x.exe", new Uint8Array([1]))).rejects.toThrow(/unsupported/);
    await expect(extractDocumentText("x.txt", new TextEncoder().encode("   "))).rejects.toThrow(/no readable text/);
    await expect(extractDocumentText("x.txt", new Uint8Array(5 * 1024 * 1024 + 1))).rejects.toThrow(/5 MB/);
    const f = (n: number) => Array.from({ length: n }, (_, i) => new File(["hi"], `f${i}.txt`));
    await expect(readUploads(f(6))).rejects.toThrow(/at most 5/);
    expect((await readUploads(f(2))).map((d) => d.name)).toEqual(["f0.txt", "f1.txt"]);
    expect(await readUploads([new File([], "empty.txt")])).toEqual([]);
  });
});

describe("runOnboarding", () => {
  it("builds the profile from website + description + docs and marks onboarding done", async () => {
    const db = openDb(":memory:");
    expect(getBusiness(db).onboardedAt).toBeNull();
    let seen = "";
    const llm = ((req: { user: string; schema: unknown }) => {
      seen = req.user;
      return Promise.resolve(derived);
    }) as never;
    const out = await runOnboarding(
      db,
      llm,
      { website: "acme.co", description: "We do SEO.", docs: [{ name: "deck.pdf", text: "Case study: 3x traffic" }] },
      async () => "Acme homepage text",
    );
    expect(out).toMatchObject({ ...derived, usedWebsite: true });
    expect(seen).toContain("Acme homepage text");
    expect(seen).toContain("We do SEO.");
    expect(seen).toContain("3x traffic");
    expect(getProfile(db)).toEqual(derived);
    const b = getBusiness(db);
    expect(b.website).toBe("https://acme.co");
    expect(b.context).toContain("We do SEO.");
    expect(b.onboardedAt).not.toBeNull();
  });

  it("works from a description alone when the site can't be read, and needs some input", async () => {
    const db = openDb(":memory:");
    await expect(runOnboarding(db, fakeLlm, { website: "", description: " ", docs: [] })).rejects.toThrow(/Give us/);
    await expect(
      runOnboarding(db, fakeLlm, { website: "down.example", description: "", docs: [] }, async () => {
        throw new Error("500");
      }),
    ).rejects.toThrow(/couldn't read/);
    const out = await runOnboarding(
      db,
      fakeLlm,
      { website: "down.example", description: "We do SEO.", docs: [] },
      async () => {
        throw new Error("500");
      },
    );
    expect(out.usedWebsite).toBe(false);
  });
});

describe("pipeline", () => {
  const search: Searcher = async () => ({
    text: JSON.stringify({
      leads: [1, 2, 3].map((n) => ({ name: `P${n}`, company: `C${n}`, website: `c${n}.io`, email: "", notes: `Notes ${n}` })),
    }),
    citedDomains: ["c1.io", "c2.io", "c3.io"],
  });

  it("finds leads, scores each, and queues an outreach draft per lead", async () => {
    const db = openDb(":memory:");
    await runOnboarding(db, fakeLlm, { website: "", description: "We do SEO.", docs: [] });
    await run(db, { search, llm: fakeLlm, fetchText: async () => "site text" }, { count: 3 });
    const rows = listLeadsWithDrafts(db);
    expect(rows).toHaveLength(3);
    for (const r of rows) {
      expect(r.score).toBe(80);
      expect(r.draft_status).toBe("draft");
      expect(r.draft_subject).toBe("Quick idea");
    }
    expect(listPendingApprovals(db)).toHaveLength(3);
    const p = getPipeline(db);
    expect(p).toMatchObject({ status: "done", added: 3, total: 3, done: 3 });
    const view = leadsPayload(db);
    expect(view.leads[0]).toMatchObject({ tier: "A", score: 80, draft: { status: "draft" } });
    expect(view.leads[0].ratings).toEqual({ icpFit: 3, need: 3, budget: 2, authority: 2, timing: 1 });
  });

  it("keeps going when one lead fails, and reports the problem", async () => {
    const db = openDb(":memory:");
    await runOnboarding(db, fakeLlm, { website: "", description: "We do SEO.", docs: [] });
    let n = 0;
    const flaky = ((req: { schema: { shape: Record<string, unknown> } }) => {
      if (Object.keys(req.schema.shape).includes("rationale") && ++n === 2) return Promise.reject(new Error("model timeout"));
      return (fakeLlm as (r: unknown) => Promise<unknown>)(req);
    }) as never;
    await run(db, { search, llm: flaky, fetchText: async () => "x" }, { count: 3 });
    expect(listLeadsWithDrafts(db).filter((r) => r.score !== null)).toHaveLength(2);
    expect(getPipeline(db)).toMatchObject({ status: "done", total: 3, done: 3, error: "model timeout" });
  });
});

describe("pdf", () => {
  it("extracts text from a real PDF", async () => {
    const { readFileSync } = await import("node:fs");
    const text = await extractDocumentText("deck.pdf", new Uint8Array(readFileSync(new URL("./fixture.pdf", import.meta.url))));
    expect(text).toContain("We run SEO for SaaS");
  });
});
