import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { sessionSecret } from "./session-token";

/**
 * Encryption for stored third-party tokens (AES-256-GCM), keyed from
 * ENCRYPTION_KEY, or the session secret when that isn't set.
 */
function key(env: Record<string, string | undefined> = process.env): Buffer {
  const material = env.ENCRYPTION_KEY?.trim() || sessionSecret(env);
  if (!material) throw new Error("Set SESSION_SECRET (or ENCRYPTION_KEY) to store connections.");
  return createHash("sha256").update(`emory-secrets:${material}`).digest();
}

export function encrypt(plain: string, env?: Record<string, string | undefined>): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(env), iv);
  const body = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return ["v1", iv.toString("base64url"), c.getAuthTag().toString("base64url"), body.toString("base64url")].join(".");
}

export function decrypt(sealed: string, env?: Record<string, string | undefined>): string {
  const [v, iv, tag, body] = sealed.split(".");
  if (v !== "v1" || !iv || !tag || body === undefined) throw new Error("Unreadable secret");
  const d = createDecipheriv("aes-256-gcm", key(env), Buffer.from(iv, "base64url"));
  d.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([d.update(Buffer.from(body, "base64url")), d.final()]).toString("utf8");
}

/**
 * OAuth "state": binds a redirect to the workspace that started it and expires
 * after 15 minutes, so a callback can't be replayed into another workspace.
 */
export function signState(workspaceId: number, provider: string, now = Date.now(), env?: Record<string, string | undefined>): string {
  const body = `${workspaceId}.${provider}.${now + 15 * 60_000}.${randomBytes(8).toString("hex")}`;
  return `${body}.${createHmac("sha256", key(env)).update(body).digest("base64url")}`;
}

export function verifyState(state: string, provider: string, now = Date.now(), env?: Record<string, string | undefined>): number | null {
  const parts = state.split(".");
  if (parts.length !== 5) return null;
  const [ws, p, exp, nonce, sig] = parts;
  const expected = createHmac("sha256", key(env)).update(`${ws}.${p}.${exp}.${nonce}`).digest("base64url");
  if (sig.length !== expected.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  if (p !== provider || Number(exp) < now) return null;
  const id = Number(ws);
  return Number.isInteger(id) && id > 0 ? id : null;
}
