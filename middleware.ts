import { NextResponse, type NextRequest } from "next/server";

// One shared admin password for the whole app (HTTP Basic Auth, any username).
// /api/health stays open for Railway's health check.
export function middleware(req: NextRequest) {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) {
    if (process.env.NODE_ENV === "production") {
      return new NextResponse("ADMIN_PASSWORD is not set", { status: 503 });
    }
    return NextResponse.next();
  }
  const header = req.headers.get("authorization") ?? "";
  if (header.startsWith("Basic ")) {
    try {
      const decoded = atob(header.slice(6));
      const supplied = decoded.slice(decoded.indexOf(":") + 1);
      if (supplied === password) return NextResponse.next();
    } catch {
      /* fall through to 401 */
    }
  }
  return new NextResponse("Authentication required", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Emory", charset="UTF-8"' },
  });
}

export const config = { matcher: ["/((?!api/health|_next/static|_next/image|icon.svg).*)"] };
