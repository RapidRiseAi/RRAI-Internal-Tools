import { NextResponse } from "next/server";
import { googleOAuthUrl, hasGoogleConfig } from "@/lib/google";

export async function GET(request: Request) {
  const mode = new URL(request.url).searchParams.get("mode") === "connect" ? "connect" : "login";
  if (!hasGoogleConfig()) {
    return NextResponse.redirect(
      new URL(mode === "connect" ? "/settings?google=not-configured" : "/login?google=not-configured", request.url),
    );
  }
  return NextResponse.redirect(googleOAuthUrl(mode));
}
