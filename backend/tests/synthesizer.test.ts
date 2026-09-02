import { describe, it, expect, vi } from "vitest";
import type { AuditFinding } from "../src/types.js";

const completeJsonMock = vi.fn();
vi.mock("../src/llm/openrouter.js", () => ({
  completeJson: (opts: unknown) => completeJsonMock(opts),
}));

const { synthesize } = await import("../src/synth/synthesizer.js");

function finding(id: string): AuditFinding {
  return {
    id,
    agent: "technical",
    title: "A finding",
    detail: "detail",
    evidence: [{ url: "https://example.com/", currentValue: "x" }],
    severity: "warning",
    recommendedChange: "fix it",
    expectedImpact: "impact",
    estimatedEffort: "low",
    category: "on-page",
  };
}

describe("synthesize", () => {
  it("returns [] immediately for no findings, without calling the model", async () => {
    completeJsonMock.mockReset();
    const result = await synthesize([], null, vi.fn(), vi.fn());
    expect(result).toEqual([]);
    expect(completeJsonMock).not.toHaveBeenCalled();
  });

  it("carries evidence over from the referenced findings and sorts by priority", async () => {
    completeJsonMock.mockReset();
    completeJsonMock.mockResolvedValue({
      suggestions: [
        {
          findingIds: ["f-1"],
          priority: "P2",
          title: "Low first",
          why: "why",
          recommendedChange: "change",
          expectedImpact: "impact",
          estimatedEffort: "low",
          falsifiable: true,
        },
        {
          findingIds: ["f-1"],
          priority: "P0",
          title: "Critical second",
          why: "why",
          recommendedChange: "change",
          expectedImpact: "impact",
          estimatedEffort: "low",
          falsifiable: true,
        },
      ],
    });

    const result = await synthesize([finding("f-1")], null, vi.fn(), vi.fn());
    expect(result.map((s) => s.priority)).toEqual(["P0", "P2"]);
    expect(result[0].evidence).toEqual([{ url: "https://example.com/", currentValue: "x" }]);
  });

  it("drops a suggestion marked not falsifiable", async () => {
    completeJsonMock.mockReset();
    completeJsonMock.mockResolvedValue({
      suggestions: [
        {
          findingIds: ["f-1"],
          priority: "P1",
          title: "Vague",
          why: "why",
          recommendedChange: "change",
          expectedImpact: "impact",
          estimatedEffort: "low",
          falsifiable: false,
        },
      ],
    });

    const result = await synthesize([finding("f-1")], null, vi.fn(), vi.fn());
    expect(result).toHaveLength(0);
  });

  it("drops a suggestion whose findingIds don't resolve to any real evidence", async () => {
    completeJsonMock.mockReset();
    completeJsonMock.mockResolvedValue({
      suggestions: [
        {
          findingIds: ["does-not-exist"],
          priority: "P1",
          title: "Orphaned",
          why: "why",
          recommendedChange: "change",
          expectedImpact: "impact",
          estimatedEffort: "low",
          falsifiable: true,
        },
      ],
    });

    const result = await synthesize([finding("f-1")], null, vi.fn(), vi.fn());
    expect(result).toHaveLength(0);
  });

  it("falls back to P3 for an invalid priority instead of producing a bad sort key", async () => {
    completeJsonMock.mockReset();
    completeJsonMock.mockResolvedValue({
      suggestions: [
        {
          findingIds: ["f-1"],
          priority: "P9",
          title: "Bad priority",
          why: "why",
          recommendedChange: "change",
          expectedImpact: "impact",
          estimatedEffort: "low",
          falsifiable: true,
        },
      ],
    });

    const result = await synthesize([finding("f-1")], null, vi.fn(), vi.fn());
    expect(result[0].priority).toBe("P3");
  });

  it("reports a warning and returns [] when every chunk call fails", async () => {
    completeJsonMock.mockReset();
    completeJsonMock.mockRejectedValue(new Error("synthesis boom"));

    const onWarning = vi.fn();
    const result = await synthesize([finding("f-1")], null, vi.fn(), onWarning);

    expect(result).toEqual([]);
    expect(onWarning).toHaveBeenCalledWith(expect.stringContaining("synthesis boom"));
  });
});
