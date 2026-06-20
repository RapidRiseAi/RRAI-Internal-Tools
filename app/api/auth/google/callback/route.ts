import { NextResponse } from "next/server";
import { createSession, getCurrentUser } from "@/lib/auth";
import { exchangeGoogleCode, getGoogleUser, syncAssignedTasksToGoogleCalendar, upsertGoogleConnection } from "@/lib/google";
import { getSupabaseAdmin } from "@/lib/supabase";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const mode = url.searchParams.get("state") === "connect" ? "connect" : "login";
  if (!code) return NextResponse.redirect(new URL("/login?google=missing-code", request.url));
  try {
    const tokens = await exchangeGoogleCode(code);
    const googleUser = await getGoogleUser(tokens.access_token);
    const currentUser = await getCurrentUser();
    const { data: matchedUser } = await getSupabaseAdmin()
      .from("users")
      .select("id,email,status")
      .eq("email", googleUser.email.toLowerCase())
      .eq("status", "ACTIVE")
      .maybeSingle();
    const userId = mode === "connect" ? currentUser?.id : matchedUser?.id;
    if (!userId) return NextResponse.redirect(new URL("/login?google=no-user", request.url));
    await upsertGoogleConnection({ userId: userId as string, googleUser, tokens });
    await syncAssignedTasksToGoogleCalendar(userId as string);
    if (mode === "login") await createSession(userId as string);
    return NextResponse.redirect(new URL(mode === "connect" ? "/settings?google=connected" : "/dashboard", request.url));
  } catch {
    return NextResponse.redirect(new URL("/login?google=failed", request.url));
  }
}
