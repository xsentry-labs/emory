import * as cheerio from "cheerio";
import type { CrawledPage } from "../types.js";
import { config } from "../config.js";

/**
 * Same-origin BFS crawl using plain fetch + cheerio. No JS execution, so
 * client-rendered content (the classic "prices drawn by the browser" bug)
 * shows up here exactly as it does to a crawler that can't run JS — which is
 * itself useful evidence for the technical/GEO agents, not just a limitation.
 */
export async function fallbackCrawl(rootUrl: string, maxPages: number): Promise<CrawledPage[]> {
  const origin = new URL(rootUrl).origin;
  const seen = new Set<string>();
  const queue: string[] = [rootUrl];
  const pages: CrawledPage[] = [];

  while (queue.length && pages.length < maxPages) {
    const batch = queue.splice(0, config.maxCrawlConcurrency).filter((u) => !seen.has(normalize(u)));
    for (const u of batch) seen.add(normalize(u));

    const fetched = await Promise.all(batch.map((u) => fetchPage(u).catch(() => null)));
    for (const page of fetched) {
      if (!page) continue;
      pages.push(page);
      if (pages.length >= maxPages) break;
      for (const link of page.links) {
        try {
          const abs = new URL(link.href, page.url);
          if (abs.origin === origin && !seen.has(normalize(abs.toString()))) {
            queue.push(abs.toString());
          }
        } catch {
          // ignore malformed hrefs
        }
      }
    }
  }

  return pages;
}

function normalize(u: string): string {
  const url = new URL(u);
  url.hash = "";
  return url.toString().replace(/\/$/, "");
}

async function fetchPage(url: string): Promise<CrawledPage> {
  const res = await fetch(url, { redirect: "follow", headers: { "User-Agent": "EmoryAuditBot/0.1 (+https://github.com/xsentry-labs/emory)" } });
  const html = res.ok ? await res.text() : "";
  const $ = cheerio.load(html);

  const jsonLd: unknown[] = [];
  $('script[type="application/ld+json"]').each((_i, el) => {
    try {
      jsonLd.push(JSON.parse($(el).contents().text()));
    } catch {
      // malformed JSON-LD is itself a finding, surfaced by the technical agent, not swallowed
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

  const bodyText = $("body").text().replace(/\s+/g, " ").trim();
  const headers: Record<string, string> = {};
  res.headers.forEach((v, k) => (headers[k] = v));

  return {
    url,
    statusCode: res.status,
    title: $("title").first().text().trim() || null,
    metaDescription: $('meta[name="description"]').attr("content")?.trim() ?? null,
    h1: $("h1").map((_i, el) => $(el).text().trim()).get().filter(Boolean),
    h2: $("h2").map((_i, el) => $(el).text().trim()).get().filter(Boolean),
    canonical: $('link[rel="canonical"]').attr("href") ?? null,
    robotsMeta: $('meta[name="robots"]').attr("content") ?? null,
    wordCount: bodyText.split(/\s+/).filter(Boolean).length,
    textSample: bodyText.slice(0, 4000),
    html: html.slice(0, 20000) || null,
    links,
    images,
    jsonLd,
    headers,
    fetchedAt: new Date().toISOString(),
  };
}
