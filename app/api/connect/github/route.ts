import { NextResponse } from "next/server";
import { githubAppConfig, installUrl } from "@/lib/integrations/github";
import { currentUser } from "@/lib/request-db";
import { signState } from "@/lib/secrets";

export const dynamic = "force-dynamic";

/** Send the user to install the Emory GitHub App on their repository. */
export function GET(req: Request) {
  const user = currentUser();
  const cfg = githubAppConfig();
  if (!user) return NextResponse.redirect(new URL("/login", req.url));
  if (!cfg) return NextResponse.redirect(new URL("/site/settings?error=The+GitHub+App+isn%27t+configured+on+this+server.", req.url));
  return NextResponse.redirect(installUrl(cfg, signState(user.workspaceId, "github")));
}
