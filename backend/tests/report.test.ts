import { describe, it, expect } from "vitest";
import { computeScore, renderMarkdown } from "../src/synth/report.js";
import type { AuditFinding, AuditRun } from "../src/types.js";

function finding(overrides: Partial<AuditFinding>): AuditFinding {
  return {
    id: "f-1",
    agent: "technical",
    title: "Test finding",
    detail: "detail",
    evidence: [{ url: "https://example.com/", currentValue: "x" }],
    severity: "warning",
    recommendedChange: "fix it",
    expectedImpact: "impact",
    estimatedEffort: "low",
    category: "on-page",
    ...overrides,
  };
}

describe("computeScore", () => {
  it("returns 100 for no findings", () => {
    expect(computeScore([])).toBe(100);
  });

  it("docks more for critical than notice", () => {
    const critical = computeScore([finding({ severity: "critical" })]);
    const notice = computeScore([finding({ severity: "notice" })]);
    expect(critical).toBeLessThan(notice);
  });

  it("never goes below 0", () => {
    const many = Array.from({ length: 50 }, () => finding({ severity: "critical" }));
    expect(computeScore(many)).toBe(0);
  });
});

describe("renderMarkdown", () => {
  it("groups suggestions by priority with evidence and status", () => {
    const run: AuditRun = {
      id: "run-1",
      url: "https://example.com",
      constraints: null,
      docs: [],
      status: "awaiting_approval",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      findings: [],
      suggestions: [
        {
          id: "s-1",
          findingIds: ["f-1"],
          priority: "P0",
          title: "Fix missing titles",
          why: "14 pages have no title",
          evidence: [{ url: "https://example.com/pricing", currentValue: "(no title)" }],
          recommendedChange: "Add unique titles",
          expectedImpact: "+CTR",
          estimatedEffort: "low",
          falsifiable: true,
          status: "pending",
        },
      ],
      modelCalls: [],
      costUsd: 0.01,
      score: 80,
    };

    const md = renderMarkdown(run);
    expect(md).toContain("P0");
    expect(md).toContain("Fix missing titles");
    expect(md).toContain("https://example.com/pricing");
    expect(md).toContain("pending");
  });
});
