import { NextResponse } from "next/server";
import { exchangeCode, googleConfig } from "@/lib/integrations/google";
import { removeConnection, saveConnection } from "@/lib/integrations/store";
import { logEvent } from "@/lib/audit";
import { actorEmail, currentUser, getDb } from "@/lib/request-db";
import { verifyState } from "@/lib/secrets";
import { syncSearchConsole } from "@/lib/site/results";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const back = (msg: string) => NextResponse.redirect(new URL(`/site/settings?error=${encodeURIComponent(msg)}`, req.url));
  const user = currentUser();
  const cfg = googleConfig();
  if (!user) return NextResponse.redirect(new URL("/login", req.url));
  if (!cfg) return back("Google isn't configured on this server.");
  if (url.searchParams.get("error")) return back("Google sign-in was cancelled.");
  if (verifyState(url.searchParams.get("state") ?? "", "google") !== user.workspaceId) return back("That Google link expired. Try connecting again.");
  try {
    const { refreshToken } = await exchangeCode(cfg, url.searchParams.get("code") ?? "");
    const db = getDb();
    removeConnection(db, "google");
    saveConnection(db, "google", { refreshToken }, ["refreshToken"]);
    logEvent(db, { actor: actorEmail(), track: "account", action: "connected search console" });
    void syncSearchConsole(db);
  } catch (err) {
    return back(err instanceof Error ? err.message : "Google sign-in failed.");
  }
  return NextResponse.redirect(new URL("/site/settings?connected=google", req.url));
}
