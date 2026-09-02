import { describe, it, expect, vi } from "vitest";
import type { CrawlResult, CrawledPage } from "../src/types.js";

const completeJsonMock = vi.fn();
vi.mock("../src/llm/openrouter.js", () => ({
  completeJson: (opts: unknown) => completeJsonMock(opts),
}));

const { runOnPageAudit } = await import("../src/audit/onpage.js");

function page(url: string): CrawledPage {
  return {
    url,
    statusCode: 200,
    title: "A title",
    metaDescription: "A description",
    h1: ["H1"],
    h2: [],
    canonical: url,
    robotsMeta: null,
    wordCount: 300,
    textSample: "Some content",
    html: "<html></html>",
    links: [],
    images: [],
    jsonLd: [],
    headers: {},
    fetchedAt: new Date().toISOString(),
  };
}

function crawl(pages: CrawledPage[]): CrawlResult {
  return {
    rootUrl: "https://example.com/",
    pages,
    robotsTxt: { found: true, content: "", disallowsRoot: false },
    sitemap: { found: true, urlCount: pages.length, urls: pages.map((p) => p.url) },
    llmsTxt: { found: false, content: null },
    truncated: false,
    crawler: "fallback",
  };
}

describe("runOnPageAudit", () => {
  it("maps a well-formed LLM finding onto a URL that was actually crawled", async () => {
    completeJsonMock.mockReset();
    completeJsonMock.mockResolvedValue({
      findings: [
        {
          url: "https://example.com/",
          title: "Thin title",
          detail: "Too short",
          currentValue: "A title",
          severity: "warning",
          recommendedChange: "Lengthen it",
          expectedImpact: "Better CTR",
          estimatedEffort: "low",
        },
      ],
    });

    const onUsage = vi.fn();
    const onWarning = vi.fn();
    const findings = await runOnPageAudit(crawl([page("https://example.com/")]), null, onUsage, () => false, onWarning);

    expect(findings).toHaveLength(1);
    expect(findings[0].agent).toBe("onpage");
    expect(findings[0].evidence[0]).toEqual({ url: "https://example.com/", currentValue: "A title" });
    expect(onWarning).not.toHaveBeenCalled();
  });

  it("drops a finding that references a URL outside the crawled sample (hallucinated URL)", async () => {
    completeJsonMock.mockReset();
    completeJsonMock.mockResolvedValue({
      findings: [
        {
          url: "https://not-in-the-crawl.example/",
          title: "x",
          detail: "x",
          currentValue: "x",
          severity: "notice",
          recommendedChange: "x",
          expectedImpact: "x",
          estimatedEffort: "low",
        },
      ],
    });

    const findings = await runOnPageAudit(crawl([page("https://example.com/")]), null, vi.fn(), () => false, vi.fn());
    expect(findings).toHaveLength(0);
  });

  it("drops a finding missing a required field instead of producing 'undefined' text", async () => {
    completeJsonMock.mockReset();
    completeJsonMock.mockResolvedValue({
      findings: [
        {
          url: "https://example.com/",
          title: "", // empty — should be rejected
          detail: "detail",
          currentValue: "value",
          severity: "notice",
          recommendedChange: "x",
          expectedImpact: "x",
          estimatedEffort: "low",
        },
      ],
    });

    const findings = await runOnPageAudit(crawl([page("https://example.com/")]), null, vi.fn(), () => false, vi.fn());
    expect(findings).toHaveLength(0);
  });

  it("reports a warning and continues when the LLM call fails, without throwing", async () => {
    completeJsonMock.mockReset();
    completeJsonMock.mockRejectedValue(new Error("OPENROUTER_API_KEY is not set"));

    const onWarning = vi.fn();
    const findings = await runOnPageAudit(crawl([page("https://example.com/")]), null, vi.fn(), () => false, onWarning);

    expect(findings).toHaveLength(0);
    expect(onWarning).toHaveBeenCalledWith(expect.stringContaining("OPENROUTER_API_KEY"));
  });

  it("stops issuing batches once the cost ceiling is exceeded", async () => {
    completeJsonMock.mockReset();
    completeJsonMock.mockResolvedValue({ findings: [] });

    const pages = Array.from({ length: 12 }, (_, i) => page(`https://example.com/${i}`));
    await runOnPageAudit(crawl(pages), null, vi.fn(), () => true, vi.fn());

    expect(completeJsonMock).not.toHaveBeenCalled();
  });
});
