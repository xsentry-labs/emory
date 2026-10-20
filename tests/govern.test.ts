import { describe, expect, it } from "vitest";
import { eventsCsv, listEvents, logEvent } from "../lib/audit";
import { openDb } from "../lib/db";
import { draftMessage } from "../lib/draft";
import type { StructuredLlm } from "../lib/llm";
import { addMemory, learnFromEdit, listMemory, memoryPrompt } from "../lib/memory";
import { deletePerson, personRecord } from "../lib/privacy";
import { createDraft, createProspect, decideDraft, getProspect, logReply, queueDueFollowups, saveProfile } from "../lib/repo";
import { sendApproved } from "../lib/send";
import { isOptOut, isSuppressed, listSuppressions, suppress } from "../lib/suppress";

const cfg = { smtpUrl: "smtp://x", fromEmail: "me@me.co", fromName: "", footer: "", dailyCap: 10 };

describe("audit log", () => {
  it("is append-only", () => {
    const db = openDb(":memory:");
    logEvent(db, { track: "site", action: "opened PR #1", target: "acme/web" });
    expect(() => db.prepare(`UPDATE audit_log SET action = 'x'`).run()).toThrow(/append-only/);
    expect(() => db.prepare(`DELETE FROM audit_log`).run()).toThrow(/append-only/);
    expect(listEvents(db)).toHaveLength(1);
  });

  it("filters by actor and exports CSV that spreadsheets can't execute", () => {
    const db = openDb(":memory:");
    logEvent(db, { track: "leads", action: "sent email", target: "a@b.co" });
    logEvent(db, { actor: "maya@x.co", track: "leads", action: "approved email", target: '=HYPERLINK("evil")' });
    expect(listEvents(db, { actor: "people" }).map((e) => e.actor)).toEqual(["maya@x.co"]);
    const csv = eventsCsv(listEvents(db));
    expect(csv.split("\n")[0]).toBe("time,actor,track,action,target,approved_by");
    expect(csv).toContain(`"'=HYPERLINK(""evil"")"`);
  });

  it("records sends", async () => {
    const db = openDb(":memory:");
    const p = createProspect(db, { name: "Ann", company: "X", email: "ann@x.co" });
    decideDraft(db, createDraft(db, { prospectId: p, kind: "outreach", subject: "Hi", body: "b" }), "approved");
    await sendApproved(db, async () => ({ messageId: "<1@me.co>" }), cfg);
    expect(listEvents(db).map((e) => e.action)).toContain("sent email");
  });
});

describe("do not contact", () => {
  it("matches addresses and whole domains", () => {
    const db = openDb(":memory:");
    suppress(db, "email", "Ann@X.co", "asked");
    suppress(db, "domain", "www.blocked.com", "competitor");
    expect(isSuppressed(db, "ann@x.co")).toBe(true);
    expect(isSuppressed(db, "bob@x.co")).toBe(false);
    expect(isSuppressed(db, "anyone@blocked.com")).toBe(true);
    expect(isSuppressed(db, "", "https://blocked.com/about")).toBe(true);
    expect(suppress(db, "email", "ann@x.co", "again")).toBe(false);
  });

  it("is enforced when sending, drafting and following up", async () => {
    const db = openDb(":memory:");
    saveProfile(db, { offer: "Rota software", icp: "Warehouses" });
    const p = createProspect(db, { name: "Ann", company: "X", email: "ann@x.co" });
    decideDraft(db, createDraft(db, { prospectId: p, kind: "outreach", subject: "Hi", body: "b" }), "approved");
    suppress(db, "email", "ann@x.co", "asked");
    const sent: string[] = [];
    await sendApproved(db, async (m) => (sent.push(m.to), { messageId: "<1@me.co>" }), cfg);
    expect(sent).toEqual([]);
    const llm = (async () => ({ subject: "s", body: "b" })) as unknown as StructuredLlm;
    await expect(draftMessage(db, llm, p, "outreach")).rejects.toThrow(/do-not-contact/);
    db.prepare(`UPDATE prospects SET status = 'contacted', next_followup_at = 1 WHERE id = ?`).run(p);
    db.prepare(`UPDATE messages SET status = 'sent'`).run();
    expect(queueDueFollowups(db, 10)).toBe(0);
  });

  it("adds people who ask to stop, and stops their follow-ups", () => {
    expect(isOptOut("Please remove me from your list")).toBe(true);
    expect(isOptOut("unsubscribe")).toBe(true);
    expect(isOptOut("Sounds good, can we talk Thursday?")).toBe(false);
    const db = openDb(":memory:");
    const p = createProspect(db, { name: "Ann", company: "X", email: "ann@x.co" });
    logReply(db, p, "Not interested. Please stop emailing me.");
    expect(isSuppressed(db, "ann@x.co")).toBe(true);
    expect(getProspect(db, p)?.status).toBe("lost");
    expect(listEvents(db).map((e) => e.action)).toEqual(expect.arrayContaining(["logged reply", "suppressed"]));
  });
});

describe("delete on request", () => {
  it("removes the person and their messages, keeps the address suppressed, and logs it", () => {
    const db = openDb(":memory:");
    const boss = createProspect(db, { name: "Mark", company: "X" });
    const p = createProspect(db, { name: "Ann", company: "X", email: "ann@x.co" });
    db.prepare(`UPDATE prospects SET reports_to = ? WHERE id = ?`).run(p, boss);
    createDraft(db, { prospectId: p, kind: "outreach", subject: "Hi", body: "b" });
    expect(personRecord(getProspect(db, p)!).map((r) => r.field)).toEqual(["name", "company", "email"]);

    expect(deletePerson(db, p, "maya@x.co")).toBe(true);
    expect(getProspect(db, p)).toBeUndefined();
    expect(getProspect(db, boss)?.reports_to).toBeNull();
    expect((db.prepare(`SELECT COUNT(*) AS n FROM messages`).get() as { n: number }).n).toBe(0);
    expect(listSuppressions(db)[0]).toMatchObject({ value: "ann@x.co", reason: "deleted on request" });
    const del = listEvents(db).find((e) => e.action === "deleted contact")!;
    expect(del).toMatchObject({ actor: "maya@x.co" });
    expect(del.target).not.toContain("ann@x.co");
  });
});

describe("memory", () => {
  it("goes into every draft prompt", async () => {
    const db = openDb(":memory:");
    saveProfile(db, { offer: "Rota software", icp: "Warehouses" });
    addMemory(db, "voice", 'sign as "maya"', "added by you", "maya@x.co");
    addMemory(db, "proof", "cut no-shows 30% at a 3pl", "added by you", "maya@x.co");
    expect(memoryPrompt(db)).toContain('- sign as "maya"');
    let seen = "";
    const llm = (async ({ user }: { user: string }) => {
      seen = user;
      return { subject: "s", body: "b" };
    }) as unknown as StructuredLlm;
    await draftMessage(db, llm, createProspect(db, { name: "Ann", company: "X" }), "outreach");
    expect(seen).toContain("<house_rules>");
    expect(seen).toContain("cut no-shows 30% at a 3pl");
  });

  it("learns one rule from a real edit, and ignores small or repeated ones", async () => {
    const db = openDb(":memory:");
    const llm = (async () => ({ rule: "Say rota, not schedule" })) as unknown as StructuredLlm;
    const draft = "Hi Dan, our schedule tool helps the team plan the schedule for every site and every shift.";
    const edited = "Hi Dan, our rota tool helps you build each site's rota in minutes. Maya";
    expect(await learnFromEdit(db, llm, draft, draft.replace("Hi", "Hey"), "x")).toBeNull();
    expect(await learnFromEdit(db, llm, draft, edited, "from your edit to dan's email")).not.toBeNull();
    expect(listMemory(db, "voice")).toMatchObject([{ text: "say rota, not schedule", source: "from your edit to dan's email" }]);
    expect(await learnFromEdit(db, llm, draft, edited, "again")).toBeNull();
  });
});
