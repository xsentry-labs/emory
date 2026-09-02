import { describe, it, expect } from "vitest";
import { renderDiffMarkdown } from "../src/synth/diffReport.js";
import type { AuditFinding, AuditRun } from "../src/types.js";

function finding(overrides: Partial<AuditFinding>): AuditFinding {
  return {
    id: "f-1",
    agent: "technical",
    title: "A finding",
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

function run(overrides: Partial<AuditRun>): AuditRun {
  return {
    id: "run-1",
    url: "https://example.com",
    constraints: null,
    docs: [],
    status: "awaiting_approval",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    findings: [],
    suggestions: [],
    modelCalls: [],
    costUsd: 0,
    warnings: [],
    score: 80,
    ...overrides,
  };
}

describe("renderDiffMarkdown", () => {
  it("renders resolved, added, and persisting sections with the score delta", () => {
    const current = run({ id: "run-2", score: 90 });
    const previous = run({ id: "run-1", score: 70 });

    const md = renderDiffMarkdown(
      {
        added: [finding({ title: "New issue" })],
        resolved: [finding({ title: "Fixed issue" })],
        persisting: [finding({ title: "Still broken" })],
      },
      current,
      previous,
    );

    expect(md).toContain("## Resolved since last time");
    expect(md).toContain("Fixed issue");
    expect(md).toContain("## New since last time");
    expect(md).toContain("New issue");
    expect(md).toContain("## Still open");
    expect(md).toContain("Still broken");
    expect(md).toContain("70");
    expect(md).toContain("90");
  });

  it("omits empty sections", () => {
    const current = run({ id: "run-2" });
    const previous = run({ id: "run-1" });

    const md = renderDiffMarkdown({ added: [], resolved: [finding({})], persisting: [] }, current, previous);

    expect(md).toContain("## Resolved since last time");
    expect(md).not.toContain("## New since last time");
    expect(md).not.toContain("## Still open");
  });

  it("says so when nothing is in either run", () => {
    const current = run({ id: "run-2" });
    const previous = run({ id: "run-1" });
    const md = renderDiffMarkdown({ added: [], resolved: [], persisting: [] }, current, previous);
    expect(md).toContain("No findings in either run.");
  });
});
