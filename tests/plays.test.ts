import { describe, expect, it } from "vitest";
import { openDb } from "../lib/db";
import { run } from "../lib/pipeline";
import { PLAYS, estimateCalls, playById } from "../lib/plays";
import { listProspects, saveProfile } from "../lib/repo";
import type { Searcher } from "../lib/sourcing";

describe("plays", () => {
  it("have unique ids, bounded focus text and sane sizes", () => {
    expect(new Set(PLAYS.map((p) => p.id)).size).toBe(PLAYS.length);
    for (const p of PLAYS) {
      expect(p.focus.length, p.id).toBeLessThanOrEqual(300);
      if (p.locked) expect(p.leads).toBe(0);
      else expect(p.leads).toBeGreaterThan(0);
    }
    expect(PLAYS.filter((p) => !p.locked).length).toBeGreaterThanOrEqual(5);
    expect(PLAYS.some((p) => p.id === "reddit-asks" && p.locked)).toBe(true);
  });

  it("look up by id and estimate AI calls", () => {
    expect(playById("open-rfps")?.title).toMatch(/RFP/);
    expect(playById("nope")).toBeUndefined();
    expect(estimateCalls({ ...PLAYS[0], leads: 10 })).toBe(21);
  });

  it("passes the play's focus to the search and labels the source with the play title", async () => {
    const db = openDb(":memory:");
    saveProfile(db, { offer: "SEO", icp: "Dev tools" });
    const play = playById("recently-funded")!;
    let prompt = "";
    const search: Searcher = async ({ user }) => {
      prompt = user;
      return {
        text: JSON.stringify({ leads: [{ name: "P", company: "C", website: "c.io", email: "", notes: "n", source_url: "https://news.example/c" }] }),
        citedDomains: ["c.io"],
      };
    };
    const llm = (() => Promise.reject(new Error("skip enrichment"))) as never;
    await run(db, { search, llm }, { count: play.leads, focus: play.focus, label: play.title });
    expect(prompt).toContain(play.focus);
    expect(listProspects(db)[0].source).toBe("AI search: Recently funded companies");
  });
});
