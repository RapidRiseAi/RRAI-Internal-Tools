import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";
import { getSupabaseAdmin, hasSupabaseConfig } from "./supabase";
import type { User } from "./types";

const cookieName = "rrai_session";
const secret = new TextEncoder().encode(process.env.SESSION_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || "development-secret-change-me-development-secret");

export async function createSession(userId: string) {
  const token = await new SignJWT({ userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("8h")
    .sign(secret);

  (await cookies()).set(cookieName, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 8,
  });
}

export async function destroySession() {
  (await cookies()).delete(cookieName);
}

export async function getCurrentUser() {
  const token = (await cookies()).get(cookieName)?.value;
  if (!token || !hasSupabaseConfig()) return null;

  try {
    const verified = await jwtVerify(token, secret);
    const userId = verified.payload.userId;
    if (typeof userId !== "string") return null;

    const { data } = await getSupabaseAdmin()
      .from("users")
      .select("*, role:roles(*)")
      .eq("id", userId)
      .eq("status", "ACTIVE")
      .maybeSingle();

    return data as User | null;
  } catch {
    return null;
  }
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export function permissionsFor(user: User | null) {
  return Array.isArray(user?.role?.permissions) ? user.role.permissions : [];
}

export async function requirePermission(permission: string) {
  const user = await requireUser();
  if (!permissionsFor(user).includes(permission)) redirect("/dashboard");
  return user;
}
