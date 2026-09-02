import { describe, it, expect, vi } from "vitest";
import type { DocStore } from "../src/rag/docStore.js";

const completeMock = vi.fn();
const completeJsonMock = vi.fn();
vi.mock("../src/llm/openrouter.js", () => ({
  complete: (opts: unknown) => completeMock(opts),
  completeJson: (opts: unknown) => completeJsonMock(opts),
}));

const { runAiVisibilityAudit } = await import("../src/audit/aiVisibility.js");

function noopDocStore(searchResult: { docName: string; text: string }[] = []): DocStore {
  return {
    chunks: [],
    truncated: false,
    search: vi.fn().mockResolvedValue(searchResult),
  };
}

describe("runAiVisibilityAudit", () => {
  it("returns [] immediately when there are no prompts or no models", async () => {
    completeMock.mockReset();
    expect(await runAiVisibilityAudit({ brand: "Acme", siteUrl: "https://acme.com", prompts: [], models: ["m1"] }, null, vi.fn(), () => false, vi.fn())).toEqual([]);
    expect(await runAiVisibilityAudit({ brand: "Acme", siteUrl: "https://acme.com", prompts: ["q"], models: [] }, null, vi.fn(), () => false, vi.fn())).toEqual([]);
    expect(completeMock).not.toHaveBeenCalled();
  });

  it("flags a prompt when some but not all models mention the brand, as a warning", async () => {
    completeMock.mockReset();
    completeMock
      .mockResolvedValueOnce("You should use Acme for this.")
      .mockResolvedValueOnce("I'd recommend Cadence or Ravelin.");

    const findings = await runAiVisibilityAudit(
      { brand: "Acme", siteUrl: "https://acme.com", prompts: ["best tool for X"], models: ["model-a", "model-b"] },
      null,
      vi.fn(),
      () => false,
      vi.fn(),
    );

    expect(findings).toHaveLength(1);
    expect(findings[0].agent).toBe("ai-visibility");
    expect(findings[0].severity).toBe("warning");
    expect(findings[0].evidence).toHaveLength(1);
    expect(findings[0].evidence[0].currentValue).toContain("model-b");
  });

  it("flags a prompt as critical when no model mentions the brand", async () => {
    completeMock.mockReset();
    completeMock.mockResolvedValue("I'd recommend Cadence.");

    const findings = await runAiVisibilityAudit(
      { brand: "Acme", siteUrl: "https://acme.com", prompts: ["best tool for X"], models: ["model-a"] },
      null,
      vi.fn(),
      () => false,
      vi.fn(),
    );

    expect(findings).toHaveLength(1);
    expect(findings[0].severity).toBe("critical");
  });

  it("does not flag a prompt every model mentions the brand for", async () => {
    completeMock.mockReset();
    completeMock.mockResolvedValue("Acme is a great choice for this.");

    const findings = await runAiVisibilityAudit(
      { brand: "Acme", siteUrl: "https://acme.com", prompts: ["best tool for X"], models: ["model-a", "model-b"] },
      null,
      vi.fn(),
      () => false,
      vi.fn(),
    );

    expect(findings).toHaveLength(0);
  });

  it("brand matching is case-insensitive", async () => {
    completeMock.mockReset();
    completeMock.mockResolvedValue("i'd say ACME is the best option.");

    const findings = await runAiVisibilityAudit(
      { brand: "Acme", siteUrl: "https://acme.com", prompts: ["q"], models: ["model-a"] },
      null,
      vi.fn(),
      () => false,
      vi.fn(),
    );

    expect(findings).toHaveLength(0);
  });

  it("runs an accuracy check against company docs only when the brand was mentioned somewhere", async () => {
    completeMock.mockReset();
    completeJsonMock.mockReset();
    completeMock.mockResolvedValue("Acme costs $199/month.");
    completeJsonMock.mockResolvedValue({
      findings: [
        {
          claimQuoted: "Acme costs $199/month",
          currentValue: "$199/month",
          severity: "critical",
          detail: "The current price is $79/month, not $199.",
          recommendedChange: "Publish current pricing clearly and update stale sources.",
          expectedImpact: "Buyers stop seeing a wrong price.",
          estimatedEffort: "low",
        },
      ],
    });

    const docStore = noopDocStore([{ docName: "pricing.txt", text: "Acme costs $79/month." }]);
    const findings = await runAiVisibilityAudit(
      { brand: "Acme", siteUrl: "https://acme.com", prompts: ["what does acme cost"], models: ["model-a"] },
      docStore,
      vi.fn(),
      () => false,
      vi.fn(),
    );

    expect(completeJsonMock).toHaveBeenCalledTimes(1);
    expect(findings.some((f) => f.title.includes("$199"))).toBe(true);
  });

  it("skips the accuracy check entirely when no model mentioned the brand", async () => {
    completeMock.mockReset();
    completeJsonMock.mockReset();
    completeMock.mockResolvedValue("I'd recommend Cadence.");

    const docStore = noopDocStore([{ docName: "pricing.txt", text: "Acme costs $79/month." }]);
    await runAiVisibilityAudit(
      { brand: "Acme", siteUrl: "https://acme.com", prompts: ["q"], models: ["model-a"] },
      docStore,
      vi.fn(),
      () => false,
      vi.fn(),
    );

    expect(completeJsonMock).not.toHaveBeenCalled();
  });

  it("reports a warning and continues when a model call fails", async () => {
    completeMock.mockReset();
    completeMock.mockRejectedValueOnce(new Error("model unavailable")).mockResolvedValueOnce("Acme is great.");

    const onWarning = vi.fn();
    const findings = await runAiVisibilityAudit(
      { brand: "Acme", siteUrl: "https://acme.com", prompts: ["q"], models: ["model-a", "model-b"] },
      null,
      vi.fn(),
      () => false,
      onWarning,
    );

    expect(onWarning).toHaveBeenCalledWith(expect.stringContaining("model unavailable"));
    // Only one check succeeded (model-b, mentioned) — nothing to flag as missed.
    expect(findings).toHaveLength(0);
  });

  it("stops issuing model calls once the cost ceiling is exceeded", async () => {
    completeMock.mockReset();
    const findings = await runAiVisibilityAudit(
      { brand: "Acme", siteUrl: "https://acme.com", prompts: ["q1", "q2"], models: ["model-a"] },
      null,
      vi.fn(),
      () => true,
      vi.fn(),
    );

    expect(completeMock).not.toHaveBeenCalled();
    expect(findings).toHaveLength(0);
  });
});
