import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, sessionSecret, verifySession } from "./lib/session-token";

// Headers carrying the verified identity into pages and actions. They are
// always overwritten here, so a client can never supply its own.
const WORKSPACE_HEADER = "x-emory-workspace";
const USER_HEADER = "x-emory-user";

const PUBLIC_PAGES = new Set(["/login", "/signup"]);
// The marketing site: anyone can view it; signed-in visitors get their identity attached.
const MARKETING_PAGES = new Set(["/", "/pricing", "/start"]);
// The public site report can be viewed (and saved) by anyone with its link.
const isMarketing = (pathname: string) => MARKETING_PAGES.has(pathname) || pathname.startsWith("/report/");

export async function middleware(req: NextRequest) {
  const secret = sessionSecret();
  if (!secret) {
    return new NextResponse("Set SESSION_SECRET (or ADMIN_PASSWORD) to start the app.", { status: 503 });
  }

  const { pathname } = req.nextUrl;
  const claims = await verifySession(secret, req.cookies.get(SESSION_COOKIE)?.value);

  const headers = new Headers(req.headers);
  headers.delete(WORKSPACE_HEADER);
  headers.delete(USER_HEADER);

  if (isMarketing(pathname)) {
    if (claims) {
      headers.set(WORKSPACE_HEADER, String(claims.workspaceId));
      headers.set(USER_HEADER, String(claims.userId));
    }
    return NextResponse.next({ request: { headers } });
  }

  if (PUBLIC_PAGES.has(pathname)) {
    // Already signed in: go to the app instead of showing the form again.
    if (claims) return NextResponse.redirect(new URL("/", req.url));
    return NextResponse.next({ request: { headers } });
  }

  if (!claims) {
    if (pathname.startsWith("/api/")) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    return NextResponse.redirect(new URL("/login", req.url));
  }

  headers.set(WORKSPACE_HEADER, String(claims.workspaceId));
  headers.set(USER_HEADER, String(claims.userId));
  return NextResponse.next({ request: { headers } });
}

export const config = { matcher: ["/((?!api/health|_next/static|_next/image|icon.svg).*)"] };
