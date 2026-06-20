import "server-only";

import { getSupabaseAdmin } from "./supabase";

export const googleScopes = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/drive.metadata.readonly",
];

function baseUrl() {
  return process.env.NEXT_PUBLIC_APP_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
}

export function hasGoogleConfig() {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

export function googleOAuthUrl(mode: "login" | "connect") {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID || "",
    redirect_uri: `${baseUrl()}/api/auth/google/callback`,
    response_type: "code",
    scope: googleScopes.join(" "),
    access_type: "offline",
    prompt: "consent",
    state: mode,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

type TokenResponse = { access_token: string; expires_in: number; refresh_token?: string; scope?: string };
type GoogleUser = { sub: string; email: string; name?: string; picture?: string };

export async function exchangeGoogleCode(code: string) {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID || "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET || "",
      redirect_uri: `${baseUrl()}/api/auth/google/callback`,
      grant_type: "authorization_code",
    }),
  });
  if (!response.ok) throw new Error("Google token exchange failed.");
  return response.json() as Promise<TokenResponse>;
}

export async function getGoogleUser(accessToken: string) {
  const response = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) throw new Error("Unable to read Google profile.");
  return response.json() as Promise<GoogleUser>;
}

export async function upsertGoogleConnection(input: { userId: string; googleUser: GoogleUser; tokens: TokenResponse }) {
  const expiresAt = new Date(Date.now() + input.tokens.expires_in * 1000).toISOString();
  const payload = {
    user_id: input.userId,
    google_sub: input.googleUser.sub,
    google_email: input.googleUser.email.toLowerCase(),
    google_name: input.googleUser.name ?? null,
    access_token: input.tokens.access_token,
    ...(input.tokens.refresh_token ? { refresh_token: input.tokens.refresh_token } : {}),
    token_expires_at: expiresAt,
    scopes: input.tokens.scope ? input.tokens.scope.split(" ") : googleScopes,
    calendar_connected: true,
    drive_connected: true,
    updated_at: new Date().toISOString(),
  };
  const { error } = await getSupabaseAdmin().from("google_connections").upsert(payload, { onConflict: "user_id" });
  if (error) throw error;
}

async function refreshAccessToken(connection: { user_id: string; refresh_token: string | null }) {
  if (!connection.refresh_token) return null;
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID || "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET || "",
      refresh_token: connection.refresh_token,
      grant_type: "refresh_token",
    }),
  });
  if (!response.ok) return null;
  const tokens = await response.json() as TokenResponse;
  await getSupabaseAdmin().from("google_connections").update({
    access_token: tokens.access_token,
    token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  }).eq("user_id", connection.user_id);
  return tokens.access_token;
}

export async function accessTokenForUser(userId: string) {
  const { data } = await getSupabaseAdmin().from("google_connections").select("user_id,access_token,refresh_token,token_expires_at,calendar_connected").eq("user_id", userId).maybeSingle();
  if (!data?.calendar_connected) return null;
  if (data.token_expires_at && new Date(data.token_expires_at).getTime() > Date.now() + 60000) return data.access_token as string;
  return refreshAccessToken(data as { user_id: string; refresh_token: string | null });
}

async function deleteGoogleCalendarEvent(userId: string, eventId: string) {
  const accessToken = await accessTokenForUser(userId);
  if (!accessToken) return;
  await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`, {
    method: "DELETE",
    headers: { authorization: `Bearer ${accessToken}` },
  });
}

export async function syncTaskToGoogleCalendar(taskId: string) {
  if (!hasGoogleConfig()) return;
  const { data: task } = await getSupabaseAdmin()
    .from("tasks")
    .select("id,title,description,due_date,assigned_to,google_calendar_event_id,google_calendar_user_id")
    .eq("id", taskId)
    .maybeSingle();
  if (!task) return;

  const existingEventId = task.google_calendar_event_id as string | null;
  const existingUserId = task.google_calendar_user_id as string | null;
  const assignedUserId = task.assigned_to as string | null;

  if (existingEventId && existingUserId && existingUserId !== assignedUserId) {
    await deleteGoogleCalendarEvent(existingUserId, existingEventId);
  }

  if (!assignedUserId || !task.due_date) {
    if (existingEventId && existingUserId) await deleteGoogleCalendarEvent(existingUserId, existingEventId);
    await getSupabaseAdmin()
      .from("tasks")
      .update({ google_calendar_event_id: null, google_calendar_event_url: null, google_calendar_user_id: null, google_calendar_synced_at: null })
      .eq("id", taskId);
    return;
  }

  const accessToken = await accessTokenForUser(assignedUserId);
  if (!accessToken) return;
  const start = new Date(task.due_date as string);
  const end = new Date(start.getTime() + 60 * 60 * 1000);
  const body = {
    summary: task.title,
    description: task.description ?? "Rapid Rise OS task",
    start: { dateTime: start.toISOString() },
    end: { dateTime: end.toISOString() },
    extendedProperties: { private: { rapidRiseTaskId: task.id } },
  };
  const eventId = existingUserId === assignedUserId ? existingEventId : null;
  const eventUrl = `https://www.googleapis.com/calendar/v3/calendars/primary/events${eventId ? `/${eventId}` : ""}`;
  let response = await fetch(eventUrl, {
    method: eventId ? "PATCH" : "POST",
    headers: { authorization: `Bearer ${accessToken}`, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (response.status === 404 && eventId) {
    response = await fetch("https://www.googleapis.com/calendar/v3/calendars/primary/events", {
      method: "POST",
      headers: { authorization: `Bearer ${accessToken}`, "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  }
  if (!response.ok) return;
  const event = await response.json() as { id?: string; htmlLink?: string };
  if (event.id) {
    await getSupabaseAdmin()
      .from("tasks")
      .update({
        google_calendar_event_id: event.id,
        google_calendar_event_url: event.htmlLink ?? null,
        google_calendar_user_id: assignedUserId,
        google_calendar_synced_at: new Date().toISOString(),
      })
      .eq("id", taskId);
  }
}

export async function syncAssignedTasksToGoogleCalendar(userId: string) {
  if (!hasGoogleConfig()) return;
  const { data: tasks } = await getSupabaseAdmin()
    .from("tasks")
    .select("id")
    .eq("assigned_to", userId)
    .not("due_date", "is", null)
    .neq("status", "SCRAPPED");
  for (const task of tasks ?? []) {
    await syncTaskToGoogleCalendar(task.id as string);
  }
}
