import { describe, it, expect } from "vitest";
import { runTechnicalAudit } from "../src/audit/technical.js";
import type { CrawlResult, CrawledPage } from "../src/types.js";

function page(overrides: Partial<CrawledPage>): CrawledPage {
  return {
    url: "https://example.com/",
    statusCode: 200,
    title: "Example",
    metaDescription: "An example page",
    h1: ["Example"],
    h2: [],
    canonical: "https://example.com/",
    robotsMeta: null,
    wordCount: 500,
    textSample: "Example content",
    html: '<html><head><meta name="viewport" content="width=device-width"></head><body></body></html>',
    links: [],
    images: [],
    jsonLd: [],
    headers: { "strict-transport-security": "max-age=1" },
    fetchedAt: new Date().toISOString(),
    ...overrides,
  };
}

function crawl(pages: CrawledPage[], overrides: Partial<CrawlResult> = {}): CrawlResult {
  return {
    rootUrl: "https://example.com/",
    pages,
    robotsTxt: { found: true, content: "User-agent: *\nAllow: /", disallowsRoot: false },
    sitemap: { found: true, urlCount: pages.length, urls: pages.map((p) => p.url) },
    llmsTxt: { found: true, content: "# llms.txt" },
    truncated: false,
    crawler: "fallback",
    ...overrides,
  };
}

describe("runTechnicalAudit", () => {
  it("flags a page with no title", () => {
    const findings = runTechnicalAudit(crawl([page({ title: null })]));
    expect(findings.some((f) => f.title.includes("no <title>"))).toBe(true);
  });

  it("flags a page with no meta description", () => {
    const findings = runTechnicalAudit(crawl([page({ metaDescription: null })]));
    expect(findings.some((f) => f.title.includes("no meta description"))).toBe(true);
  });

  it("flags 4xx/5xx pages by status code", () => {
    const findings = runTechnicalAudit(crawl([page({ statusCode: 404, title: "Missing" })]));
    const f = findings.find((f) => f.title.includes("HTTP 404"));
    expect(f).toBeTruthy();
    expect(f?.severity).toBe("warning");
  });

  it("flags robots.txt disallowing the whole site as critical", () => {
    const findings = runTechnicalAudit(crawl([page({})], { robotsTxt: { found: true, content: "Disallow: /", disallowsRoot: true } }));
    const f = findings.find((f) => f.title.includes("blocks the entire site"));
    expect(f?.severity).toBe("critical");
  });

  it("flags missing llms.txt as a geo-aeo finding", () => {
    const findings = runTechnicalAudit(crawl([page({})], { llmsTxt: { found: false, content: null } }));
    const f = findings.find((f) => f.title.includes("llms.txt"));
    expect(f?.category).toBe("geo-aeo");
  });

  it("produces no title/description/h1 findings for a clean page", () => {
    const findings = runTechnicalAudit(crawl([page({})]));
    expect(findings.some((f) => f.title.includes("no <title>"))).toBe(false);
    expect(findings.some((f) => f.title.includes("no meta description"))).toBe(false);
    expect(findings.some((f) => f.title.includes("no <h1>"))).toBe(false);
  });

  it("every finding carries at least one piece of URL-backed evidence", () => {
    const findings = runTechnicalAudit(crawl([page({ title: null, metaDescription: null })]));
    for (const f of findings) {
      expect(f.evidence.length).toBeGreaterThan(0);
      for (const e of f.evidence) expect(e.url).toMatch(/^https?:\/\//);
    }
  });
});
