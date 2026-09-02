import type { CrawlResult } from "../types.js";
import { config } from "../config.js";
import { fetchRobotsTxt, fetchSitemapUrls, fetchLlmsTxt } from "./robotsSitemap.js";
import { fallbackCrawl } from "./fallbackCrawler.js";

export async function collect(rootUrlInput: string, maxPages = config.maxPages): Promise<CrawlResult> {
  const rootUrl = normalizeRoot(rootUrlInput);

  const [robotsTxt, llmsTxt] = await Promise.all([fetchRobotsTxt(rootUrl), fetchLlmsTxt(rootUrl)]);
  const sitemap = await fetchSitemapUrls(rootUrl, robotsTxt.content);

  let pages;
  let crawler: "firecrawl" | "fallback" = "fallback";
  if (config.useFirecrawl && config.firecrawlApiKey) {
    try {
      const { firecrawlCrawl } = await import("./firecrawl.js");
      pages = await firecrawlCrawl(rootUrl, maxPages);
      crawler = "firecrawl";
    } catch {
      pages = await fallbackCrawl(rootUrl, maxPages);
    }
  } else {
    pages = await fallbackCrawl(rootUrl, maxPages);
  }

  return {
    rootUrl,
    pages,
    robotsTxt: { found: robotsTxt.found, content: robotsTxt.content, disallowsRoot: robotsTxt.disallowsRoot },
    sitemap,
    llmsTxt,
    truncated: sitemap.urlCount > maxPages || pages.length >= maxPages,
    crawler,
  };
}

function normalizeRoot(input: string): string {
  const withScheme = /^https?:\/\//i.test(input) ? input : `https://${input}`;
  const url = new URL(withScheme);
  return url.toString();
}
