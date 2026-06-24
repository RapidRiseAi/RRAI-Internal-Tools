import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { createSession } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";

const loginSchema = z.object({
  email: z.string().trim().email().transform((value) => value.toLowerCase()),
  password: z.string().min(1).max(256),
});

function json(body: object, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function hasTrustedOrigin(request: Request) {
  const origin = request.headers.get("origin");
  return Boolean(origin && origin === new URL(request.url).origin);
}

export async function POST(request: Request) {
  if (!hasTrustedOrigin(request)) {
    return json({ error: "This login request was rejected. Refresh the page and try again." }, 403);
  }

  const parsed = loginSchema.safeParse(
    Object.fromEntries(await request.formData().catch(() => new FormData())),
  );
  if (!parsed.success) {
    return json({ error: "Enter a valid email address and password." }, 400);
  }

  try {
    const supabase = getSupabaseAdmin();
    const { data: user, error: lookupError } = await supabase
      .from("users")
      .select("id,password_hash,status")
      .eq("email", parsed.data.email)
      .maybeSingle();

    if (lookupError) {
      console.error("os_login_lookup_failed", { code: lookupError.code });
      return json({ error: "The login service is temporarily unavailable. Please try again." }, 503);
    }

    const passwordHash = typeof user?.password_hash === "string"
      ? user.password_hash
      : "";
    const passwordMatches = user?.status === "ACTIVE"
      && passwordHash.startsWith("$2")
      && await bcrypt.compare(parsed.data.password, passwordHash);

    if (!passwordMatches) {
      return json({ error: "The email or password is incorrect." }, 401);
    }

    await createSession(user.id as string);
    const { error: updateError } = await supabase
      .from("users")
      .update({ last_login_at: new Date().toISOString() })
      .eq("id", user.id as string);
    if (updateError) {
      console.error("os_login_timestamp_failed", { code: updateError.code });
    }

    return json({ ok: true });
  } catch (error) {
    console.error("os_login_unexpected_failure", {
      code: error instanceof Error ? error.name : "unknown",
    });
    return json({ error: "We could not complete the login. Refresh the page and try again." }, 500);
  }
}
