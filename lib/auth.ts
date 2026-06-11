import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";
import { prisma } from "./db";

const cookieName = "rrai_session";
const secret = new TextEncoder().encode(process.env.SESSION_SECRET || "development-secret-change-me-development-secret");

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
  if (!token) return null;
  try {
    const verified = await jwtVerify(token, secret);
    const userId = verified.payload.userId;
    if (typeof userId !== "string") return null;
    return prisma.user.findUnique({
      where: { id: userId, status: "ACTIVE" },
      include: { role: true },
    });
  } catch {
    return null;
  }
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export function permissionsFor(user: Awaited<ReturnType<typeof getCurrentUser>>) {
  if (!user) return [];
  return Array.isArray(user.role.permissions) ? (user.role.permissions as string[]) : [];
}

export async function requirePermission(permission: string) {
  const user = await requireUser();
  const granted = permissionsFor(user).includes(permission);
  if (!granted) redirect("/dashboard");
  return user;
}
