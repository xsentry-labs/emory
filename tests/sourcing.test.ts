import { describe, expect, it } from "vitest";
import { openDb } from "../lib/db";
import { createProspect, listProspects, saveProfile } from "../lib/repo";
import { parseCandidates, sourceLeads, type Searcher } from "../lib/sourcing";

const lead = (over: object = {}) => ({
  name: "Grace Hopper",
  company: "Compilers Inc",
  website: "https://www.compilers.io/about",
  email: "",
  notes: "Builds compilers.",
  ...over,
});
const reply = (leads: object[], cited: string[]): Searcher => async () => ({
  text: JSON.stringify({ leads }),
  citedDomains: cited,
});

const setup = () => {
  const db = openDb(":memory:");
  saveProfile(db, { offer: "SEO", icp: "Dev tool startups" });
  return db;
};

describe("sourceLeads", () => {
  it("requires an offer and ICP", async () => {
    const db = openDb(":memory:");
    await expect(sourceLeads(db, reply([], []))).rejects.toThrow(/Offer/);
  });

  it("adds cited leads, normalising the website and recording the source", async () => {
    const db = setup();
    const r = await sourceLeads(db, reply([lead({ email: "Grace@Compilers.io" })], ["compilers.io"]), { focus: "dev tools" });
    expect(r).toEqual({ added: 1, skipped: { duplicate: 0, unverified: 0 } });
    expect(listProspects(db)[0]).toMatchObject({
      name: "Grace Hopper",
      company: "Compilers Inc",
      website: "https://www.compilers.io",
      email: "grace@compilers.io",
      status: "new",
      score: null,
      source: "AI search: dev tools",
    });
  });

  it("drops leads whose website was not cited (invented), and bad emails are blanked", async () => {
    const db = setup();
    const r = await sourceLeads(
      db,
      reply([lead(), lead({ company: "Ghost Co", website: "ghost.example", email: "x@y.z" }), lead({ company: "B", website: "b.io", email: "nope" })], [
        "www.compilers.io",
        "b.io",
      ]),
      { isReachable: async () => false },
    );
    expect(r).toEqual({ added: 2, skipped: { duplicate: 0, unverified: 1 } });
    const rows = listProspects(db);
    expect(rows.map((p) => p.company).sort()).toEqual(["B", "Compilers Inc"]);
    expect(rows.find((p) => p.company === "B")!.email).toBe("");
  });

  it("accepts uncited leads whose site is reachable (search returned no citations)", async () => {
    const db = setup();
    const live = ["compilers.io", "z.io"];
    const r = await sourceLeads(
      db,
      reply([lead(), lead({ company: "Z", website: "z.io" }), lead({ company: "Ghost", website: "ghost.example" })], []),
      { isReachable: async (u) => live.some((h) => new URL(u).hostname.endsWith(h)) },
    );
    expect(r).toEqual({ added: 2, skipped: { duplicate: 0, unverified: 1 } });
  });

  it("skips leads already in the database by site or email", async () => {
    const db = setup();
    createProspect(db, { name: "Old", website: "compilers.io" });
    createProspect(db, { name: "Mail", email: "ada@e.com" });
    const r = await sourceLeads(
      db,
      reply([lead(), lead({ company: "Z", website: "z.io", email: "ADA@e.com" })], ["compilers.io", "z.io"]),
    );
    expect(r).toEqual({ added: 0, skipped: { duplicate: 2, unverified: 0 } });
  });

  it("caps the count, and retries once on an unparseable reply", async () => {
    const db = setup();
    let calls = 0;
    const flaky: Searcher = async () => {
      calls++;
      return calls === 1
        ? { text: "Sure! Here are some leads", citedDomains: [] }
        : {
            text: JSON.stringify({ leads: [1, 2, 3, 4].map((n) => lead({ company: `C${n}`, website: `c${n}.io` })) }),
            citedDomains: [1, 2, 3, 4].map((n) => `c${n}.io`),
          };
    };
    const r = await sourceLeads(db, flaky, { count: 2 });
    expect(calls).toBe(2);
    expect(r.added).toBe(2);
    await expect(sourceLeads(db, async () => ({ text: "nope", citedDomains: [] }))).rejects.toThrow(/not usable/);
  });
});

describe("parseCandidates", () => {
  it("extracts JSON from fenced or chatty replies", () => {
    const out = parseCandidates('Here you go:\n```json\n{"leads":[{"name":"A","company":"B","website":"c.io"}]}\n```');
    expect(out.leads[0]).toMatchObject({ company: "B", email: "", notes: "" });
    expect(() => parseCandidates("no json")).toThrow();
  });
});
