import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";
import { SCHEMA_VERSION, migrate, openDb } from "../lib/db";
import { revealEmail } from "../lib/integrations/apollo";
import type { Fetch } from "../lib/integrations/github";
import { listAccounts } from "../lib/leads/accounts";
import { approveApproach, latestApproach, proposeApproach, runDueSteps } from "../lib/leads/approach";
import { findCompanies, getFindState } from "../lib/leads/find";
import { enrichPeople, inferOrgChart, mapPeople, orgTree, setReportsTo } from "../lib/leads/people";
import type { StructuredLlm } from "../lib/llm";
import { remaining, setPlan } from "../lib/quota";
import { createDraft, createProspect, decideDraft, getProspect, logReply, saveProfile, updateContact } from "../lib/repo";
import { sendApproved } from "../lib/send";
import { todayView } from "../lib/today";

const DAY = 86_400_000;

/** A fake Apollo: answers by path. */
function apollo(handlers: Record<string, (body: Record<string, unknown>) => unknown>) {
  const calls: { path: string; body: Record<string, unknown> }[] = [];
  const f = (async (url: string, init?: RequestInit) => {
    const path = new URL(String(url)).pathname.replace("/api/v1", "");
    const body = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
    calls.push({ path, body });
    const h = handlers[path];
    if (!h) return new Response("not found", { status: 404 });
    return new Response(JSON.stringify(h(body)), { status: 200 });
  }) as Fetch;
  return { f, calls };
}

/** A model that answers by which prompt it was given. */
const llm = (answers: { parse?: unknown; fit?: unknown; chart?: unknown; plan?: unknown; draft?: unknown }): StructuredLlm =>
  (async ({ system }: { system: string }) => {
    if (system.includes("search filters")) return answers.parse;
    if (system.includes("Rate how well")) return answers.fit;
    if (system.includes("org chart")) return answers.chart;
    if (system.includes("plan how a seller")) return answers.plan;
    return answers.draft ?? { subject: "Hello", body: "Hi there" };
  }) as never;

const PARSE = { keywords: ["warehousing", "3pl"], locations: ["united kingdom"], employeeRanges: ["101,200", "999,1"], titles: ["operations director"], signals: ["new site"] };

describe("migration", () => {
  it("gives every existing lead an account and keeps typed emails usable", () => {
    const db = new Database(":memory:");
    migrate(db, SCHEMA_VERSION() - 1);
    const t = Date.now();
    const ins = db.prepare(`INSERT INTO prospects (name, company, email, website, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`);
    ins.run("Dan", "Harrow", "dan@harrow.co", "https://harrow.co", t, t);
    ins.run("Lena", "harrow", "", "", t, t);
    ins.run("Solo Consulting", "", "", "", t, t);
    migrate(db);
    const rows = db.prepare(`SELECT name, account_id, email_status FROM prospects ORDER BY id`).all() as { name: string; account_id: number; email_status: string }[];
    expect(rows[0].account_id).toBe(rows[1].account_id);
    expect(rows[2].account_id).not.toBe(rows[0].account_id);
    expect(rows.map((r) => r.email_status)).toEqual(["manual", "", ""]);
    expect((db.prepare(`SELECT COUNT(*) AS n FROM accounts`).get() as { n: number }).n).toBe(2);
  });
});

describe("find", () => {
  it("reads the description, searches Apollo, rates fit and drops poor fits", async () => {
    const db = openDb(":memory:");
    saveProfile(db, { offer: "Rota software", icp: "UK warehouses" });
    const { f, calls } = apollo({
      "/mixed_companies/search": () => ({
        organizations: [
          { id: "o1", name: "Harrow Cold Chain", primary_domain: "harrowcc.co.uk", estimated_num_employees: 210, industry: "logistics", country: "United Kingdom" },
          { id: "o2", name: "Salt Lane Couriers", primary_domain: "saltlane.co.uk", estimated_num_employees: 55 },
        ],
        pagination: { total_entries: 2 },
      }),
    });
    const fit = { companies: [{ id: "o1", fit: 88, reason: "cold storage, 210 staff" }, { id: "o2", fit: 20, reason: "below 100 staff" }] };
    const r = await findCompanies(db, llm({ parse: PARSE, fit }), "key", "uk 3pls with 100-200 staff", f);

    expect(r).toEqual({ added: 1, dropped: 1, duplicates: 0, total: 2 });
    expect(calls[0].body).toMatchObject({ q_organization_keyword_tags: ["warehousing", "3pl"], organization_locations: ["united kingdom"], organization_num_employees_ranges: ["101,200"] });
    const all = listAccounts(db, { includeDropped: true });
    expect(all.map((a) => [a.name, a.status, a.fit])).toEqual([
      ["Harrow Cold Chain", "new", 88],
      ["Salt Lane Couriers", "dropped", 20],
    ]);
    expect(getFindState(db)).toMatchObject({ page: 2, parsed: { titles: ["operations director"] } });

    // Same description again: next page, and companies already stored are skipped.
    const again = await findCompanies(db, llm({ parse: PARSE, fit }), "key", "uk 3pls with 100-200 staff", f);
    expect(again).toMatchObject({ added: 0, duplicates: 2 });
    expect(calls[1].body.page).toBe(2);
  });
});

async function harrow() {
  const db = openDb(":memory:");
  saveProfile(db, { offer: "Rota software", icp: "UK warehouses" });
  db.prepare(`INSERT INTO accounts (name, domain, apollo_id, fit, status, created_at, updated_at) VALUES ('Harrow', 'harrow.co', 'o1', 88, 'new', 0, 0)`).run();
  const { f } = apollo({
    "/mixed_people/search": () => ({
      people: [
        { id: "p1", name: "Mark Ellison", title: "CEO" },
        { id: "p2", name: "Dan Okafor", title: "Operations Director" },
        { id: "p3", name: "Lena Brooks", title: "Site Manager" },
      ],
    }),
    "/people/match": (b) => ({ person: { email: b.id === "p2" ? "dan@harrow.co" : b.id === "p3" ? "lena@harrow.co" : null, email_status: b.id === "p2" ? "verified" : "guessed" } }),
  });
  await mapPeople(db, "key", [1], ["operations director"], f);
  const ids = Object.fromEntries((db.prepare(`SELECT id, apollo_id FROM prospects`).all() as { id: number; apollo_id: string }[]).map((r) => [r.apollo_id, r.id]));
  return { db, f, ids };
}

describe("people and org charts", () => {
  it("adds people once, sketches the chart, and breaks guessed loops", async () => {
    const { db, f, ids } = await harrow();
    await mapPeople(db, "key", [1], [], f);
    expect((db.prepare(`SELECT COUNT(*) AS n FROM prospects`).get() as { n: number }).n).toBe(3);
    expect(listAccounts(db)[0].status).toBe("mapped");

    const chart = {
      people: [
        { id: ids.p1, reportsTo: ids.p3, role: "budget", reason: "ceo" },
        { id: ids.p2, reportsTo: ids.p1, role: "decides", reason: "owns ops" },
        { id: ids.p3, reportsTo: ids.p2, role: "champion", reason: "runs a site" },
        { id: 999, reportsTo: null, role: "", reason: "not here" },
      ],
    };
    await inferOrgChart(db, llm({ chart }), 1);
    const tree = orgTree(db.prepare(`SELECT * FROM prospects WHERE account_id = 1`).all() as never);
    expect(tree).toHaveLength(1);
    expect(getProspect(db, ids.p2)).toMatchObject({ buying_role: "decides", reports_verified: 0 });

    setReportsTo(db, ids.p3, ids.p2);
    expect(getProspect(db, ids.p3)).toMatchObject({ reports_to: ids.p2, reports_verified: 1 });
    // A redraw never overwrites a confirmed line.
    await inferOrgChart(db, llm({ chart: { people: [{ id: ids.p3, reportsTo: ids.p1, role: "uses it", reason: "x" }] } }), 1);
    expect(getProspect(db, ids.p3)?.reports_to).toBe(ids.p2);
    expect(() => setReportsTo(db, ids.p3, 999)).toThrow(/same company/);
  });

  it("reveals emails within the plan allowance and records the source", async () => {
    const { db, f, ids } = await harrow();
    setPlan(db, "free");
    const before = remaining(db, "enrich");
    const r = await enrichPeople(db, "key", [ids.p1, ids.p2, ids.p3], f);
    expect(r).toEqual({ verified: 1, guessed: 1, unavailable: 1, skipped: 0 });
    expect(getProspect(db, ids.p2)).toMatchObject({ email: "dan@harrow.co", email_status: "verified", email_source: "apollo" });
    expect(remaining(db, "enrich")).toBe(before - 3);
    // Already looked up: not charged again.
    expect(await enrichPeople(db, "key", [ids.p2], f)).toMatchObject({ skipped: 1 });
    expect(remaining(db, "enrich")).toBe(before - 3);
  });

  it("maps Apollo's locked placeholder to unavailable", async () => {
    const { f } = apollo({ "/people/match": () => ({ person: { email: "email_not_unlocked@domain.com", email_status: "verified" } }) });
    expect(await revealEmail("k", "x", f)).toEqual({ email: "", status: "unavailable" });
  });
});

describe("sending guard", () => {
  it("never sends to a guessed email, but does to a hand-entered one", async () => {
    const db = openDb(":memory:");
    const risky = createProspect(db, { name: "A", company: "X" });
    db.prepare(`UPDATE prospects SET email = 'a@x.co', email_status = 'guessed' WHERE id = ?`).run(risky);
    const typed = createProspect(db, { name: "B", company: "X" });
    updateContact(db, typed, { email: "b@x.co", linkedin_url: "" });
    expect(getProspect(db, typed)?.email_status).toBe("manual");
    for (const p of [risky, typed]) decideDraft(db, createDraft(db, { prospectId: p, kind: "outreach", subject: "s", body: "b" }), "approved");
    const sent: string[] = [];
    const mailer = async (m: { to: string }) => {
      sent.push(m.to);
      return { messageId: `<${sent.length}@me.co>` };
    };
    const r = await sendApproved(db, mailer, { smtpUrl: "smtp://x", fromEmail: "me@me.co", fromName: "", footer: "", dailyCap: 10 });
    expect(sent).toEqual(["b@x.co"]);
    expect(r).toMatchObject({ sent: 1, failed: 1 });
  });
});

describe("approach plans", () => {
  async function planned() {
    const { db, f, ids } = await harrow();
    await enrichPeople(db, "key", [ids.p2, ids.p3], f);
    const plan = {
      headline: "win ops on no-shows",
      rationale: "dan decides.",
      people: [
        { id: ids.p2, angle: "the wms rollout", steps: [{ dayOffset: 0, channel: "email", summary: "first email" }, { dayOffset: 3, channel: "call", summary: "call dan" }] },
        { id: ids.p3, angle: "her swaps question", steps: [{ dayOffset: 0, channel: "email", summary: "answer first" }] },
        { id: 999, angle: "x", steps: [{ dayOffset: 0, channel: "email", summary: "nobody" }] },
      ],
    };
    const id = await proposeApproach(db, llm({ plan }), 1, [ids.p2, ids.p3], 0);
    return { db, ids, id, model: llm({ plan }) };
  }

  it("does nothing until approved, then drafts one email per account per day", async () => {
    const { db, ids, id, model } = await planned();
    expect(latestApproach(db, 1)?.steps).toHaveLength(3);
    expect(await runDueSteps(db, model, 1000)).toBe(0);
    expect(todayView(db, 1000).items.some((i) => i.key === `approach:${id}`)).toBe(true);

    db.prepare(`UPDATE prospects SET email_status = 'verified' WHERE id = ?`).run(ids.p3);
    approveApproach(db, id, 1000);
    expect(await runDueSteps(db, model, 2000)).toBe(1);
    // Drafts are stamped with the real clock; put this one on the test's timeline.
    db.prepare(`UPDATE messages SET created_at = 2000`).run();
    expect(await runDueSteps(db, model, 3000)).toBe(0); // same day: lena waits
    expect(await runDueSteps(db, model, 2000 + DAY)).toBe(1); // next day
    const drafted = latestApproach(db, 1)!.steps.filter((s) => s.status === "drafted").map((s) => s.prospect_id);
    expect(drafted.sort()).toEqual([ids.p2, ids.p3].sort());
  });

  it("skips email steps for people without a usable address", async () => {
    const { db, ids, id, model } = await planned();
    db.prepare(`UPDATE prospects SET email_status = 'unavailable', email = '' WHERE id = ?`).run(ids.p2);
    approveApproach(db, id, 0);
    await runDueSteps(db, model, 1000);
    const steps = latestApproach(db, 1)!.steps;
    expect(steps.find((s) => s.prospect_id === ids.p2 && s.channel === "email")?.status).toBe("skipped");
  });

  it("pauses the whole account when anyone replies, and surfaces due calls", async () => {
    const { db, ids, id, model } = await planned();
    approveApproach(db, id, 0);
    expect(todayView(db, 4 * DAY).items.some((i) => i.label === "leads · call today")).toBe(true);
    logReply(db, ids.p3, "Interested, call me");
    expect(await runDueSteps(db, model, DAY)).toBe(0);
    expect(latestApproach(db, 1)?.status).toBe("paused");
    expect(listAccounts(db)[0].status).toBe("in_conversation");
  });
});
