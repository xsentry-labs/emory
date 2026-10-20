import { NextResponse } from "next/server";
import { userCanAccessInstallation } from "@/lib/integrations/github";
import { saveConnection } from "@/lib/integrations/store";
import { logEvent } from "@/lib/audit";
import { actorEmail, currentUser, getDb } from "@/lib/request-db";
import { verifyState } from "@/lib/secrets";

export const dynamic = "force-dynamic";

/** GitHub's Setup URL after the App is installed: ?installation_id=…&setup_action=install&state=…&code=… */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const back = (msg: string) => NextResponse.redirect(new URL(`/site/settings?error=${encodeURIComponent(msg)}`, req.url));
  const user = currentUser();
  const installationId = Number(url.searchParams.get("installation_id"));
  const state = url.searchParams.get("state") ?? "";
  const code = url.searchParams.get("code") ?? "";
  if (!user) return NextResponse.redirect(new URL("/login", req.url));
  if (verifyState(state, "github") !== user.workspaceId) return back("That GitHub link expired or wasn't started here. Try connecting again.");
  if (!Number.isInteger(installationId) || installationId < 1) return back("GitHub didn't say which installation to use.");
  try {
    if (!code || !(await userCanAccessInstallation(code, installationId))) return back("Couldn't confirm you have access to that GitHub installation.");
  } catch (err) {
    return back(err instanceof Error ? err.message : "GitHub check failed.");
  }
  saveConnection(getDb(), "github", { installationId });
  logEvent(getDb(), { actor: actorEmail(), track: "account", action: "connected github", target: `installation ${installationId}` });
  return NextResponse.redirect(new URL("/site/settings?connected=github", req.url));
}
