import lighthouse from "lighthouse";
import { getBrowser } from "../browser/pool.js";

export interface LighthouseScore {
  score: number;
  lcp?: string;
  cls?: string;
  tbt?: string;
}

/**
 * Runs a real Lighthouse performance audit against Puppeteer's own bundled
 * Chromium — fully open source, no external API, no key. This is the
 * default Core Web Vitals path whenever PAGESPEED_API_KEY isn't set.
 */
export async function runLocalLighthouse(url: string): Promise<LighthouseScore | null> {
  const browser = await getBrowser();
  const port = Number(new URL(browser.wsEndpoint()).port);

  const result = await lighthouse(url, {
    port,
    output: "json",
    logLevel: "silent",
    onlyCategories: ["performance"],
    formFactor: "mobile",
    screenEmulation: { mobile: true, width: 412, height: 823, deviceScaleFactor: 2.625, disabled: false },
    throttlingMethod: "simulate",
  });

  const lhr = result?.lhr;
  const score = lhr?.categories?.performance?.score;
  if (score === null || score === undefined) return null;

  return {
    score,
    lcp: lhr?.audits?.["largest-contentful-paint"]?.displayValue,
    cls: lhr?.audits?.["cumulative-layout-shift"]?.displayValue,
    tbt: lhr?.audits?.["total-blocking-time"]?.displayValue,
  };
}
