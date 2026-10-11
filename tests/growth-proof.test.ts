import { describe, expect, it } from "vitest";
import { openDb } from "../lib/db";
import {
  cleanLinkedinUrl,
  createDraft,
  createProspect,
  decideDraft,
  getProspect,
  isEmail,
  listLeadsWithDrafts,
  listReadyToSend,
  markSent,
  queueDueFollowups,
  saveProfile,
  updateContact,
} from "../lib/repo";
import { sourceLeads, type Searcher } from "../lib/sourcing";

describe("cleanLinkedinUrl", () => {
  it("keeps real profile and company pages, normalised", () => {
    expect(cleanLinkedinUrl("https://www.linkedin.com/in/ada-lovelace/")).toBe("https://www.linkedin.com/in/ada-lovelace");
    expect(cleanLinkedinUrl("linkedin.com/company/acme?trk=x")).toBe("https://www.linkedin.com/company/acme");
    expect(cleanLinkedinUrl("https://uk.linkedin.com/in/grace")).toBe("https://www.linkedin.com/in/grace");
  });

  it("rejects everything else", () => {
    for (const bad of ["", "https://evil.com/in/ada", "https://linkedin.com.evil.com/in/ada", "https://linkedin.com/feed", "javascript:alert(1)", "not a url"]) {
      expect(cleanLinkedinUrl(bad), bad).toBe("");
    }
  });
});

describe("sourcing keeps the LinkedIn URL", () => {
  it("stores valid ones and drops invalid ones", async () => {
    const db = openDb(":memory:");
    saveProfile(db, { offer: "SEO", icp: "SaaS" });
    const search: Searcher = async () => ({
      text: JSON.stringify({
        leads: [
          { name: "A", company: "A Co", website: "a.io", linkedin_url: "https://www.linkedin.com/in/a-person", source_url: "https://a.io/news" },
          { name: "B", company: "B Co", website: "b.io", linkedin_url: "https://evil.example/in/b", source_url: "https://b.io/news" },
        ],
      }),
      citedDomains: ["a.io", "b.io"],
    });
    await sourceLeads(db, search, { isReachable: async () => true });
    const rows = listLeadsWithDrafts(db);
    expect(rows.find((r) => r.company === "A Co")!.linkedin_url).toBe("https://www.linkedin.com/in/a-person");
    expect(rows.find((r) => r.company === "B Co")!.linkedin_url).toBe("");
  });
});

describe("updateContact", () => {
  it("saves a valid email and LinkedIn link, and allows clearing", () => {
    const db = openDb(":memory:");
    const id = createProspect(db, { name: "Ada" });
    updateContact(db, id, { email: " Ada@Example.com ", linkedin_url: "linkedin.com/in/ada" });
    expect(getProspect(db, id)).toMatchObject({ email: "ada@example.com", linkedin_url: "https://www.linkedin.com/in/ada" });
    updateContact(db, id, { email: "", linkedin_url: "" });
    expect(getProspect(db, id)).toMatchObject({ email: "", linkedin_url: "" });
  });

  it("rejects bad input without changing anything", () => {
    const db = openDb(":memory:");
    const id = createProspect(db, { name: "Ada", email: "ada@example.com" });
    expect(() => updateContact(db, id, { email: "nope", linkedin_url: "" })).toThrow(/valid/);
    expect(() => updateContact(db, id, { email: "a@b.co", linkedin_url: "https://example.com/in/x" })).toThrow(/linkedin/);
    expect(getProspect(db, id)!.email).toBe("ada@example.com");
    expect(isEmail("a@b.co")).toBe(true);
    expect(isEmail("a@b")).toBe(false);
  });
});

describe("ready to send / mark as sent", () => {
  const setup = () => {
    const db = openDb(":memory:");
    const pid = createProspect(db, { name: "Ada", email: "ada@example.com" });
    const id = createDraft(db, { prospectId: pid, kind: "outreach", subject: "Hi", body: "Hello" });
    return { db, pid, id };
  };

  it("lists only approved, unsent messages and marks them sent once", () => {
    const { db, pid, id } = setup();
    expect(listReadyToSend(db)).toHaveLength(0);
    decideDraft(db, id, "approved");
    const ready = listReadyToSend(db);
    expect(ready).toHaveLength(1);
    expect(ready[0]).toMatchObject({ id, email: "ada@example.com", prospect_name: "Ada" });

    expect(markSent(db, id)).toBe(true);
    expect(markSent(db, id)).toBe(false);
    expect(listReadyToSend(db)).toHaveLength(0);
    expect(getProspect(db, pid)!.status).toBe("contacted");
  });

  it("does not offer drafts or rejected messages", () => {
    const { db, pid, id } = setup();
    expect(markSent(db, id)).toBe(false);
    const rej = createDraft(db, { prospectId: pid, kind: "followup", subject: "s", body: "b" });
    decideDraft(db, rej, "rejected");
    expect(listReadyToSend(db)).toHaveLength(0);
  });

  it("keeps follow-up scheduling after the user sends it themselves", () => {
    const { db, id } = setup();
    decideDraft(db, id, "approved");
    markSent(db, id);
    expect(queueDueFollowups(db, Date.now() + 10 * 24 * 3600_000)).toBe(1);
  });
});
