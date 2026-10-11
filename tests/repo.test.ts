import { describe, expect, it } from "vitest";
import { openDb } from "../lib/db";
import {
  FOLLOWUP_DELAY_MS,
  createDraft,
  createProspect,
  decideDraft,
  getProspect,
  listMessages,
  listPendingApprovals,
  logReply,
  queueDueFollowups,
} from "../lib/repo";

const setup = () => {
  const db = openDb(":memory:");
  const pid = createProspect(db, { name: "Ada Lovelace", company: "Analytical Co" });
  return { db, pid };
};
const draft = (db: ReturnType<typeof openDb>, pid: number) =>
  createDraft(db, { prospectId: pid, kind: "outreach", subject: "Hi", body: "Hello there" });

describe("approval gate", () => {
  it("approving contacts the prospect and starts the follow-up clock", () => {
    const { db, pid } = setup();
    const mid = draft(db, pid);
    expect(listPendingApprovals(db)).toHaveLength(1);
    expect(decideDraft(db, mid, "approved", { subject: "Edited", body: "Edited body" })).toBe(true);
    const p = getProspect(db, pid)!;
    expect(p.status).toBe("contacted");
    expect(p.next_followup_at).not.toBeNull();
    expect(listMessages(db, pid)[0]).toMatchObject({ status: "approved", subject: "Edited" });
    expect(listPendingApprovals(db)).toHaveLength(0);
  });

  it("rejecting leaves the prospect untouched; a decided draft cannot be re-decided", () => {
    const { db, pid } = setup();
    const mid = draft(db, pid);
    expect(decideDraft(db, mid, "rejected")).toBe(true);
    expect(getProspect(db, pid)!.status).toBe("new");
    expect(decideDraft(db, mid, "approved")).toBe(false);
  });
});

describe("follow-ups", () => {
  it("queues one draft when due, and not again while it waits", () => {
    const { db, pid } = setup();
    decideDraft(db, draft(db, pid), "approved");
    const due = Date.now() + FOLLOWUP_DELAY_MS + 1000;
    expect(queueDueFollowups(db, due - FOLLOWUP_DELAY_MS - 5000)).toBe(0);
    expect(queueDueFollowups(db, due)).toBe(1);
    expect(queueDueFollowups(db, due)).toBe(0);
    expect(listPendingApprovals(db)[0].kind).toBe("followup");
  });

  it("a reply stops follow-ups", () => {
    const { db, pid } = setup();
    decideDraft(db, draft(db, pid), "approved");
    logReply(db, pid, "Sounds interesting");
    const p = getProspect(db, pid)!;
    expect(p.status).toBe("replied");
    expect(p.next_followup_at).toBeNull();
    expect(queueDueFollowups(db, Date.now() + 10 * FOLLOWUP_DELAY_MS)).toBe(0);
  });
});

describe("qualification", () => {
  it("scores 0-100 with tiers and weights", async () => {
    const { scoreLead } = await import("../lib/qualify");
    expect(scoreLead({ icpFit: 3, need: 3, budget: 3, authority: 3, timing: 3 })).toEqual({ score: 100, tier: "A" });
    expect(scoreLead({ icpFit: 0, need: 0, budget: 0, authority: 0, timing: 0 })).toEqual({ score: 0, tier: "C" });
    expect(scoreLead({ icpFit: 3, need: 3, budget: 0, authority: 0, timing: 0 }).score).toBe(55);
  });

  it("saves the score, promotes to qualified, and ranks leads best-first", async () => {
    const { saveQualification, listProspects } = await import("../lib/repo");
    const { db, pid } = setup();
    const other = createProspect(db, { name: "Grace Hopper" });
    saveQualification(db, pid, { icpFit: 3, need: 3, budget: 2, authority: 2, timing: 1 });
    saveQualification(db, other, { icpFit: 1, need: 0, budget: 0, authority: 1, timing: 0 });
    expect(getProspect(db, pid)!.status).toBe("qualified");
    expect(getProspect(db, other)!.status).toBe("new");
    expect(listProspects(db).map((p) => p.id)).toEqual([pid, other]);
  });

  it("moving to meeting stops follow-ups", async () => {
    const { setProspectStatus } = await import("../lib/repo");
    const { db, pid } = setup();
    decideDraft(db, draft(db, pid), "approved");
    setProspectStatus(db, pid, "meeting");
    expect(getProspect(db, pid)!.next_followup_at).toBeNull();
  });
});

describe("llm drafting", () => {
  it("builds a draft from the profile and lead, and queues it for approval", async () => {
    const { draftMessage } = await import("../lib/draft");
    const { saveProfile } = await import("../lib/repo");
    const { db, pid } = setup();
    let seen = "";
    const fake = (async (req: { user: string }) => {
      seen = req.user;
      return { subject: " Hello ", body: " Hi Ada, quick note. " };
    }) as never;
    await expect(draftMessage(db, fake, pid, "outreach")).rejects.toThrow(/Offer/);
    saveProfile(db, { offer: "SEO retainers", icp: "B2B SaaS" });
    const id = await draftMessage(db, fake, pid, "outreach");
    expect(seen).toContain("SEO retainers");
    expect(seen).toContain("Analytical Co");
    const pending = listPendingApprovals(db);
    expect(pending).toHaveLength(1);
    expect(pending[0]).toMatchObject({ id, subject: "Hello", body: "Hi Ada, quick note.", kind: "outreach" });
  });
});
