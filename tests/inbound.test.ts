import { describe, expect, it } from "vitest";
import { openDb } from "../lib/db";
import { getKv, ingestReply, setKv, stripQuoted, type InboundEmail } from "../lib/inbound";
import { imapConfig } from "../lib/imap";
import { createDraft, createProspect, decideDraft, getProspect, listMessages, queueDueFollowups } from "../lib/repo";
import { sendApproved } from "../lib/send";

const mail = (over: Partial<InboundEmail> = {}): InboundEmail => ({
  messageId: "<r1@example.com>",
  inReplyTo: "",
  references: [],
  from: "ada@example.com",
  text: "Sounds good, let's talk.",
  automated: false,
  ...over,
});

const setup = async () => {
  const db = openDb(":memory:");
  const pid = createProspect(db, { name: "Ada", company: "Analytical Co", email: "Ada@Example.com" });
  const id = createDraft(db, { prospectId: pid, kind: "outreach", subject: "Hi", body: "Hello" });
  decideDraft(db, id, "approved");
  await sendApproved(db, async () => ({ messageId: "<out1@acme.co>" }), {
    smtpUrl: "x", fromEmail: "me@acme.co", fromName: "", footer: "", dailyCap: 10,
  });
  return { db, pid };
};

describe("ingestReply", () => {
  it("matches by In-Reply-To, logs the reply and stops follow-ups", async () => {
    const { db, pid } = await setup();
    expect(ingestReply(db, mail({ inReplyTo: "<out1@acme.co>", from: "someone-else@other.com" }))).toBe("logged");
    const p = getProspect(db, pid)!;
    expect(p.status).toBe("replied");
    expect(p.next_followup_at).toBeNull();
    const reply = listMessages(db, pid).find((m) => m.direction === "inbound")!;
    expect(reply).toMatchObject({ body: "Sounds good, let's talk.", message_id: "<r1@example.com>", status: "received" });
    expect(queueDueFollowups(db, Date.now() + 1e10)).toBe(0);
  });

  it("matches by References, then falls back to the sender address", async () => {
    const { db, pid } = await setup();
    expect(ingestReply(db, mail({ messageId: "<a>", references: ["<x>", "<out1@acme.co>"], from: "z@z.com" }))).toBe("logged");
    expect(ingestReply(db, mail({ messageId: "<b>", from: "ada@example.com" }))).toBe("logged");
    expect(listMessages(db, pid).filter((m) => m.direction === "inbound")).toHaveLength(2);
  });

  it("ignores duplicates, automated mail, system senders, our own address and strangers", async () => {
    const { db } = await setup();
    expect(ingestReply(db, mail())).toBe("logged");
    expect(ingestReply(db, mail())).toBe("duplicate");
    expect(ingestReply(db, mail({ messageId: "<2>", automated: true }))).toBe("ignored");
    expect(ingestReply(db, mail({ messageId: "<3>", from: "mailer-daemon@example.com" }))).toBe("ignored");
    expect(ingestReply(db, mail({ messageId: "<4>", from: "me@acme.co" }), "ME@acme.co")).toBe("ignored");
    expect(ingestReply(db, mail({ messageId: "<5>", from: "stranger@nowhere.com" }))).toBe("unmatched");
  });
});

describe("stripQuoted", () => {
  it("keeps only what the lead wrote", () => {
    const text = "Yes please.\nLet's do Tuesday.\n\nOn Mon, Oct 5, 2026 at 9:00 AM Me <me@acme.co> wrote:\n> Hello\n> there";
    expect(stripQuoted(text)).toBe("Yes please.\nLet's do Tuesday.");
    expect(stripQuoted("Hi\n> quoted\nbye")).toBe("Hi\nbye");
    expect(stripQuoted("> only quoted")).toBe("> only quoted");
  });
});

describe("kv and imapConfig", () => {
  it("stores values", () => {
    const db = openDb(":memory:");
    expect(getKv(db, "k")).toBeUndefined();
    setKv(db, "k", "1");
    setKv(db, "k", "2");
    expect(getKv(db, "k")).toBe("2");
  });

  it("is off without credentials and parses options", () => {
    expect(imapConfig({} as never)).toBeNull();
    expect(imapConfig({ IMAP_HOST: "h", IMAP_USER: "u" } as never)).toBeNull();
    expect(imapConfig({ IMAP_HOST: "h", IMAP_USER: "U@x.co", IMAP_PASS: "p", IMAP_POLL_SECONDS: "10" } as never)).toMatchObject({
      port: 993,
      secure: true,
      ownEmail: "u@x.co",
      pollMs: 120_000,
    });
  });
});
