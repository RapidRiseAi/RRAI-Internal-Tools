import { NextResponse } from "next/server";
import { googleOAuthUrl, hasGoogleConfig } from "@/lib/google";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get("mode") === "connect" ? "connect" : "login";
  const requestedReturnTo = url.searchParams.get("returnTo");
  const returnTo = requestedReturnTo?.startsWith("/") && !requestedReturnTo.startsWith("//") ? requestedReturnTo : mode === "connect" ? "/tasks" : undefined;
  if (!hasGoogleConfig()) {
    return NextResponse.redirect(
      new URL(mode === "connect" ? `${returnTo ?? "/tasks"}?google=not-configured` : "/login?google=not-configured", request.url),
    );
  }
  return NextResponse.redirect(googleOAuthUrl(mode, returnTo));
}
