import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { getUser, sessionIsCurrent } from "./account-admin";
import { getAccountsDb } from "./accounts";
import { getWorkspaceDb, type DB } from "./db";

/** Headers set by middleware after it verifies the session cookie. Never trusted from the client. */
export const WORKSPACE_HEADER = "x-emory-workspace";
export const USER_HEADER = "x-emory-user";
export const VERSION_HEADER = "x-emory-session";

/**
 * The signed-in user, or null. The middleware only checks the cookie's
 * signature; this also checks it hasn't been revoked (password change,
 * removal from the team, deleted workspace). Once per request.
 */
export const currentUser = cache((): { userId: number; workspaceId: number } | null => {
  const h = headers();
  const claims = { userId: Number(h.get(USER_HEADER)), workspaceId: Number(h.get(WORKSPACE_HEADER)), version: Number(h.get(VERSION_HEADER)) };
  if (![claims.userId, claims.workspaceId, claims.version].every((n) => Number.isInteger(n) && n > 0)) return null;
  return sessionIsCurrent(getAccountsDb(), claims) ? { userId: claims.userId, workspaceId: claims.workspaceId } : null;
});

/** True when a cookie is present but no longer valid, so the caller can send the browser to clear it. */
export const sessionRevoked = (): boolean => Boolean(headers().get(USER_HEADER)) && currentUser() === null;

/** The signed-in user's workspace database. Only valid inside a request. */
export function getDb(): DB {
  const user = currentUser();
  if (!user) {
    if (sessionRevoked()) redirect("/api/auth/expired");
    throw new Error("Not signed in");
  }
  return getWorkspaceDb(user.workspaceId);
}

/** The signed-in user's account row, for pages that show who they are. */
export function currentAccount() {
  const user = currentUser();
  return user ? (getUser(getAccountsDb(), user.userId) ?? null) : null;
}
