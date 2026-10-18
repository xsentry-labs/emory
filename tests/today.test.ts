import { describe, expect, it } from "vitest";
import { addItem } from "../lib/content";
import { openDb } from "../lib/db";
import { createDraft, createProspect, decideDraft, logReply, markSent } from "../lib/repo";
import { todayView } from "../lib/today";

describe("today hub", () => {
  it("asks for a first audit on an empty workspace", () => {
    const view = todayView(openDb(":memory:"));
    expect(view.items.map((i) => i.key)).toEqual(["site:none"]);
    expect(view.counts).toMatchObject({ all: 1, site: 1, leads: 0 });
    expect(view.overnight).toEqual([]);
  });

  it("collects drafts, replies, unscored leads and post drafts, replies first", () => {
    const db = openDb(":memory:");
    const dan = createProspect(db, { name: "Dan Okafor", company: "Harrow Cold Chain", email: "dan@harrow.co" });
    const ann = createProspect(db, { name: "Ann", company: "Brill" });
    const first = createDraft(db, { prospectId: dan, kind: "outreach", subject: "Night shifts", body: "Hi Dan" });
    decideDraft(db, first, "approved");
    markSent(db, first);
    logReply(db, dan, "Thursday works for a demo.");
    createDraft(db, { prospectId: ann, kind: "outreach", subject: "Hello", body: "Hi Ann" });
    addItem(db, { kind: "x_post", title: "", body: "What's your fix for no-shows?", status: "draft" });

    const view = todayView(db);
    const keys = view.items.map((i) => i.key);
    expect(keys[0]).toMatch(/^reply:/);
    expect(view.items[0]).toMatchObject({ track: "replies", hot: true, href: `/prospects/${dan}` });
    expect(keys).toContain("leads:unscored");
    expect(view.items.find((i) => i.draft)?.draft).toMatchObject({ subject: "Hello", body: "Hi Ann" });
    expect(view.counts).toMatchObject({ replies: 1, social: 1, site: 1 });
    expect(view.week).toMatchObject({ leadsFound: 2, sent: 1, replies: 1, postsDrafted: 1 });
    expect(view.overnight).toContain("found 2 leads");
  });

  it("drops a reply once something has been drafted after it", () => {
    const db = openDb(":memory:");
    const p = createProspect(db, { name: "Dan" });
    logReply(db, p, "Interested");
    createDraft(db, { prospectId: p, kind: "followup", subject: "Re", body: "Great" });
    expect(todayView(db).items.some((i) => i.track === "replies")).toBe(false);
  });
});
