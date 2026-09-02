import { describe, it, expect, vi, beforeEach } from "vitest";
import type { CrawlResult, CrawledPage } from "../src/types.js";

const configState = { pagespeedApiKey: "", disableLocalLighthouse: false };
vi.mock("../src/config.js", () => ({
  config: configState,
}));

const runLocalLighthouseMock = vi.fn();
vi.mock("../src/audit/localLighthouse.js", () => ({
  runLocalLighthouse: (url: string) => runLocalLighthouseMock(url),
}));

const { runPerformanceAudit } = await import("../src/audit/pagespeed.js");

function page(url: string, images = 0, htmlLength = 100): CrawledPage {
  return {
    url,
    statusCode: 200,
    title: "t",
    metaDescription: "d",
    h1: [],
    h2: [],
    canonical: null,
    robotsMeta: null,
    wordCount: 10,
    textSample: "",
    html: "x".repeat(htmlLength),
    links: [],
    images: Array.from({ length: images }, () => ({ src: "x", alt: "a" })),
    jsonLd: [],
    headers: {},
    fetchedAt: new Date().toISOString(),
  };
}

function crawl(pages: CrawledPage[]): CrawlResult {
  return {
    rootUrl: pages[0]?.url ?? "https://example.com/",
    pages,
    robotsTxt: { found: true, content: "", disallowsRoot: false },
    sitemap: { found: true, urlCount: pages.length, urls: pages.map((p) => p.url) },
    llmsTxt: { found: false, content: null },
    truncated: false,
    crawler: "fallback",
  };
}

beforeEach(() => {
  configState.pagespeedApiKey = "";
  configState.disableLocalLighthouse = false;
  runLocalLighthouseMock.mockReset();
});

describe("runPerformanceAudit", () => {
  it("uses local Lighthouse by default and only reports pages scoring below 90", async () => {
    runLocalLighthouseMock.mockImplementation(async (url: string) =>
      url.endsWith("/bad") ? { score: 0.4 } : { score: 0.95 },
    );

    const onWarning = vi.fn();
    const findings = await runPerformanceAudit(crawl([page("https://example.com/bad"), page("https://example.com/good")]), onWarning);

    expect(findings).toHaveLength(1);
    expect(findings[0].evidence[0].url).toBe("https://example.com/bad");
    expect(findings[0].severity).toBe("critical");
    expect(onWarning).not.toHaveBeenCalled();
  });

  it("falls back to the page-weight heuristic and warns when local Lighthouse can't launch at all", async () => {
    runLocalLighthouseMock.mockRejectedValue(new Error("no Chromium"));

    const onWarning = vi.fn();
    const findings = await runPerformanceAudit(crawl([page("https://example.com/", 20, 20000)]), onWarning);

    expect(findings).toHaveLength(1);
    expect(findings[0].title).toContain("heavy payload");
    expect(onWarning).toHaveBeenCalledWith(expect.stringContaining("performance audit"));
  });

  it("skips local Lighthouse and warns when DISABLE_LOCAL_LIGHTHOUSE is set, with no PSI key either", async () => {
    configState.disableLocalLighthouse = true;

    const onWarning = vi.fn();
    const findings = await runPerformanceAudit(crawl([page("https://example.com/")]), onWarning);

    expect(runLocalLighthouseMock).not.toHaveBeenCalled();
    expect(findings).toHaveLength(1);
    expect(onWarning).toHaveBeenCalledWith(expect.stringContaining("DISABLE_LOCAL_LIGHTHOUSE"));
  });

  it("falls back to local Lighthouse when a configured PSI key fails on every call", async () => {
    configState.pagespeedApiKey = "bad-key";
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("", { status: 403 }));
    runLocalLighthouseMock.mockResolvedValue({ score: 0.3 });

    const onWarning = vi.fn();
    const findings = await runPerformanceAudit(crawl([page("https://example.com/")]), onWarning);

    expect(findings).toHaveLength(1);
    expect(findings[0].detail).toContain("local Lighthouse");
    expect(onWarning).toHaveBeenCalledWith(expect.stringContaining("PAGESPEED_API_KEY is set"));
    fetchSpy.mockRestore();
  });
});
