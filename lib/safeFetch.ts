import dns from "node:dns/promises";
import net from "node:net";

/** True for loopback, private, link-local and other non-public addresses. */
export function isPrivateIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number);
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 100 && b >= 64 && b <= 127) ||
      a >= 224
    );
  }
  const v = ip.toLowerCase();
  if (v.startsWith("::ffff:")) return isPrivateIp(v.slice(7));
  return (
    v === "::" ||
    v === "::1" ||
    v.startsWith("fc") ||
    v.startsWith("fd") ||
    v.startsWith("fe8") ||
    v.startsWith("fe9") ||
    v.startsWith("fea") ||
    v.startsWith("feb")
  );
}

export function normalizeUrl(input: string): URL | null {
  const raw = input.trim();
  if (!raw) return null;
  // Reject any explicit non-http(s) scheme instead of prefixing https:// onto it.
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(raw) && !/^https?:\/\//i.test(raw)) return null;
  try {
    const u = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    return u.protocol === "http:" || u.protocol === "https:" ? u : null;
  } catch {
    return null;
  }
}

async function assertPublic(url: URL): Promise<void> {
  const host = url.hostname.replace(/^\[|\]$/g, "");
  const addrs = net.isIP(host) ? [{ address: host }] : await dns.lookup(host, { all: true });
  if (addrs.length === 0 || addrs.some((a) => isPrivateIp(a.address))) {
    throw new Error(`Refusing to fetch non-public address for ${host}`);
  }
}

export function htmlToText(html: string): string {
  return html
    .replace(/<(script|style|noscript|svg)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Fetch a public web page's text. Guards against SSRF (every hop is resolved
 * and must be public), and caps redirects, time and size.
 */
export async function fetchPageText(input: string, maxBytes = 300_000): Promise<string> {
  let url = normalizeUrl(input);
  if (!url) throw new Error("Invalid website URL");
  for (let hop = 0; hop < 4; hop++) {
    await assertPublic(url);
    const res = await fetch(url, {
      redirect: "manual",
      signal: AbortSignal.timeout(10_000),
      headers: { "user-agent": "EmoryGrowthBot/1.0", accept: "text/html,text/plain" },
    });
    const location = res.headers.get("location");
    if (res.status >= 300 && res.status < 400 && location) {
      const next = normalizeUrl(new URL(location, url).href);
      if (!next) throw new Error("Bad redirect");
      url = next;
      continue;
    }
    if (!res.ok) throw new Error(`Website returned ${res.status}`);
    const reader = res.body?.getReader();
    if (!reader) return "";
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (size < maxBytes) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      size += value.length;
    }
    await reader.cancel().catch(() => {});
    return htmlToText(Buffer.concat(chunks).toString("utf-8"));
  }
  throw new Error("Too many redirects");
}

export interface RawPage {
  /** Final URL after redirects. */
  url: string;
  status: number;
  contentType: string;
  body: string;
  ms: number;
  /** True if at least one redirect was followed. */
  redirected: boolean;
}

/**
 * Like fetchPageText but returns the raw response (including non-2xx), for
 * crawling. Still public-addresses-only on every hop, with time/size caps.
 * Throws only on network, SSRF or redirect-loop failures.
 */
export async function fetchRaw(input: string, maxBytes = 500_000): Promise<RawPage> {
  let url = normalizeUrl(input);
  if (!url) throw new Error("Invalid URL");
  const started = Date.now();
  for (let hop = 0; hop < 5; hop++) {
    await assertPublic(url);
    const res = await fetch(url, {
      redirect: "manual",
      signal: AbortSignal.timeout(10_000),
      headers: { "user-agent": "EmoryGrowthBot/1.0 (+site audit)", accept: "text/html,application/xhtml+xml,text/plain,*/*;q=0.5" },
    });
    const location = res.headers.get("location");
    if (res.status >= 300 && res.status < 400 && location) {
      const next = normalizeUrl(new URL(location, url).href);
      if (!next) throw new Error("Bad redirect");
      url = next;
      continue;
    }
    const contentType = res.headers.get("content-type") ?? "";
    let body = "";
    if (res.body && /text|xml|json|html/i.test(contentType || "text/html")) {
      const reader = res.body.getReader();
      const chunks: Uint8Array[] = [];
      let size = 0;
      while (size < maxBytes) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        size += value.length;
      }
      await reader.cancel().catch(() => {});
      body = Buffer.concat(chunks).toString("utf-8");
    } else {
      await res.body?.cancel().catch(() => {});
    }
    return { url: url.href, status: res.status, contentType, body, ms: Date.now() - started, redirected: hop > 0 };
  }
  throw new Error("Too many redirects");
}
