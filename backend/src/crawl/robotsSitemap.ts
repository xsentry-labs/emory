import robotsParserPkg from "robots-parser";
// The published types collapse to an ambient ("declare module") shape under
// NodeNext CJS interop, so TS can't see the callable default. It is a
// function at runtime; cast once here instead of `any`-typing every call site.
const robotsParser = robotsParserPkg as unknown as (url: string, contents: string) => {
  isDisallowed(url: string, ua?: string): boolean | undefined;
};
import { XMLParser } from "fast-xml-parser";

export async function fetchRobotsTxt(rootUrl: string) {
  const robotsUrl = new URL("/robots.txt", rootUrl).toString();
  try {
    const res = await fetch(robotsUrl, { redirect: "follow" });
    if (!res.ok) return { found: false, content: null, disallowsRoot: false, robotsUrl };
    const content = await res.text();
    const robots = robotsParser(robotsUrl, content);
    const disallowsRoot = robots.isDisallowed(rootUrl, "*") ?? false;
    return { found: true, content, disallowsRoot, robotsUrl };
  } catch {
    return { found: false, content: null, disallowsRoot: false, robotsUrl };
  }
}

export async function fetchLlmsTxt(rootUrl: string) {
  const llmsUrl = new URL("/llms.txt", rootUrl).toString();
  try {
    const res = await fetch(llmsUrl, { redirect: "follow" });
    if (!res.ok) return { found: false, content: null };
    return { found: true, content: await res.text() };
  } catch {
    return { found: false, content: null };
  }
}

export async function fetchSitemapUrls(rootUrl: string, robotsContent: string | null): Promise<{ found: boolean; urlCount: number; urls: string[] }> {
  const candidates: string[] = [];
  const fromRobots = robotsContent?.match(/^sitemap:\s*(\S+)/gim) ?? [];
  for (const line of fromRobots) {
    const url = line.split(/:\s*/i).slice(1).join(":").trim();
    if (url) candidates.push(url);
  }
  candidates.push(new URL("/sitemap.xml", rootUrl).toString());

  const parser = new XMLParser({ ignoreAttributes: false });
  for (const sitemapUrl of candidates) {
    try {
      const res = await fetch(sitemapUrl, { redirect: "follow" });
      if (!res.ok) continue;
      const xml = await res.text();
      const parsed = parser.parse(xml);

      if (parsed.sitemapindex) {
        const entries = arrify(parsed.sitemapindex.sitemap);
        const nested: string[] = [];
        for (const entry of entries.slice(0, 10)) {
          const loc = entry?.loc;
          if (!loc) continue;
          try {
            const subRes = await fetch(loc, { redirect: "follow" });
            if (!subRes.ok) continue;
            const subXml = await subRes.text();
            const subParsed = parser.parse(subXml);
            nested.push(...arrify(subParsed.urlset?.url).map((u: { loc: string }) => u.loc).filter(Boolean));
          } catch {
            // skip unreachable nested sitemap
          }
        }
        return { found: true, urlCount: nested.length, urls: nested };
      }

      if (parsed.urlset) {
        const urls = arrify(parsed.urlset.url).map((u: { loc: string }) => u.loc).filter(Boolean);
        return { found: true, urlCount: urls.length, urls };
      }
    } catch {
      // try next candidate
    }
  }
  return { found: false, urlCount: 0, urls: [] };
}

function arrify<T>(v: T | T[] | undefined): T[] {
  if (v === undefined) return [];
  return Array.isArray(v) ? v : [v];
}
