import type { AuditFinding, CrawlResult } from "../types.js";
import { config } from "../config.js";
import { newId } from "../util/id.js";

const MAX_PAGES_CHECKED = 5;

interface PsiResult {
  lighthouseResult?: {
    categories?: { performance?: { score: number } };
    audits?: Record<string, { title?: string; displayValue?: string; score?: number | null }>;
  };
  loadingExperience?: {
    metrics?: Record<string, { percentile: number; category: string }>;
  };
}

/**
 * Core Web Vitals via the real PageSpeed Insights API when PAGESPEED_API_KEY \
 * is set; otherwise a heuristic estimate from page weight signals already in \
 * the crawl (payload size proxy via HTML length, image count) so the audit \
 * still surfaces *something* actionable with zero extra services.
 */
export async function runPerformanceAudit(crawl: CrawlResult): Promise<AuditFinding[]> {
  const candidates = pickCandidates(crawl);

  if (!config.pagespeedApiKey) {
    return candidates.map((page) => heuristicFinding(page.url, page.images.length, page.html?.length ?? 0));
  }

  const findings: AuditFinding[] = [];
  for (const page of candidates) {
    try {
      const url = new URL("https://www.googleapis.com/pagespeedonline/v5/runPagespeed");
      url.searchParams.set("url", page.url);
      url.searchParams.set("key", config.pagespeedApiKey);
      url.searchParams.set("strategy", "mobile");
      url.searchParams.set("category", "performance");

      const res = await fetch(url.toString());
      if (!res.ok) continue;
      const data = (await res.json()) as PsiResult;
      const score = data.lighthouseResult?.categories?.performance?.score;
      const lcp = data.lighthouseResult?.audits?.["largest-contentful-paint"];
      const cls = data.lighthouseResult?.audits?.["cumulative-layout-shift"];
      const tbt = data.lighthouseResult?.audits?.["total-blocking-time"];

      if (score !== undefined && score < 0.9) {
        findings.push({
          id: newId("f"),
          agent: "performance",
          title: `Mobile performance score ${Math.round(score * 100)}/100`,
          detail: `Lighthouse mobile performance audit via PageSpeed Insights. LCP: ${lcp?.displayValue ?? "n/a"}, CLS: ${cls?.displayValue ?? "n/a"}, Total Blocking Time: ${tbt?.displayValue ?? "n/a"}.`,
          evidence: [{ url: page.url, currentValue: `Performance score ${Math.round(score * 100)}/100` }],
          severity: score < 0.5 ? "critical" : score < 0.75 ? "warning" : "notice",
          recommendedChange: "Address the top Lighthouse opportunities for this page (typically: compress/resize hero images, defer non-critical JS, preload the LCP element's font/image).",
          expectedImpact: "Faster load lowers mobile bounce and is a Core Web Vitals ranking input.",
          estimatedEffort: "medium",
          category: "performance",
        });
      }
    } catch {
      continue;
    }
  }
  return findings;
}

function pickCandidates(crawl: CrawlResult) {
  const home = crawl.pages.find((p) => p.url === crawl.rootUrl || p.url === `${crawl.rootUrl}/`);
  const rest = crawl.pages.filter((p) => p !== home).slice(0, MAX_PAGES_CHECKED - (home ? 1 : 0));
  return [...(home ? [home] : []), ...rest].slice(0, MAX_PAGES_CHECKED);
}

function heuristicFinding(url: string, imageCount: number, htmlLength: number): AuditFinding {
  const heavy = imageCount > 15 || htmlLength > 15000;
  return {
    id: newId("f"),
    agent: "performance",
    title: heavy ? "Page shows signs of a heavy payload" : "No performance measurement available",
    detail: heavy
      ? `${imageCount} images and a large HTML payload detected. This is a heuristic estimate — set PAGESPEED_API_KEY for real Lighthouse/Core Web Vitals scoring.`
      : "PAGESPEED_API_KEY is not set, so no real Core Web Vitals data was collected for this page. This is a placeholder notice, not a finding — configure the key for real scoring.",
    evidence: [{ url, currentValue: `${imageCount} images, ~${Math.round(htmlLength / 1024)}KB HTML sampled` }],
    severity: heavy ? "notice" : "notice",
    recommendedChange: heavy
      ? "Audit image sizes and defer/lazy-load below-the-fold assets."
      : "Set PAGESPEED_API_KEY to get real Core Web Vitals data in this report.",
    expectedImpact: "Faster pages typically improve mobile retention and Core Web Vitals scoring.",
    estimatedEffort: "medium",
    category: "performance",
  };
}
