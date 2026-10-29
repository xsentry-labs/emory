import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/session-token";

export const dynamic = "force-dynamic";

/**
 * A cookie that verifies but was revoked (password changed, removed from the
 * team, workspace deleted). Clear it and go to login; without this, login would
 * keep redirecting a "signed in" browser back into the app.
 */
export function GET(req: Request) {
  const res = NextResponse.redirect(new URL("/login?expired=1", req.url));
  res.cookies.delete(SESSION_COOKIE);
  return res;
}
