import { describe, expect, it } from "vitest";
import { openDb } from "../lib/db";
import { createProspect, getProspect, saveProfile } from "../lib/repo";
import { researchLead } from "../lib/research";
import { fetchPageText, htmlToText, isPrivateIp, normalizeUrl } from "../lib/safeFetch";

const result = {
  summary: "An analytical engine maker.",
  hook: "Launching a new product",
  icpFit: 3,
  need: 3,
  budget: 2,
  authority: 3,
  timing: 2,
  rationale: "Strong fit.",
};
const llmFake = (r: object) => (async () => r) as never;

const setup = () => {
  const db = openDb(":memory:");
  const pid = createProspect(db, { name: "Ada Lovelace", company: "Analytical Co", website: "example.com" });
  return { db, pid };
};

describe("researchLead", () => {
  it("requires an offer and ICP first", async () => {
    const { db, pid } = setup();
    await expect(researchLead(db, llmFake(result), pid, async () => "")).rejects.toThrow(/Offer/);
  });

  it("scores the lead from LLM ratings and stores the research", async () => {
    const { db, pid } = setup();
    saveProfile(db, { offer: "SEO", icp: "B2B SaaS" });
    const out = await researchLead(db, llmFake(result), pid, async () => "We build engines.");
    expect(out.usedWebsite).toBe(true);
    const p = getProspect(db, pid)!;
    expect(p.score).toBe(90);
    expect(p.status).toBe("qualified");
    expect(p.research_summary).toContain("engine");
    expect(p.score_rationale).toBe("Strong fit.");
    expect(p.notes).toContain("Hook: Launching a new product");
    // Re-running does not duplicate the hook.
    await researchLead(db, llmFake(result), pid, async () => "We build engines.");
    expect(getProspect(db, pid)!.notes.match(/Hook:/g)).toHaveLength(1);
  });

  it("still works when the website can't be fetched", async () => {
    const { db, pid } = setup();
    saveProfile(db, { offer: "SEO", icp: "B2B SaaS" });
    const out = await researchLead(db, llmFake(result), pid, async () => {
      throw new Error("Website returned 500");
    });
    expect(out).toEqual({ usedWebsite: false, websiteError: "Website returned 500" });
  });
});

describe("safeFetch", () => {
  it("flags private addresses", () => {
    for (const ip of ["127.0.0.1", "10.1.2.3", "192.168.0.5", "172.20.0.1", "169.254.169.254", "::1", "fd00::1", "::ffff:10.0.0.1"]) {
      expect(isPrivateIp(ip), ip).toBe(true);
    }
    for (const ip of ["8.8.8.8", "93.184.216.34", "2606:4700::1111"]) expect(isPrivateIp(ip), ip).toBe(false);
  });

  it("normalizes urls and strips html", () => {
    expect(normalizeUrl("example.com")!.href).toBe("https://example.com/");
    expect(normalizeUrl("ftp://x.com")).toBeNull();
    expect(htmlToText("<p>Hi&nbsp;<b>you</b></p><script>x()</script>")).toBe("Hi you");
  });

  it("refuses to fetch internal addresses", async () => {
    await expect(fetchPageText("http://127.0.0.1:8080")).rejects.toThrow(/non-public/);
    await expect(fetchPageText("http://169.254.169.254/latest")).rejects.toThrow(/non-public/);
    await expect(fetchPageText("localhost")).rejects.toThrow();
  });
});
