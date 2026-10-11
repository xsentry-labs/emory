import { XMLParser } from "fast-xml-parser";
import { analysePage, type PageData, type SiteInfo } from "./checks";
import { normalizeUrl, type RawPage } from "../safeFetch";

export type Fetcher = (url: string) => Promise<RawPage>;

export interface CrawlResult {
  pages: PageData[];
  site: SiteInfo;
  /** Pages we could not reach at all (network/SSRF errors). */
  unreachable: string[];
}

const MAX_PAGES_DEFAULT = 12;
const SKIP_EXT = /\.(pdf|jpe?g|png|gif|svg|webp|ico|css|js|json|xml|zip|mp4|mp3|woff2?|ttf)(\?|$)/i;

function parseSitemapUrls(xml: string): string[] {
  try {
    const doc = new XMLParser({ ignoreAttributes: true }).parse(xml);
    const urls = doc?.urlset?.url;
    const list = Array.isArray(urls) ? urls : urls ? [urls] : [];
    return list.map((u: { loc?: string }) => String(u?.loc ?? "")).filter(Boolean);
  } catch {
    return [];
  }
}

const robotsState = (txt: string): SiteInfo["robotsTxt"] => {
  let star = false;
  for (const raw of txt.split(/\r?\n/)) {
    const line = raw.split("#")[0].trim().toLowerCase();
    if (line.startsWith("user-agent:")) star = line.slice(11).trim() === "*";
    else if (star && /^disallow:\s*\/\s*$/.test(line)) return "blocks-all";
  }
  return "ok";
};

/**
 * Crawl a site breadth-first from the start URL (seeded with sitemap URLs),
 * staying on the same origin, up to maxPages. Pure with respect to the injected
 * fetcher, so it is testable without a network.
 */
export async function crawlSite(startInput: string, fetchPage: Fetcher, maxPages = MAX_PAGES_DEFAULT): Promise<CrawlResult> {
  const start = normalizeUrl(startInput);
  if (!start) throw new Error("Enter a valid website address.");
  const origin = start.origin;

  const home = await fetchPage(start.href);
  const homeOrigin = new URL(home.url).origin;

  const side = async (path: string) => {
    try {
      const r = await fetchPage(`${homeOrigin}${path}`);
      return r.status === 200 ? r : null;
    } catch {
      return null;
    }
  };
  const [robots, sitemap] = await Promise.all([side("/robots.txt"), side("/sitemap.xml")]);
  const site: SiteInfo = {
    https: new URL(home.url).protocol === "https:",
    robotsTxt: robots ? robotsState(robots.body) : "missing",
    sitemap: Boolean(sitemap && parseSitemapUrls(sitemap.body).length > 0),
  };

  const sameOrigin = (u: string) => {
    try {
      const p = new URL(u);
      return p.origin === homeOrigin || p.origin === origin;
    } catch {
      return false;
    }
  };
  const seen = new Set<string>();
  const queue: string[] = [];
  const enqueue = (u: string) => {
    try {
      const p = new URL(u);
      p.hash = "";
      if (SKIP_EXT.test(p.pathname) || !sameOrigin(p.href)) return;
      const key = p.href.replace(/\/$/, "");
      if (!seen.has(key)) {
        seen.add(key);
        queue.push(p.href);
      }
    } catch {
      /* ignore */
    }
  };

  const pages: PageData[] = [];
  const unreachable: string[] = [];
  const isHtml = (r: RawPage) => /html/i.test(r.contentType) || r.body.trimStart().startsWith("<");
  const record = (r: RawPage) => {
    if (r.status >= 200 && r.status < 300 && !isHtml(r)) return;
    pages.push(analysePage(isHtml(r) ? r.body : "", r.url, { status: r.status, ms: r.ms, redirected: r.redirected }));
  };

  seen.add(home.url.replace(/\/$/, ""));
  record(home);
  for (const l of pages[0]?.links ?? []) enqueue(l);
  if (sitemap) parseSitemapUrls(sitemap.body).forEach(enqueue);

  while (queue.length > 0 && pages.length < maxPages) {
    const batch = queue.splice(0, Math.min(4, maxPages - pages.length));
    const results = await Promise.all(
      batch.map(async (u) => {
        try {
          return await fetchPage(u);
        } catch {
          unreachable.push(u);
          return null;
        }
      }),
    );
    for (const r of results) {
      if (!r) continue;
      record(r);
      if (r.status >= 200 && r.status < 300) pages[pages.length - 1]?.links.forEach(enqueue);
    }
  }
  return { pages, site, unreachable };
}
