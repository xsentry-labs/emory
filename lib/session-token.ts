/**
 * Signed session tokens using Web Crypto, so the same code runs in the edge
 * middleware and in Node. Format: userId.workspaceId.version.expiresAtMs.signature
 * The version is the user's session_version: bumping it (password change,
 * removal from a team) invalidates every token issued before.
 */
export const SESSION_COOKIE = "emory_session";
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const enc = new TextEncoder();

function toBase64Url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function sign(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return toBase64Url(new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(data))));
}

/** Constant-time string comparison. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** The signing secret. SESSION_SECRET is preferred; ADMIN_PASSWORD keeps older deployments working. */
export function sessionSecret(env: Record<string, string | undefined> = process.env): string | null {
  return env.SESSION_SECRET?.trim() || env.ADMIN_PASSWORD?.trim() || null;
}

export async function signSession(secret: string, userId: number, workspaceId: number, now = Date.now(), version = 1): Promise<string> {
  const body = `${userId}.${workspaceId}.${version}.${now + SESSION_TTL_MS}`;
  return `${body}.${await sign(secret, body)}`;
}

export interface SessionClaims {
  userId: number;
  workspaceId: number;
  version: number;
}

export async function verifySession(secret: string, token: string | undefined, now = Date.now()): Promise<SessionClaims | null> {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 5) return null;
  const [u, w, v, exp, sig] = parts;
  if (!safeEqual(sig, await sign(secret, `${u}.${w}.${v}.${exp}`))) return null;
  const userId = Number(u);
  const workspaceId = Number(w);
  const version = Number(v);
  if (![userId, workspaceId, version].every((n) => Number.isInteger(n) && n >= 1)) return null;
  if (!(Number(exp) > now)) return null;
  return { userId, workspaceId, version };
}
