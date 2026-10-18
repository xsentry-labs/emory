import { NextResponse } from "next/server";
import { authUrl, googleConfig } from "@/lib/integrations/google";
import { currentUser } from "@/lib/request-db";
import { signState } from "@/lib/secrets";

export const dynamic = "force-dynamic";

/** Start Google sign-in for read-only Search Console access. */
export function GET(req: Request) {
  const user = currentUser();
  const cfg = googleConfig();
  if (!user) return NextResponse.redirect(new URL("/login", req.url));
  if (!cfg) return NextResponse.redirect(new URL("/site/settings?error=Google+isn%27t+configured+on+this+server.", req.url));
  return NextResponse.redirect(authUrl(cfg, signState(user.workspaceId, "google")));
}
