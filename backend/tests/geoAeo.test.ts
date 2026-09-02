import { describe, it, expect, vi } from "vitest";
import type { CrawlResult, CrawledPage } from "../src/types.js";

const completeJsonMock = vi.fn();
vi.mock("../src/llm/openrouter.js", () => ({
  completeJson: (opts: unknown) => completeJsonMock(opts),
}));

const { runGeoAeoAudit } = await import("../src/audit/geoAeo.js");

function page(url: string, overrides: Partial<CrawledPage> = {}): CrawledPage {
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
    ...overrides,
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

describe("runGeoAeoAudit", () => {
  it("maps a well-formed LLM finding onto a crawled URL, including codeGuidance", async () => {
    completeJsonMock.mockReset();
    completeJsonMock.mockResolvedValue({
      findings: [
        {
          url: "https://example.com/pricing",
          title: "Pricing page has Product schema with no Offer",
          detail: "Product schema is present but has no price/availability.",
          currentValue: '{"@type":"Product","name":"Plan"}',
          severity: "warning",
          recommendedChange: "Add an Offer with price, priceCurrency, and availability.",
          codeGuidance: '{"@type":"Offer","price":"79","priceCurrency":"USD","availability":"https://schema.org/InStock"}',
          expectedImpact: "AI shopping tools can read current pricing.",
          estimatedEffort: "low",
        },
      ],
    });

    const findings = await runGeoAeoAudit(crawl([page("https://example.com/pricing")]), null, vi.fn(), () => false, vi.fn());

    expect(findings).toHaveLength(1);
    expect(findings[0].agent).toBe("geo-aeo");
    expect(findings[0].category).toBe("geo-aeo");
    expect(findings[0].codeGuidance).toContain("Offer");
    expect(findings[0].evidence[0]).toEqual({ url: "https://example.com/pricing", currentValue: '{"@type":"Product","name":"Plan"}' });
  });

  it("drops a finding that references a URL outside the crawled sample", async () => {
    completeJsonMock.mockReset();
    completeJsonMock.mockResolvedValue({
      findings: [
        {
          url: "https://not-crawled.example/",
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

    const findings = await runGeoAeoAudit(crawl([page("https://example.com/")]), null, vi.fn(), () => false, vi.fn());
    expect(findings).toHaveLength(0);
  });

  it("drops a finding missing a required field", async () => {
    completeJsonMock.mockReset();
    completeJsonMock.mockResolvedValue({
      findings: [
        {
          url: "https://example.com/",
          title: "x",
          detail: "",
          currentValue: "x",
          severity: "notice",
          recommendedChange: "x",
          expectedImpact: "x",
          estimatedEffort: "low",
        },
      ],
    });

    const findings = await runGeoAeoAudit(crawl([page("https://example.com/")]), null, vi.fn(), () => false, vi.fn());
    expect(findings).toHaveLength(0);
  });

  it("reports a warning and continues when the LLM call fails", async () => {
    completeJsonMock.mockReset();
    completeJsonMock.mockRejectedValue(new Error("OPENROUTER_API_KEY is not set"));

    const onWarning = vi.fn();
    const findings = await runGeoAeoAudit(crawl([page("https://example.com/")]), null, vi.fn(), () => false, onWarning);

    expect(findings).toHaveLength(0);
    expect(onWarning).toHaveBeenCalledWith(expect.stringContaining("GEO/AEO audit"));
  });

  it("stops issuing batches once the cost ceiling is exceeded", async () => {
    completeJsonMock.mockReset();
    completeJsonMock.mockResolvedValue({ findings: [] });

    const pages = Array.from({ length: 8 }, (_, i) => page(`https://example.com/${i}`));
    await runGeoAeoAudit(crawl(pages), null, vi.fn(), () => true, vi.fn());

    expect(completeJsonMock).not.toHaveBeenCalled();
  });
});
