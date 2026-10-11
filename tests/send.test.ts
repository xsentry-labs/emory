import { describe, expect, it } from "vitest";
import { openDb } from "../lib/db";
import { fromHeader, sendConfig, type Mailer, type OutgoingEmail, type SendConfig } from "../lib/mailer";
import { createDraft, createProspect, decideDraft, listMessages, logReply, setProspectStatus } from "../lib/repo";
import { MAX_SEND_ATTEMPTS, sendApproved } from "../lib/send";

const cfg: SendConfig = {
  smtpUrl: "smtp://x",
  fromEmail: "me@acme.co",
  fromName: "Me",
  footer: "Acme, 1 Main St. Reply STOP to opt out.",
  dailyCap: 30,
};

const recorder = () => {
  const sent: OutgoingEmail[] = [];
  const mailer: Mailer = async (e) => {
    sent.push(e);
    return { messageId: `<id${sent.length}@acme.co>` };
  };
  return { sent, mailer };
};

const setup = (email = "ada@example.com") => {
  const db = openDb(":memory:");
  const pid = createProspect(db, { name: "Ada", company: "Analytical Co", email });
  return { db, pid };
};
const approved = (db: ReturnType<typeof openDb>, pid: number, kind: "outreach" | "followup" = "outreach") => {
  const id = createDraft(db, { prospectId: pid, kind, subject: "Hi", body: "Hello" });
  decideDraft(db, id, "approved");
  return id;
};

describe("sendApproved", () => {
  it("sends approved messages with the footer and marks them sent", async () => {
    const { db, pid } = setup();
    const id = approved(db, pid);
    const { sent, mailer } = recorder();
    expect(await sendApproved(db, mailer, cfg)).toEqual({ sent: 1, failed: 0 });
    expect(sent[0]).toMatchObject({ to: "ada@example.com", subject: "Hi", from: '"Me" <me@acme.co>' });
    expect(sent[0].text).toBe("Hello\n\n--\nAcme, 1 Main St. Reply STOP to opt out.");
    expect(listMessages(db, pid).find((m) => m.id === id)).toMatchObject({ status: "sent", message_id: "<id1@acme.co>" });
    // Nothing left to send.
    expect(await sendApproved(db, mailer, cfg)).toEqual({ sent: 0, failed: 0 });
  });

  it("never sends drafts or rejected messages", async () => {
    const { db, pid } = setup();
    createDraft(db, { prospectId: pid, kind: "outreach", subject: "s", body: "b" });
    const rejected = createDraft(db, { prospectId: pid, kind: "outreach", subject: "s", body: "b" });
    decideDraft(db, rejected, "rejected");
    const { sent, mailer } = recorder();
    await sendApproved(db, mailer, cfg);
    expect(sent).toHaveLength(0);
  });

  it("threads follow-ups onto earlier emails", async () => {
    const { db, pid } = setup();
    approved(db, pid);
    const { sent, mailer } = recorder();
    await sendApproved(db, mailer, cfg);
    approved(db, pid, "followup");
    await sendApproved(db, mailer, cfg);
    expect(sent[1].inReplyTo).toBe("<id1@acme.co>");
    expect(sent[1].references).toEqual(["<id1@acme.co>"]);
  });

  it("does not send a follow-up after the lead replied", async () => {
    const { db, pid } = setup();
    const id = approved(db, pid, "followup");
    logReply(db, pid, "not interested");
    const { sent, mailer } = recorder();
    expect(await sendApproved(db, mailer, cfg)).toEqual({ sent: 0, failed: 1 });
    expect(sent).toHaveLength(0);
    expect(listMessages(db, pid).find((m) => m.id === id)!.send_error).toMatch(/replied/);
    setProspectStatus(db, pid, "contacted");
    expect(await sendApproved(db, mailer, cfg)).toEqual({ sent: 0, failed: 0 });
  });

  it("refuses leads without a valid email, permanently", async () => {
    const { db, pid } = setup("not-an-email");
    const id = approved(db, pid);
    const { sent, mailer } = recorder();
    expect(await sendApproved(db, mailer, cfg)).toEqual({ sent: 0, failed: 1 });
    expect(sent).toHaveLength(0);
    const m = listMessages(db, pid).find((x) => x.id === id)!;
    expect(m).toMatchObject({ status: "approved", send_attempts: MAX_SEND_ATTEMPTS });
    expect(await sendApproved(db, mailer, cfg)).toEqual({ sent: 0, failed: 0 });
  });

  it("retries failures up to the attempt limit, then stops", async () => {
    const { db, pid } = setup();
    approved(db, pid);
    let calls = 0;
    const flaky: Mailer = async () => {
      calls++;
      throw new Error("SMTP down");
    };
    for (let i = 0; i < MAX_SEND_ATTEMPTS + 2; i++) await sendApproved(db, flaky, cfg);
    expect(calls).toBe(MAX_SEND_ATTEMPTS);
    const m = listMessages(db, pid)[0];
    expect(m).toMatchObject({ status: "approved", send_error: "SMTP down" });
    // A later success path still works for other messages.
  });

  it("honours the rolling daily cap", async () => {
    const { db, pid } = setup();
    approved(db, pid);
    approved(db, pid, "followup");
    const { sent, mailer } = recorder();
    expect(await sendApproved(db, mailer, { ...cfg, dailyCap: 1 })).toEqual({ sent: 1, failed: 0 });
    expect(await sendApproved(db, mailer, { ...cfg, dailyCap: 1 })).toEqual({ sent: 0, failed: 0 });
    // A day later the cap frees up.
    expect(await sendApproved(db, mailer, { ...cfg, dailyCap: 1 }, Date.now() + 25 * 3600_000)).toEqual({ sent: 1, failed: 0 });
    expect(sent).toHaveLength(2);
  });
});

describe("sendConfig", () => {
  it("is off without SMTP_URL and FROM_EMAIL, and parses options", () => {
    expect(sendConfig({})).toBeNull();
    expect(sendConfig({ SMTP_URL: "smtp://x" } as never)).toBeNull();
    const c = sendConfig({ SMTP_URL: "smtp://x", FROM_EMAIL: "a@b.co", EMAIL_FOOTER: "Line1\\nLine2", SEND_DAILY_CAP: "5" } as never)!;
    expect(c).toMatchObject({ footer: "Line1\nLine2", dailyCap: 5 });
    expect(fromHeader({ fromEmail: "a@b.co", fromName: 'Bo "B"' })).toBe('"Bo B" <a@b.co>');
  });
});
