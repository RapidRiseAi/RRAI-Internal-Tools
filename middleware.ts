import { NextResponse, type NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  // This middleware is intentionally a lightweight UX guard for simple login
  // redirects only. It is not authoritative authorization: every protected
  // page and route must still call requireUser() or requirePagePermission()
  // before loading sensitive data. JWT verification can be added here only if
  // the session secret handling remains edge-runtime compatible.
  const session = request.cookies.get("rrai_session")?.value;
  const { pathname } = request.nextUrl;

  if (pathname === "/") return NextResponse.redirect(new URL("/dashboard", request.url));
  if (!session && !pathname.startsWith("/login") && !pathname.startsWith("/_next") && !pathname.includes(".")) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = { matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"] };
