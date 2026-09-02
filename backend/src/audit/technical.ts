import type { AuditFinding, CrawlResult } from "../types.js";
import { newId } from "../util/id.js";

/**
 * Deterministic, rule-based technical SEO checks. No LLM call: these are
 * yes/no facts about the crawl (a status code, a missing tag, a robots
 * directive), so judgment would only add latency and cost without adding
 * accuracy.
 */
export function runTechnicalAudit(crawl: CrawlResult): AuditFinding[] {
  const findings: AuditFinding[] = [];

  if (!crawl.robotsTxt.found) {
    findings.push(
      finding({
        title: "No robots.txt found",
        detail: "Search engines and AI crawlers get no explicit crawl guidance; some treat a missing robots.txt as a signal of a low-effort site.",
        evidence: [{ url: new URL("/robots.txt", crawl.rootUrl).toString(), currentValue: "404 / unreachable" }],
        severity: "notice",
        recommendedChange: "Add a robots.txt that allows crawling of public pages and points to the sitemap.",
        expectedImpact: "Faster, more complete indexation.",
        estimatedEffort: "low",
        category: "crawlability",
      }),
    );
  } else if (crawl.robotsTxt.disallowsRoot) {
    findings.push(
      finding({
        title: "robots.txt blocks the entire site",
        detail: "The root path is disallowed for all user agents, which can stop the whole domain from being crawled or indexed.",
        evidence: [{ url: new URL("/robots.txt", crawl.rootUrl).toString(), currentValue: crawl.robotsTxt.content?.slice(0, 300) ?? "" }],
        severity: "critical",
        recommendedChange: "Remove the blanket Disallow: / rule (or scope it to a staging subdomain only).",
        expectedImpact: "Restores crawlability for the whole site.",
        estimatedEffort: "low",
        category: "crawlability",
      }),
    );
  }

  if (!crawl.sitemap.found) {
    findings.push(
      finding({
        title: "No XML sitemap found",
        detail: "Neither /sitemap.xml nor a Sitemap: line in robots.txt resolved to a valid sitemap.",
        evidence: [{ url: new URL("/sitemap.xml", crawl.rootUrl).toString(), currentValue: "not found" }],
        severity: "warning",
        recommendedChange: "Publish an XML sitemap listing indexable pages and reference it from robots.txt.",
        expectedImpact: "Faster discovery of new/changed pages.",
        estimatedEffort: "low",
        category: "crawlability",
      }),
    );
  }

  if (!crawl.llmsTxt.found) {
    findings.push(
      finding({
        title: "No llms.txt found",
        detail: "There is no llms.txt guiding AI assistants and agents to the pages that best describe the business, product and pricing.",
        evidence: [{ url: new URL("/llms.txt", crawl.rootUrl).toString(), currentValue: "not found" }],
        severity: "notice",
        recommendedChange: "Publish an llms.txt at the site root listing the canonical pages an AI assistant should read (product, pricing, docs, about).",
        expectedImpact: "Improves how reliably AI assistants can find and cite accurate information about the business.",
        estimatedEffort: "low",
        category: "geo-aeo",
      }),
    );
  }

  const byStatus = new Map<number, string[]>();
  const missingTitle: string[] = [];
  const missingDescription: string[] = [];
  const missingH1: string[] = [];
  const multipleH1: string[] = [];
  const missingCanonical: string[] = [];
  const noindexed: string[] = [];
  const missingViewport: string[] = [];
  const missingAlt: { url: string; count: number }[] = [];
  const brokenJsonLd: string[] = [];
  const missingHsts: string[] = [];

  for (const page of crawl.pages) {
    if (page.statusCode >= 400) {
      const list = byStatus.get(page.statusCode) ?? [];
      list.push(page.url);
      byStatus.set(page.statusCode, list);
      continue;
    }
    if (!page.title) missingTitle.push(page.url);
    if (!page.metaDescription) missingDescription.push(page.url);
    if (page.h1.length === 0) missingH1.push(page.url);
    if (page.h1.length > 1) multipleH1.push(page.url);
    if (!page.canonical) missingCanonical.push(page.url);
    if (page.robotsMeta?.toLowerCase().includes("noindex")) noindexed.push(page.url);
    if (page.html && !/<meta[^>]+name=["']viewport["']/i.test(page.html)) missingViewport.push(page.url);
    const altless = page.images.filter((img) => !img.alt || !img.alt.trim()).length;
    if (altless > 0) missingAlt.push({ url: page.url, count: altless });
    if (page.headers["strict-transport-security"] === undefined && page.url.startsWith("https://")) {
      missingHsts.push(page.url);
    }

    for (const raw of page.html ? extractJsonLdBlocks(page.html) : []) {
      try {
        JSON.parse(raw);
      } catch {
        brokenJsonLd.push(page.url);
      }
    }
  }

  for (const [status, urls] of byStatus) {
    findings.push(
      finding({
        title: `${urls.length} page${urls.length === 1 ? "" : "s"} returning HTTP ${status}`,
        detail: `These pages were reachable in the crawl but returned a ${status} status instead of content.`,
        evidence: urls.slice(0, 10).map((u) => ({ url: u, currentValue: `HTTP ${status}` })),
        severity: status >= 500 ? "critical" : "warning",
        recommendedChange: status === 404 ? "Fix the broken links pointing here, or 301 redirect to the correct page." : "Investigate the server error and fix or redirect.",
        expectedImpact: "Recovers crawl budget and any link equity/traffic these URLs were owed.",
        estimatedEffort: "medium",
        category: "crawlability",
      }),
    );
  }

  pushIfAny(findings, missingTitle, {
    title: "pages with no <title>",
    detail: "Search engines and AI assistants have nothing authored to show as the result title, so they synthesize one from the first text found on the page.",
    severity: "critical",
    recommendedChange: "Write a unique, descriptive <title> for each page (50–60 characters).",
    expectedImpact: "Improves click-through from search and citation accuracy in AI answers.",
    estimatedEffort: "low",
    category: "on-page",
  });

  pushIfAny(findings, missingDescription, {
    title: "pages with no meta description",
    detail: "No meta description tag was found, so the snippet shown in results is auto-generated and often unhelpful.",
    severity: "warning",
    recommendedChange: "Write a unique 140–160 character meta description summarizing the page's value.",
    expectedImpact: "Improves click-through rate from search results.",
    estimatedEffort: "low",
    category: "on-page",
  });

  pushIfAny(findings, missingH1, {
    title: "pages with no <h1>",
    detail: "No H1 heading was found, removing the clearest on-page signal of what the page is about.",
    severity: "warning",
    recommendedChange: "Add a single, descriptive H1 that states the page's topic.",
    expectedImpact: "Clarifies page topic for search engines and AI extraction.",
    estimatedEffort: "low",
    category: "on-page",
  });

  pushIfAny(findings, multipleH1, {
    title: "pages with more than one <h1>",
    detail: "Multiple H1 elements dilute the single clearest topic signal on the page.",
    severity: "notice",
    recommendedChange: "Keep one H1 per page; demote the others to H2/H3.",
    expectedImpact: "Clarifies page hierarchy.",
    estimatedEffort: "low",
    category: "on-page",
  });

  pushIfAny(findings, missingCanonical, {
    title: "pages with no canonical tag",
    detail: "Without a canonical tag, duplicate or parameterized URLs can split ranking signals across near-identical pages.",
    severity: "notice",
    recommendedChange: "Add a self-referencing <link rel=\"canonical\"> to every indexable page.",
    expectedImpact: "Consolidates ranking signals onto the intended URL.",
    estimatedEffort: "low",
    category: "indexation",
  });

  pushIfAny(findings, noindexed, {
    title: "pages marked noindex",
    detail: "These pages carry a noindex robots directive and will not appear in search results.",
    severity: "critical",
    recommendedChange: "Remove the noindex directive if these pages are meant to rank; confirm intent if not.",
    expectedImpact: "Restores indexation for pages that should be findable.",
    estimatedEffort: "low",
    category: "indexation",
  });

  pushIfAny(findings, missingViewport, {
    title: "pages with no mobile viewport meta tag",
    detail: "Without a viewport meta tag, mobile browsers render the desktop layout at desktop width and scale it down.",
    severity: "warning",
    recommendedChange: 'Add <meta name="viewport" content="width=device-width, initial-scale=1">.',
    expectedImpact: "Fixes mobile usability, a Core Web Vitals and mobile-first indexing input.",
    estimatedEffort: "low",
    category: "mobile",
  });

  if (missingAlt.length) {
    const total = missingAlt.reduce((sum, m) => sum + m.count, 0);
    findings.push(
      finding({
        title: `${total} images with no alt text across ${missingAlt.length} pages`,
        detail: "Images without alt text are invisible to screen readers and give search engines/AI tools nothing to index or cite for that image.",
        evidence: missingAlt.slice(0, 10).map((m) => ({ url: m.url, currentValue: `${m.count} image(s) missing alt` })),
        severity: "notice",
        recommendedChange: "Add descriptive alt text for content images (decorative images can use alt=\"\").",
        expectedImpact: "Improves accessibility and image search / AI citation eligibility.",
        estimatedEffort: "medium",
        category: "on-page",
      }),
    );
  }

  pushIfAny(findings, brokenJsonLd, {
    title: "pages with invalid JSON-LD structured data",
    detail: "A <script type=\"application/ld+json\"> block failed to parse as JSON, so search engines silently ignore it.",
    severity: "warning",
    recommendedChange: "Fix the malformed JSON-LD or regenerate it (trailing commas and unescaped quotes are the usual cause).",
    expectedImpact: "Restores eligibility for rich results and AI-tool structured extraction.",
    estimatedEffort: "low",
    category: "structured-data",
  });

  pushIfAny(findings, missingHsts, {
    title: "pages served without Strict-Transport-Security",
    detail: "No HSTS header was returned, so browsers don't enforce HTTPS on repeat visits and a downgrade attack stays possible.",
    severity: "notice",
    recommendedChange: "Add a Strict-Transport-Security header (e.g. max-age=31536000; includeSubDomains) at the edge/CDN.",
    expectedImpact: "Closes a security-header gap search engines increasingly factor into trust signals.",
    estimatedEffort: "low",
    category: "security",
  });

  return findings;
}

function pushIfAny(
  findings: AuditFinding[],
  urls: string[],
  base: Omit<Parameters<typeof finding>[0], "title" | "evidence"> & { title: string },
) {
  if (!urls.length) return;
  findings.push(
    finding({
      ...base,
      title: `${urls.length} ${base.title}`,
      evidence: urls.slice(0, 10).map((u) => ({ url: u, currentValue: "missing" })),
    }),
  );
}

function extractJsonLdBlocks(html: string): string[] {
  const blocks: string[] = [];
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) blocks.push(m[1]);
  return blocks;
}

function finding(f: Omit<AuditFinding, "id" | "agent">): AuditFinding {
  return { id: newId("f"), agent: "technical", ...f };
}
