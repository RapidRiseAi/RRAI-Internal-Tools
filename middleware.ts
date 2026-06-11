import { NextResponse, type NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const session = request.cookies.get("rrai_session")?.value;
  const { pathname } = request.nextUrl;
  if (pathname === "/") return NextResponse.redirect(new URL("/dashboard", request.url));
  if (pathname.startsWith("/login") && session) return NextResponse.redirect(new URL("/dashboard", request.url));
  if (!session && !pathname.startsWith("/login") && !pathname.startsWith("/_next") && !pathname.includes(".")) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  return NextResponse.next();
}

export const config = { matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"] };
