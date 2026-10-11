import { describe, expect, it } from "vitest";
import { openDb } from "../lib/db";
import { PLAN_LIST, defaultPlan, formatPrice, planById } from "../lib/pricing";
import { QuotaError, allowance, charge, planOf, quotaSummary, recordUsage, remaining, setPlan, usedThisMonth } from "../lib/quota";
import { saveProfile } from "../lib/repo";
import { sourceLeads, type Searcher } from "../lib/sourcing";
import { startAudit } from "../lib/seo/audit";

describe("plans", () => {
  it("are ordered by size and priced sensibly", () => {
    expect(PLAN_LIST.map((p) => p.id)).toEqual(["free", "starter", "growth", "scale"]);
    for (let i = 1; i < PLAN_LIST.length; i++) {
      expect(PLAN_LIST[i].limits.leads).toBeGreaterThan(PLAN_LIST[i - 1].limits.leads);
    }
    expect(PLAN_LIST.map(formatPrice)).toEqual(["$0", "$49", "$149", "Custom"]);
    expect(planById("growth")?.highlight).toBe(true);
    expect(planById("nope")).toBeUndefined();
  });

  it("default to free unless DEFAULT_PLAN names a real plan", () => {
    expect(defaultPlan({})).toBe("free");
    expect(defaultPlan({ DEFAULT_PLAN: "Growth" })).toBe("growth");
    expect(defaultPlan({ DEFAULT_PLAN: "enterprise" })).toBe("free");
  });
});

describe("quota", () => {
  const march = Date.UTC(2026, 2, 15);
  const april = Date.UTC(2026, 3, 2);

  it("tracks usage per month and kind, and resets next month", () => {
    const db = openDb(":memory:");
    expect(planOf(db).id).toBe("free");
    recordUsage(db, "leads", 10, march);
    recordUsage(db, "leads", 5, march);
    expect(usedThisMonth(db, "leads", march)).toBe(15);
    expect(remaining(db, "leads", march)).toBe(10);
    expect(usedThisMonth(db, "seo", march)).toBe(0);
    expect(usedThisMonth(db, "leads", april)).toBe(0);
  });

  it("caps what is allowed, then refuses with an upgrade message", () => {
    const db = openDb(":memory:");
    expect(allowance(db, "leads", 10, march)).toBe(10);
    recordUsage(db, "leads", 20, march);
    expect(allowance(db, "leads", 10, march)).toBe(5);
    recordUsage(db, "leads", 5, march);
    expect(() => allowance(db, "leads", 1, march)).toThrow(QuotaError);
    expect(() => allowance(db, "leads", 1, march)).toThrow(/all 25 leads included in the Free plan.*pricing/);
  });

  it("changes limits when the plan changes", () => {
    const db = openDb(":memory:");
    recordUsage(db, "leads", 25, march);
    expect(remaining(db, "leads", march)).toBe(0);
    setPlan(db, "starter");
    expect(planOf(db).name).toBe("Starter");
    expect(remaining(db, "leads", march)).toBe(225);
  });

  it("charge counts a single unit and refuses past the limit", () => {
    const db = openDb(":memory:");
    charge(db, "seo", 1, march);
    expect(() => charge(db, "seo", 1, march)).toThrow(/all 1 SEO audit included/);
    expect(usedThisMonth(db, "seo", march)).toBe(1);
  });

  it("summarises usage for the sidebar", () => {
    const db = openDb(":memory:");
    setPlan(db, "growth");
    recordUsage(db, "ai", 3);
    const s = quotaSummary(db);
    expect(s.plan).toEqual({ id: "growth", name: "Growth" });
    expect(s.items.find((i) => i.kind === "ai")).toMatchObject({ used: 3, limit: 400 });
    expect(s.items.map((i) => i.kind)).toEqual(["leads", "seo", "ai"]);
  });
});

describe("enforcement points", () => {
  const search = (n: number): Searcher => async () => ({
    text: JSON.stringify({
      leads: Array.from({ length: n }, (_, i) => ({ name: `P${i}`, company: `C${i}`, website: `c${i}.io`, email: "", notes: "", source_url: "", linkedin_url: "" })),
    }),
    citedDomains: Array.from({ length: n }, (_, i) => `c${i}.io`),
  });
  const setup = () => {
    const db = openDb(":memory:");
    saveProfile(db, { offer: "SEO", icp: "SaaS" });
    return db;
  };

  it("sourcing adds only what the plan still allows, and counts what it added", async () => {
    const db = setup();
    recordUsage(db, "leads", 20); // free plan: 25 a month, 5 left
    const r = await sourceLeads(db, search(10), { count: 10 });
    expect(r.added).toBe(5);
    expect(usedThisMonth(db, "leads")).toBe(25);
    await expect(sourceLeads(db, search(3), { count: 3 })).rejects.toThrow(/all 25 leads included/);
  });

  it("does not count duplicates or unverified leads against the allowance", async () => {
    const db = setup();
    await sourceLeads(db, search(3), { count: 3 });
    expect(usedThisMonth(db, "leads")).toBe(3);
    await sourceLeads(db, search(3), { count: 3 }); // all duplicates now
    expect(usedThisMonth(db, "leads")).toBe(3);
  });

  it("an SEO audit costs one audit, and a refused one is not charged", () => {
    const db = setup();
    const never = async () => {
      await new Promise(() => {});
      throw new Error("unreachable");
    };
    expect(startAudit(db, { llm: null, fetchPage: never as never }, "acme.co")).toBe(true);
    expect(usedThisMonth(db, "seo")).toBe(1);
    // A second start while one runs is declined before charging.
    expect(startAudit(db, { llm: null, fetchPage: never as never }, "acme.co")).toBe(false);
    expect(usedThisMonth(db, "seo")).toBe(1);
  });
});
