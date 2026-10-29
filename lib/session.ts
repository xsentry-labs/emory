import { cookies } from "next/headers";
import { getUser } from "./account-admin";
import { getAccountsDb, type Account } from "./accounts";
import { SESSION_COOKIE, SESSION_TTL_MS, sessionSecret, signSession } from "./session-token";

/**
 * Set the session cookie for an account, stamped with its current session
 * version. Deliberately a plain server module, NOT a "use server" export:
 * exported server actions are callable by anyone, and this signs a session.
 */
export async function startSession(account: Account): Promise<void> {
  const secret = sessionSecret();
  if (!secret) throw new Error("Server is missing SESSION_SECRET.");
  const version = getUser(getAccountsDb(), account.userId)?.session_version ?? 1;
  cookies().set(SESSION_COOKIE, await signSession(secret, account.userId, account.workspaceId, Date.now(), version), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
  });
}

export function endSession(): void {
  cookies().delete(SESSION_COOKIE);
}

/** Base URL for links in emails: APP_URL, else the host this request came in on. */
export function appUrl(h: Headers): string {
  const configured = process.env.APP_URL?.trim().replace(/\/+$/, "");
  if (configured) return configured;
  return `${h.get("x-forwarded-proto") ?? "http"}://${h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000"}`;
}
