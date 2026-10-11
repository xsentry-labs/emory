import { headers } from "next/headers";
import { getWorkspaceDb, type DB } from "./db";

/** Headers set by middleware after it verifies the session cookie. Never trusted from the client. */
export const WORKSPACE_HEADER = "x-emory-workspace";
export const USER_HEADER = "x-emory-user";

/** The signed-in user's workspace database. Only valid inside a request. */
export function getDb(): DB {
  const id = Number(headers().get(WORKSPACE_HEADER));
  if (!Number.isInteger(id) || id < 1) throw new Error("Not signed in");
  return getWorkspaceDb(id);
}

export function currentUser(): { userId: number; workspaceId: number } | null {
  const h = headers();
  const userId = Number(h.get(USER_HEADER));
  const workspaceId = Number(h.get(WORKSPACE_HEADER));
  return Number.isInteger(userId) && userId > 0 && Number.isInteger(workspaceId) && workspaceId > 0
    ? { userId, workspaceId }
    : null;
}
