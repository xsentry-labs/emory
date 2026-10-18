import * as cheerio from "cheerio";

export type Severity = "high" | "medium" | "low";

export interface PageData {
  url: string;
  status: number;
  ms: number;
  redirected: boolean;
  title: string;
  description: string;
  h1: string[];
  canonical: string;
  noindex: boolean;
  lang: string;
  viewport: boolean;
  ogTitle: boolean;
  ogImage: boolean;
  jsonLd: boolean;
  imagesTotal: number;
  imagesNoAlt: number;
  words: number;
  /** Absolute same-site links found on the page. */
  links: string[];
  /** First part of the visible text, used as context for the fix plan. */
  excerpt: string;
}

export interface Issue {
  id: string;
  severity: Severity;
  title: string;
  detail: string;
  /** Affected pages (capped for display). */
  pages: string[];
  count: number;
}

export interface SiteInfo {
  https: boolean;
  robotsTxt: "missing" | "ok" | "blocks-all";
  sitemap: boolean;
}

export function analysePage(html: string, url: string, meta: { status: number; ms: number; redirected: boolean }): PageData {
  const $ = cheerio.load(html);
  const text = $("body").clone().find("script,style,noscript,svg").remove().end().text().replace(/\s+/g, " ").trim();
  const robots = ($('meta[name="robots"]').attr("content") ?? "").toLowerCase();
  const origin = new URL(url).origin;
  const links = new Set<string>();
  $("a[href]").each((_, el) => {
    try {
      const u = new URL($(el).attr("href") ?? "", url);
      if ((u.protocol === "http:" || u.protocol === "https:") && u.origin === origin) {
        u.hash = "";
        links.add(u.href);
      }
    } catch {
      /* ignore bad hrefs */
    }
  });
  const images = $("img");
  let noAlt = 0;
  images.each((_, el) => {
    const alt = $(el).attr("alt");
    if (alt === undefined || (alt.trim() === "" && $(el).attr("role") !== "presentation")) noAlt++;
  });
  return {
    url,
    ...meta,
    title: $("head title").first().text().trim(),
    description: ($('meta[name="description"]').attr("content") ?? "").trim(),
    h1: $("h1")
      .map((_, el) => $(el).text().replace(/\s+/g, " ").trim())
      .get()
      .filter(Boolean),
    canonical: ($('link[rel="canonical"]').attr("href") ?? "").trim(),
    noindex: /noindex/.test(robots),
    lang: ($("html").attr("lang") ?? "").trim(),
    viewport: $('meta[name="viewport"]').length > 0,
    ogTitle: $('meta[property="og:title"]').length > 0,
    ogImage: $('meta[property="og:image"]').length > 0,
    jsonLd: $('script[type="application/ld+json"]').length > 0,
    imagesTotal: images.length,
    imagesNoAlt: noAlt,
    words: text ? text.split(/\s+/).length : 0,
    links: [...links],
    excerpt: text.slice(0, 600),
  };
}

const CAP = 8;
const issue = (id: string, severity: Severity, title: string, detail: string, pages: string[]): Issue | null =>
  pages.length === 0 ? null : { id, severity, title, detail, pages: pages.slice(0, CAP), count: pages.length };

function duplicates(pages: PageData[], pick: (p: PageData) => string): string[] {
  const seen = new Map<string, string[]>();
  for (const p of pages) {
    const v = pick(p).trim().toLowerCase();
    if (v) seen.set(v, [...(seen.get(v) ?? []), p.url]);
  }
  return [...seen.values()].filter((u) => u.length > 1).flat();
}

/** Deterministic checks over the crawled pages. HTML pages that returned 200 are "live". */
export function runChecks(all: PageData[], site: SiteInfo): Issue[] {
  const live = all.filter((p) => p.status >= 200 && p.status < 300);
  const out: (Issue | null)[] = [];

  out.push(
    site.https
      ? null
      : issue("not-https", "high", "Site is not served over HTTPS", "Browsers warn visitors and Google prefers HTTPS. Install a certificate and redirect HTTP to HTTPS.", [all[0]?.url ?? ""].filter(Boolean)),
  );
  if (site.robotsTxt === "blocks-all") {
    out.push({ id: "robots-blocks", severity: "high", title: "robots.txt blocks all crawlers", detail: "A 'Disallow: /' rule under 'User-agent: *' stops search engines indexing the site.", pages: [], count: 1 });
  } else if (site.robotsTxt === "missing") {
    out.push({ id: "robots-missing", severity: "low", title: "No robots.txt", detail: "Add a robots.txt that allows crawling and points to your sitemap.", pages: [], count: 1 });
  }
  if (!site.sitemap) {
    out.push({ id: "sitemap-missing", severity: "medium", title: "No sitemap.xml found", detail: "A sitemap helps search engines discover all your pages. Generate one and reference it in robots.txt.", pages: [], count: 1 });
  }

  out.push(issue("broken", "high", "Pages returning errors", "These internal pages respond with an error status. Fix them or remove the links to them.", all.filter((p) => p.status >= 400).map((p) => `${p.url} (${p.status})`)));
  out.push(issue("noindex", "high", "Pages blocked from search with noindex", "A noindex tag keeps the page out of Google. Remove it on pages you want found.", live.filter((p) => p.noindex).map((p) => p.url)));
  out.push(issue("no-title", "high", "Missing page title", "Every page needs a unique, descriptive <title>: it is the main ranking and click signal.", live.filter((p) => !p.title).map((p) => p.url)));
  out.push(issue("no-description", "high", "Missing meta description", "Without one, Google writes its own snippet. Write a 70-160 character summary that makes people click.", live.filter((p) => !p.description).map((p) => p.url)));
  out.push(issue("no-h1", "high", "Missing H1 heading", "Each page should have one H1 stating its main topic.", live.filter((p) => p.h1.length === 0).map((p) => p.url)));
  out.push(issue("no-viewport", "high", "No mobile viewport tag", "Without <meta name=\"viewport\">, pages render badly on phones, which hurts mobile rankings.", live.filter((p) => !p.viewport).map((p) => p.url)));

  out.push(issue("dup-title", "medium", "Duplicate page titles", "Pages sharing a title compete with each other. Give each its own.", duplicates(live, (p) => p.title)));
  out.push(issue("dup-description", "medium", "Duplicate meta descriptions", "Write a distinct description for each page.", duplicates(live, (p) => p.description)));
  out.push(issue("title-long", "medium", "Title too long (over 60 characters)", "Google truncates long titles in results. Aim for 30-60 characters.", live.filter((p) => p.title.length > 60).map((p) => p.url)));
  out.push(issue("description-long", "medium", "Meta description too long (over 160 characters)", "It will be cut off in results. Keep it under 160 characters.", live.filter((p) => p.description.length > 160).map((p) => p.url)));
  out.push(issue("thin", "medium", "Thin content (under 200 words)", "Pages with very little text rarely rank. Expand them or merge them into stronger pages.", live.filter((p) => p.words < 200 && !p.noindex).map((p) => p.url)));
  out.push(issue("img-alt", "medium", "Images missing alt text", "Alt text helps accessibility and image search. Describe each meaningful image.", live.filter((p) => p.imagesNoAlt > 0).map((p) => `${p.url} (${p.imagesNoAlt} of ${p.imagesTotal})`)));
  out.push(issue("no-schema", "medium", "No structured data on the homepage", "Add JSON-LD (Organization, plus Product/Service/FAQ where relevant) so search engines understand the business.", live.slice(0, 1).filter((p) => !p.jsonLd).map((p) => p.url)));

  out.push(issue("title-short", "low", "Title very short (under 20 characters)", "Short titles waste ranking opportunity. Include what you do and for whom.", live.filter((p) => p.title && p.title.length < 20).map((p) => p.url)));
  out.push(issue("description-short", "low", "Meta description very short (under 70 characters)", "Use the space to explain the benefit.", live.filter((p) => p.description && p.description.length < 70).map((p) => p.url)));
  out.push(issue("multi-h1", "low", "More than one H1", "Use one H1 per page and H2/H3 for sections.", live.filter((p) => p.h1.length > 1).map((p) => p.url)));
  out.push(issue("no-canonical", "low", "No canonical tag", "A canonical URL avoids duplicate-content confusion from tracking parameters.", live.filter((p) => !p.canonical).map((p) => p.url)));
  out.push(issue("no-lang", "low", "No lang attribute on <html>", "Declare the page language, for example <html lang=\"en\">.", live.filter((p) => !p.lang).map((p) => p.url)));
  out.push(issue("no-og", "low", "Missing Open Graph tags", "og:title and og:image control how links look when shared on social and in chat apps.", live.filter((p) => !p.ogTitle || !p.ogImage).map((p) => p.url)));
  out.push(issue("slow", "low", "Slow server response (over 1.5s)", "Slow responses hurt rankings and conversions. Check hosting, caching and heavy pages.", live.filter((p) => p.ms > 1500).map((p) => `${p.url} (${(p.ms / 1000).toFixed(1)}s)`)));

  return out.filter((i): i is Issue => i !== null);
}

const WEIGHT: Record<Severity, number> = { high: 10, medium: 4, low: 1.5 };

/** 0-100. Each issue costs by severity, scaled by the share of pages it touches. */
export function scoreSite(issues: Issue[], pageCount: number): number {
  let penalty = 0;
  for (const i of issues) {
    const share = pageCount > 0 ? Math.min(1, i.count / pageCount) : 1;
    penalty += WEIGHT[i.severity] * (0.4 + 0.6 * share);
  }
  return Math.max(0, Math.round(100 - penalty));
}

/** Lighthouse mobile result for the homepage, turned into an issue when it is slow. */
export function speedIssue(ps: { url: string; performance: number; lcpMs: number | null }): Issue | null {
  if (ps.performance >= 90) return null;
  const lcp = ps.lcpMs === null ? "" : ` Largest content takes ${(ps.lcpMs / 1000).toFixed(1)}s to appear (aim for under 2.5s).`;
  return {
    id: "mobile-slow",
    severity: ps.performance < 50 ? "high" : "medium",
    title: `Slow on mobile (speed score ${ps.performance})`,
    detail: `Google's mobile test scores the homepage ${ps.performance}/100.${lcp} Compress and resize large images, defer scripts that aren't needed up front, and cache static files.`,
    pages: [ps.url],
    count: 1,
  };
}
