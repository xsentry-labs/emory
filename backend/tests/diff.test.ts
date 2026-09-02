import { describe, it, expect } from "vitest";
import { diffFindings } from "../src/synth/diff.js";
import type { AuditFinding } from "../src/types.js";

function finding(overrides: Partial<AuditFinding>): AuditFinding {
  return {
    id: "f-" + Math.random(),
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

describe("diffFindings", () => {
  it("classifies an unchanged finding as persisting", () => {
    const prev = [finding({ evidence: [{ url: "https://example.com/a", currentValue: "x" }] })];
    const curr = [finding({ evidence: [{ url: "https://example.com/a", currentValue: "x" }] })];
    const result = diffFindings(prev, curr);
    expect(result.persisting).toHaveLength(1);
    expect(result.added).toHaveLength(0);
    expect(result.resolved).toHaveLength(0);
  });

  it("classifies a finding only in the current run as added", () => {
    const prev: AuditFinding[] = [];
    const curr = [finding({ evidence: [{ url: "https://example.com/new", currentValue: "x" }] })];
    const result = diffFindings(prev, curr);
    expect(result.added).toHaveLength(1);
    expect(result.resolved).toHaveLength(0);
  });

  it("classifies a finding only in the previous run as resolved", () => {
    const prev = [finding({ evidence: [{ url: "https://example.com/fixed", currentValue: "x" }] })];
    const curr: AuditFinding[] = [];
    const result = diffFindings(prev, curr);
    expect(result.resolved).toHaveLength(1);
    expect(result.added).toHaveLength(0);
  });

  it("still matches as persisting when only the LLM-phrased title changed", () => {
    const prev = [
      finding({
        title: "14 pages have no title",
        evidence: [{ url: "https://example.com/pricing", currentValue: "(none)" }],
      }),
    ];
    const curr = [
      finding({
        title: "Pages missing a <title> tag",
        evidence: [{ url: "https://example.com/pricing", currentValue: "(none)" }],
      }),
    ];
    const result = diffFindings(prev, curr);
    expect(result.persisting).toHaveLength(1);
    expect(result.added).toHaveLength(0);
    expect(result.resolved).toHaveLength(0);
  });

  it("treats different agents on the same URL as different findings", () => {
    const prev = [finding({ agent: "technical", evidence: [{ url: "https://example.com/", currentValue: "x" }] })];
    const curr = [finding({ agent: "onpage", evidence: [{ url: "https://example.com/", currentValue: "x" }] })];
    const result = diffFindings(prev, curr);
    expect(result.added).toHaveLength(1);
    expect(result.resolved).toHaveLength(1);
  });

  it("handles empty inputs without error", () => {
    expect(diffFindings([], [])).toEqual({ added: [], resolved: [], persisting: [] });
  });
});
