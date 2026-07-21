import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Optimistic check only: does a session cookie exist? Real validation
// (is it valid, is the user approved, which business is active) happens in
// src/lib/auth.ts's getCurrentUser()/getCurrentBusinessId(), called at the
// top of every page/action. See CLAUDE.md section 9.
const PUBLIC_PATHS = ["/login", "/signup", "/pending-approval"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return NextResponse.next();
  }

  const hasSession = request.cookies.has("session");
  if (!hasSession) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)",
  ],
};
