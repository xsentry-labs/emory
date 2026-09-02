import type { AuditFinding, CrawlResult } from "../types.js";
import { config } from "../config.js";
import { newId } from "../util/id.js";
import { runLocalLighthouse, type LighthouseScore } from "./localLighthouse.js";

const MAX_PAGES_CHECKED = 5;

interface PsiResult {
  lighthouseResult?: {
    categories?: { performance?: { score: number } };
    audits?: Record<string, { title?: string; displayValue?: string; score?: number | null }>;
  };
}

/**
 * Core Web Vitals, in order of preference:
 * 1. Real PageSpeed Insights API (PAID — Google Cloud key required).
 * 2. Real local Lighthouse run on Puppeteer's bundled open-source Chromium
 *    (free, self-hosted, default — this is what actually runs unless a PSI
 *    key is set).
 * 3. A page-weight heuristic, only if launching a local browser fails too
 *    (e.g. a deploy target with no headless-browser support).
 */
export async function runPerformanceAudit(
  crawl: CrawlResult,
  onWarning: (msg: string) => void,
): Promise<AuditFinding[]> {
  const candidates = pickCandidates(crawl);

  if (config.pagespeedApiKey) {
    const result = await scorePass(candidates, (url) => scoreWithPsiApi(url), "PageSpeed Insights API (Google, real Core Web Vitals field/lab data)");
    if (result.anySucceeded) return result.findings;
    onWarning("performance audit: PAGESPEED_API_KEY is set but every PageSpeed Insights call failed (bad key, quota, or network) — falling back to local Lighthouse.");
  }

  if (!config.disableLocalLighthouse) {
    const result = await scorePass(candidates, (url) => runLocalLighthouse(url).catch(() => null), "local Lighthouse run (open source, self-hosted Chromium — no external service)");
    if (result.anySucceeded) return result.findings;
    onWarning("performance audit: no local Chromium/Lighthouse run succeeded (DISABLE_LOCAL_LIGHTHOUSE, or no headless-browser support in this environment) and no PAGESPEED_API_KEY is set — using a page-weight heuristic instead of real Core Web Vitals.");
  } else {
    onWarning("performance audit: DISABLE_LOCAL_LIGHTHOUSE is set and no PAGESPEED_API_KEY is configured — using a page-weight heuristic instead of real Core Web Vitals.");
  }

  return candidates.map((page) => heuristicFinding(page.url, page.images.length, page.html?.length ?? 0));
}

async function scorePass(
  candidates: ReturnType<typeof pickCandidates>,
  score: (url: string) => Promise<LighthouseScore | null>,
  source: string,
): Promise<{ findings: AuditFinding[]; anySucceeded: boolean }> {
  const scored = await Promise.all(candidates.map((page) => score(page.url)));
  const findings: AuditFinding[] = [];
  let anySucceeded = false;
  scored.forEach((result, i) => {
    if (!result) return;
    anySucceeded = true;
    const f = toFinding(candidates[i].url, result, source);
    if (f) findings.push(f);
  });
  return { findings, anySucceeded };
}

async function scoreWithPsiApi(pageUrl: string): Promise<LighthouseScore | null> {
  try {
    const url = new URL("https://www.googleapis.com/pagespeedonline/v5/runPagespeed");
    url.searchParams.set("url", pageUrl);
    url.searchParams.set("key", config.pagespeedApiKey);
    url.searchParams.set("strategy", "mobile");
    url.searchParams.set("category", "performance");

    const res = await fetch(url.toString());
    if (!res.ok) return null;
    const data = (await res.json()) as PsiResult;
    const score = data.lighthouseResult?.categories?.performance?.score;
    if (score === undefined) return null;
    return {
      score,
      lcp: data.lighthouseResult?.audits?.["largest-contentful-paint"]?.displayValue,
      cls: data.lighthouseResult?.audits?.["cumulative-layout-shift"]?.displayValue,
      tbt: data.lighthouseResult?.audits?.["total-blocking-time"]?.displayValue,
    };
  } catch {
    return null;
  }
}

function toFinding(url: string, scored: LighthouseScore, source: string): AuditFinding | null {
  if (scored.score >= 0.9) return null;
  return {
    id: newId("f"),
    agent: "performance",
    title: `Mobile performance score ${Math.round(scored.score * 100)}/100`,
    detail: `${source}. LCP: ${scored.lcp ?? "n/a"}, CLS: ${scored.cls ?? "n/a"}, Total Blocking Time: ${scored.tbt ?? "n/a"}.`,
    evidence: [{ url, currentValue: `Performance score ${Math.round(scored.score * 100)}/100` }],
    severity: scored.score < 0.5 ? "critical" : scored.score < 0.75 ? "warning" : "notice",
    recommendedChange: "Address the top Lighthouse opportunities for this page (typically: compress/resize hero images, defer non-critical JS, preload the LCP element's font/image).",
    expectedImpact: "Faster load lowers mobile bounce and is a Core Web Vitals ranking input.",
    estimatedEffort: "medium",
    category: "performance",
  };
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
      ? "A page-weight heuristic (image count + HTML size), used because no local browser was available for a real Lighthouse run and no PAGESPEED_API_KEY is set."
      : "No local browser was available for a real Lighthouse run and no PAGESPEED_API_KEY is set, so no performance data was collected for this page. This is a placeholder notice, not a finding.",
    evidence: [{ url, currentValue: `${imageCount} images, ~${Math.round(htmlLength / 1024)}KB HTML sampled` }],
    severity: "notice",
    recommendedChange: heavy
      ? "Audit image sizes and defer/lazy-load below-the-fold assets."
      : "Set DISABLE_LOCAL_LIGHTHOUSE=false (default) with a working headless-Chromium environment, or set PAGESPEED_API_KEY, to get real Core Web Vitals data.",
    expectedImpact: "Faster pages typically improve mobile retention and Core Web Vitals scoring.",
    estimatedEffort: "medium",
    category: "performance",
  };
}
