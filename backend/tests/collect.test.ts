import { describe, it, expect, vi } from "vitest";
import type { CrawledPage } from "../src/types.js";

const fallbackCrawlMock = vi.fn();
vi.mock("../src/crawl/fallbackCrawler.js", () => ({
  fallbackCrawl: (url: string, maxPages: number) => fallbackCrawlMock(url, maxPages),
}));

vi.mock("../src/crawl/robotsSitemap.js", () => ({
  fetchRobotsTxt: async () => ({ found: false, content: null, disallowsRoot: false }),
  fetchLlmsTxt: async () => ({ found: false, content: null }),
  fetchSitemapUrls: async () => ({ found: false, urlCount: 0, urls: [] }),
}));

const { collect } = await import("../src/crawl/collect.js");

function page(url: string): CrawledPage {
  return {
    url,
    statusCode: 200,
    title: "t",
    metaDescription: null,
    h1: [],
    h2: [],
    canonical: null,
    robotsMeta: null,
    wordCount: 1,
    textSample: "",
    html: null,
    links: [],
    images: [],
    jsonLd: [],
    headers: {},
    fetchedAt: new Date().toISOString(),
  };
}

describe("collect", () => {
  it("throws a clear error when zero pages could be fetched at all", async () => {
    fallbackCrawlMock.mockReset();
    fallbackCrawlMock.mockResolvedValue([]);

    await expect(collect("https://totally-unreachable.example")).rejects.toThrow(/Could not fetch any pages/);
  });

  it("normalizes a bare domain (no scheme) to https", async () => {
    fallbackCrawlMock.mockReset();
    fallbackCrawlMock.mockResolvedValue([page("https://example.com/")]);

    const result = await collect("example.com");
    expect(result.rootUrl).toBe("https://example.com/");
  });

  it("succeeds when at least one page is fetched", async () => {
    fallbackCrawlMock.mockReset();
    fallbackCrawlMock.mockResolvedValue([page("https://example.com/")]);

    const result = await collect("https://example.com");
    expect(result.pages).toHaveLength(1);
    expect(result.crawler).toBe("fallback");
  });
});
