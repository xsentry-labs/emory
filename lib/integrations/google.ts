import type { Fetch } from "./github";

/**
 * Google OAuth (web server flow) for Search Console, read-only. Env:
 * GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, APP_URL (to build the redirect).
 * The refresh token is stored encrypted; access tokens are fetched per use.
 */

export const GSC_SCOPE = "https://www.googleapis.com/auth/webmasters.readonly";

export interface GoogleConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

export function googleConfig(env: Record<string, string | undefined> = process.env): GoogleConfig | null {
  const clientId = env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = env.GOOGLE_CLIENT_SECRET?.trim();
  const app = env.APP_URL?.trim().replace(/\/+$/, "");
  return clientId && clientSecret && app ? { clientId, clientSecret, redirectUri: `${app}/api/connect/google/callback` } : null;
}

export function authUrl(cfg: GoogleConfig, state: string): string {
  const q = new URLSearchParams({
    client_id: cfg.clientId,
    redirect_uri: cfg.redirectUri,
    response_type: "code",
    scope: GSC_SCOPE,
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${q}`;
}

async function token(f: Fetch, params: Record<string, string>): Promise<{ access_token: string; refresh_token?: string }> {
  const res = await f("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params),
  });
  const body = (await res.json().catch(() => ({}))) as { access_token?: string; refresh_token?: string; error?: string; error_description?: string };
  if (!res.ok || !body.access_token) throw new Error(`Google sign-in failed: ${body.error_description ?? body.error ?? res.status}`);
  return { access_token: body.access_token, refresh_token: body.refresh_token };
}

export async function exchangeCode(cfg: GoogleConfig, code: string, f: Fetch = fetch): Promise<{ accessToken: string; refreshToken: string }> {
  const t = await token(f, {
    code,
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
    redirect_uri: cfg.redirectUri,
    grant_type: "authorization_code",
  });
  if (!t.refresh_token) throw new Error("Google did not return a refresh token. Remove Emory's access in your Google account and connect again.");
  return { accessToken: t.access_token, refreshToken: t.refresh_token };
}

export async function accessToken(cfg: GoogleConfig, refreshToken: string, f: Fetch = fetch): Promise<string> {
  return (await token(f, { refresh_token: refreshToken, client_id: cfg.clientId, client_secret: cfg.clientSecret, grant_type: "refresh_token" }))
    .access_token;
}

async function gsc<T>(f: Fetch, access: string, path: string, body?: unknown): Promise<T> {
  const res = await f(`https://www.googleapis.com/webmasters/v3${path}`, {
    method: body ? "POST" : "GET",
    headers: { authorization: `Bearer ${access}`, ...(body ? { "content-type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`Search Console ${res.status}: ${(await res.text().catch(() => "")).slice(0, 200)}`);
  return (await res.json()) as T;
}

/** Properties the user can read, e.g. "sc-domain:loomwise.co" or "https://loomwise.co/". */
export async function listSites(access: string, f: Fetch = fetch): Promise<string[]> {
  const r = await gsc<{ siteEntry?: { siteUrl: string; permissionLevel: string }[] }>(f, access, "/sites");
  return (r.siteEntry ?? []).filter((s) => s.permissionLevel !== "siteUnverifiedUser").map((s) => s.siteUrl);
}

/** Pick the property that covers a website: an exact URL-prefix match, else its domain property. */
export function matchProperty(sites: string[], website: string): string | null {
  let host = "";
  try {
    host = new URL(website).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
  return (
    sites.find((s) => {
      try {
        return new URL(s).hostname.replace(/^www\./, "") === host;
      } catch {
        return false;
      }
    }) ??
    sites.find((s) => s === `sc-domain:${host}`) ??
    null
  );
}

export interface GscRow {
  day: string;
  page: string;
  clicks: number;
  impressions: number;
  position: number;
}

/** Daily clicks, impressions and average position per page. Dates are YYYY-MM-DD. */
export async function searchAnalytics(access: string, property: string, startDate: string, endDate: string, f: Fetch = fetch): Promise<GscRow[]> {
  const rows: GscRow[] = [];
  for (let startRow = 0; startRow < 100_000; startRow += 25_000) {
    const r = await gsc<{ rows?: { keys: [string, string]; clicks: number; impressions: number; position: number }[] }>(
      f,
      access,
      `/sites/${encodeURIComponent(property)}/searchAnalytics/query`,
      { startDate, endDate, dimensions: ["date", "page"], rowLimit: 25_000, startRow },
    );
    for (const x of r.rows ?? []) rows.push({ day: x.keys[0], page: x.keys[1], clicks: x.clicks, impressions: x.impressions, position: x.position });
    if ((r.rows?.length ?? 0) < 25_000) break;
  }
  return rows;
}
