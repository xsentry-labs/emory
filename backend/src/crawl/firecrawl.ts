import FirecrawlApp from "@mendable/firecrawl-js";
import * as cheerio from "cheerio";
import type { CrawledPage } from "../types.js";
import { config } from "../config.js";

/**
 * Firecrawl gives clean markdown/html + metadata per page and a `/map` call
 * for fast link discovery, so we use `/map` to pick the page set and `/scrape`
 * per page rather than Firecrawl's own multi-page `/crawl` (which is billed
 * and paced very differently) — this keeps page-count and cost predictable
 * against `config.maxPages`.
 */
export async function firecrawlCrawl(rootUrl: string, maxPages: number): Promise<CrawledPage[]> {
  const app = new FirecrawlApp({ apiKey: config.firecrawlApiKey });

  const mapped = await app.mapUrl(rootUrl, { limit: maxPages });
  const urls: string[] = (mapped as { links?: string[] }).links?.slice(0, maxPages) ?? [rootUrl];
  if (!urls.includes(rootUrl)) urls.unshift(rootUrl);

  const pages: CrawledPage[] = [];
  const chunks = chunk(urls.slice(0, maxPages), config.maxCrawlConcurrency);
  for (const group of chunks) {
    const results = await Promise.all(group.map((u) => scrapeOne(app, u).catch(() => null)));
    for (const p of results) if (p) pages.push(p);
  }
  return pages;
}

async function scrapeOne(app: FirecrawlApp, url: string): Promise<CrawledPage> {
  const result = (await app.scrapeUrl(url, {
    formats: ["markdown", "html"],
  })) as {
    success: boolean;
    markdown?: string;
    html?: string;
    metadata?: Record<string, unknown>;
  };

  if (!result.success) {
    throw new Error(`Firecrawl scrape failed for ${url}`);
  }

  const html = result.html ?? "";
  const $ = cheerio.load(html);
  const jsonLd: unknown[] = [];
  $('script[type="application/ld+json"]').each((_i, el) => {
    try {
      jsonLd.push(JSON.parse($(el).contents().text()));
    } catch {
      // surfaced as a finding elsewhere, not here
    }
  });

  const links: CrawledPage["links"] = [];
  $("a[href]").each((_i, el) => {
    links.push({ href: $(el).attr("href") ?? "", text: $(el).text().trim().slice(0, 200), rel: $(el).attr("rel") ?? null });
  });
  const images: CrawledPage["images"] = [];
  $("img").each((_i, el) => {
    const src = $(el).attr("src");
    if (src) images.push({ src, alt: $(el).attr("alt") ?? null });
  });

  const meta = result.metadata ?? {};
  const markdown = result.markdown ?? "";

  return {
    url,
    statusCode: Number(meta.statusCode ?? 200),
    title: (meta.title as string) ?? $("title").first().text().trim() ?? null,
    metaDescription: (meta.description as string) ?? null,
    h1: $("h1").map((_i, el) => $(el).text().trim()).get().filter(Boolean),
    h2: $("h2").map((_i, el) => $(el).text().trim()).get().filter(Boolean),
    canonical: (meta.canonical as string) ?? null,
    robotsMeta: (meta.robots as string) ?? null,
    wordCount: markdown.split(/\s+/).filter(Boolean).length,
    textSample: markdown.slice(0, 4000),
    html: html.slice(0, 20000) || null,
    links,
    images,
    jsonLd,
    headers: {},
    fetchedAt: new Date().toISOString(),
  };
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}
