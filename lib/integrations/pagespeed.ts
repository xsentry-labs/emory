import type { Fetch } from "./github";

/**
 * PageSpeed Insights (Lighthouse, mobile). Works without a key at low volume;
 * set PAGESPEED_API_KEY for production quota.
 */

export interface PageSpeed {
  url: string;
  /** Lighthouse performance score, 0-100. */
  performance: number;
  /** Largest contentful paint, ms. */
  lcpMs: number | null;
  /** Cumulative layout shift. */
  cls: number | null;
  /** Total blocking time, ms (lab stand-in for interaction delay). */
  tbtMs: number | null;
}

export async function pageSpeed(url: string, f: Fetch = fetch, env: Record<string, string | undefined> = process.env): Promise<PageSpeed> {
  const q = new URLSearchParams({ url, strategy: "mobile", category: "performance" });
  if (env.PAGESPEED_API_KEY) q.set("key", env.PAGESPEED_API_KEY);
  const res = await f(`https://www.googleapis.com/pagespeedonline/v5/runPagespeed?${q}`, { signal: AbortSignal.timeout(90_000) });
  if (!res.ok) throw new Error(`PageSpeed ${res.status}`);
  const body = (await res.json()) as {
    lighthouseResult?: {
      categories?: { performance?: { score?: number } };
      audits?: Record<string, { numericValue?: number }>;
    };
  };
  const lh = body.lighthouseResult;
  if (!lh?.categories?.performance) throw new Error("PageSpeed returned no performance score");
  const num = (k: string) => lh.audits?.[k]?.numericValue ?? null;
  return {
    url,
    performance: Math.round((lh.categories.performance.score ?? 0) * 100),
    lcpMs: num("largest-contentful-paint"),
    cls: num("cumulative-layout-shift"),
    tbtMs: num("total-blocking-time"),
  };
}
