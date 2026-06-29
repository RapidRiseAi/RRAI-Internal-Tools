import "server-only";

import { getSupabaseAdmin } from "./supabase";
import { appTimeZone, formatDateTimeForGoogle, normalizeTimeZone } from "./timezone";

const calendarEventsScope = "https://www.googleapis.com/auth/calendar.events";
const driveMetadataScope = "https://www.googleapis.com/auth/drive.metadata.readonly";

export function googleScopes(options: { includeCalendar?: boolean } = {}) {
  const scopes = ["openid", "email", "profile"];
  if (options.includeCalendar) scopes.push(calendarEventsScope);
  if (options.includeCalendar && process.env.GOOGLE_ENABLE_DRIVE_SCOPE === "true") scopes.push(driveMetadataScope);
  return scopes;
}


const googleColorByPriority: Record<string, string> = {
  LOW: "10",
  MEDIUM: "5",
  HIGH: "6",
  URGENT: "11",
};

const inactiveTaskStatuses = new Set(["DONE", "SCRAPPED"]);

export function taskGoogleCalendarPayload(task: {
  id?: string;
  title?: string | null;
  description?: string | null;
  type?: string | null;
  status?: string | null;
  priority?: string | null;
  due_date: string;
  duration_minutes?: number | null;
  recurrence?: "NONE" | "WEEKLY" | "MONTHLY" | null;
  recurrence_interval?: number | null;
  recurrence_day_of_week?: number | null;
  recurrence_day_of_month?: number | null;
  recurrence_completion_required?: boolean | null;
  recurrence_parent_task_id?: string | null;
}, files: { filename: string; url: string }[] = [], timeZone = appTimeZone()) {
  const zone = normalizeTimeZone(timeZone);
  const start = new Date(task.due_date);
  const durationMinutes = Math.max(5, Number(task.duration_minutes ?? 60));
  const end = new Date(start.getTime() + durationMinutes * 60 * 1000);
  return {
    summary: task.title,
    description: taskCalendarDescription(task, files),
    start: { dateTime: formatDateTimeForGoogle(start, zone), timeZone: zone },
    end: { dateTime: formatDateTimeForGoogle(end, zone), timeZone: zone },
    colorId: googleColorByPriority[String(task.priority ?? "MEDIUM")] ?? googleColorByPriority.MEDIUM,
    extendedProperties: { private: { rapidRiseTaskId: task.id } },
    ...taskGoogleCalendarRecurrence(task),
  };
}

function taskGoogleCalendarRecurrence(task: {
  recurrence?: "NONE" | "WEEKLY" | "MONTHLY" | null;
  recurrence_interval?: number | null;
  recurrence_day_of_week?: number | null;
  recurrence_day_of_month?: number | null;
  recurrence_completion_required?: boolean | null;
  recurrence_parent_task_id?: string | null;
}) {
  if (!task.recurrence || task.recurrence === "NONE" || task.recurrence_completion_required || task.recurrence_parent_task_id) return {};
  const interval = Math.max(1, Number(task.recurrence_interval ?? 1));
  const parts = [`FREQ=${task.recurrence}`, `INTERVAL=${interval}`];
  if (task.recurrence === "WEEKLY" && typeof task.recurrence_day_of_week === "number") {
    parts.push(`BYDAY=${["SU", "MO", "TU", "WE", "TH", "FR", "SA"][task.recurrence_day_of_week]}`);
  }
  if (task.recurrence === "MONTHLY" && typeof task.recurrence_day_of_month === "number") {
    parts.push(`BYMONTHDAY=${task.recurrence_day_of_month}`);
  }
  return { recurrence: [`RRULE:${parts.join(";")}`] };
}

function taskCalendarDescription(task: { description?: string | null; id?: string; type?: string | null; priority?: string | null; status?: string | null }, files: { filename: string; url: string }[]) {
  const detailLines = [
    task.description?.trim() || "Rapid Rise OS task",
    "",
    `Status: ${task.status ?? "TO_DO"}`,
    `Priority: ${task.priority ?? "MEDIUM"}`,
    `Type: ${task.type ?? "ADMIN_TASK"}`,
    task.id ? `Task ID: ${task.id}` : null,
  ].filter(Boolean);
  if (files.length) {
    detailLines.push("", "Links / files:", ...files.map((file) => `- ${file.filename}: ${file.url}`));
  }
  return detailLines.join("\n");
}

function baseUrl() {
  const configuredUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  const fallbackUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000";
  const url = configuredUrl || fallbackUrl;
  return /^https?:\/\//i.test(url) ? url.replace(/\/$/, "") : `https://${url.replace(/\/$/, "")}`;
}

export function hasGoogleConfig() {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

export function googleOAuthUrl(mode: "login" | "connect", returnTo?: string) {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID || "",
    redirect_uri: `${baseUrl()}/api/auth/google/callback`,
    response_type: "code",
    scope: googleScopes({ includeCalendar: mode === "connect" }).join(" "),
    access_type: "offline",
    prompt: "consent",
    state: returnTo ? `${mode}:${returnTo}` : mode,
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

type ExistingGoogleConnection = {
  scopes?: string[] | null;
  calendar_connected?: boolean | null;
  drive_connected?: boolean | null;
} | null;

/**
 * Decide the connection flags/scopes for an OAuth callback without clobbering an
 * existing Calendar grant.
 *
 * A Google *login* only requests identity scopes (openid/email/profile), while a
 * *connect* also requests `calendar.events`. Because both flows write the same row,
 * a plain overwrite means logging in with Google downgrades a connected Calendar back
 * to `calendar_connected = false` — which silently breaks every future sync. So when
 * the incoming grant lacks the calendar scope but the user already has Calendar
 * connected, we preserve the calendar grant instead of tearing it down.
 */
export function mergeGoogleConnectionState(existing: ExistingGoogleConnection, grantedScopes: string[]) {
  const grantIncludesCalendar = grantedScopes.includes(calendarEventsScope);
  const grantIncludesDrive = grantedScopes.includes(driveMetadataScope);
  const preserveCalendar = !grantIncludesCalendar && Boolean(existing?.calendar_connected);
  return {
    preserveCalendar,
    scopes: Array.from(new Set([...(existing?.scopes ?? []), ...grantedScopes])),
    calendar_connected: grantIncludesCalendar || preserveCalendar,
    drive_connected: grantIncludesDrive || (preserveCalendar && Boolean(existing?.drive_connected)),
  };
}

export async function upsertGoogleConnection(input: { userId: string; googleUser: GoogleUser; tokens: TokenResponse }) {
  const admin = getSupabaseAdmin();
  const { data: existing } = await admin
    .from("google_connections")
    .select("access_token,refresh_token,token_expires_at,scopes,calendar_connected,drive_connected")
    .eq("user_id", input.userId)
    .maybeSingle();

  const grantedScopes = input.tokens.scope ? input.tokens.scope.split(" ") : googleScopes({ includeCalendar: true });
  const merged = mergeGoogleConnectionState(existing as ExistingGoogleConnection, grantedScopes);
  const expiresAt = new Date(Date.now() + input.tokens.expires_in * 1000).toISOString();

  // When preserving an existing Calendar connection, keep the calendar-capable
  // tokens too — an identity-only login token cannot call the Calendar API, and the
  // identity refresh token can only mint more identity tokens.
  const keepCalendarTokens = merged.preserveCalendar && Boolean(existing?.access_token);

  const payload = {
    user_id: input.userId,
    google_sub: input.googleUser.sub,
    google_email: input.googleUser.email.toLowerCase(),
    google_name: input.googleUser.name ?? null,
    access_token: keepCalendarTokens ? (existing!.access_token as string) : input.tokens.access_token,
    token_expires_at: keepCalendarTokens ? (existing!.token_expires_at as string | null) : expiresAt,
    ...(keepCalendarTokens
      ? (existing?.refresh_token ? { refresh_token: existing.refresh_token as string } : {})
      : (input.tokens.refresh_token ? { refresh_token: input.tokens.refresh_token } : {})),
    scopes: merged.scopes,
    calendar_connected: merged.calendar_connected,
    drive_connected: merged.drive_connected,
    updated_at: new Date().toISOString(),
  };
  const { error } = await admin.from("google_connections").upsert(payload, { onConflict: "user_id" });
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
  if (!response.ok) {
    const error = await googleErrorMessage(response);
    console.error("Google access token refresh failed", { userId: connection.user_id, error });
    return null;
  }
  const tokens = await response.json() as TokenResponse;
  const { error: updateError } = await getSupabaseAdmin().from("google_connections").update({
    access_token: tokens.access_token,
    token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  }).eq("user_id", connection.user_id);
  if (updateError) console.error("Unable to save refreshed Google access token", { userId: connection.user_id, error: updateError });
  return tokens.access_token;
}

export async function accessTokenForUser(userId: string) {
  const { data, error } = await getSupabaseAdmin().from("google_connections").select("user_id,access_token,refresh_token,token_expires_at,calendar_connected").eq("user_id", userId).maybeSingle();
  if (error) {
    console.error("Unable to load Google connection", { userId, error });
    return null;
  }
  if (!data?.calendar_connected) return null;
  if (data.token_expires_at && new Date(data.token_expires_at).getTime() > Date.now() + 60000) return data.access_token as string;
  return refreshAccessToken(data as { user_id: string; refresh_token: string | null });
}

export type GoogleCalendarSyncStatus = "synced" | "skipped" | "failed";

export type GoogleCalendarExternalEvent = {
  id: string;
  title: string;
  start: string;
  end: string | null;
  description: string | null;
  htmlLink: string | null;
};

export type GoogleCalendarSyncResult = {
  status: GoogleCalendarSyncStatus;
  taskId: string;
  message: string;
  eventId?: string | null;
};

export type GoogleCalendarBatchSyncResult = {
  attempted: number;
  synced: number;
  skipped: number;
  failed: number;
  errors: string[];
};

function syncResult(status: GoogleCalendarSyncStatus, taskId: string, message: string, eventId?: string | null): GoogleCalendarSyncResult {
  return { status, taskId, message, eventId };
}

const googleCalendarTaskColumns = [
  "tasks.google_calendar_event_id",
  "tasks.google_calendar_event_url",
  "tasks.google_calendar_synced_at",
  "tasks.google_calendar_user_id",
];

function isMissingGoogleCalendarTaskColumn(error: { message?: string; code?: string; details?: string | null } | null | undefined) {
  const haystack = `${error?.message ?? ""} ${error?.details ?? ""}`.toLowerCase();
  return error?.code === "42703" || googleCalendarTaskColumns.some((column) => haystack.includes(column) || haystack.includes(column.replace("tasks.", "")));
}

function missingGoogleCalendarTaskColumnsMessage() {
  return `Google Calendar task sync columns are missing from the database. Apply the latest Supabase migrations, including the forward-only Google Calendar repair migration, to ensure ${googleCalendarTaskColumns.join(", ")} exist.`;
}

export function summarizeGoogleCalendarSyncErrors(errors: string[]) {
  const uniqueErrors = Array.from(new Set(errors.filter(Boolean)));
  if (uniqueErrors.length === 0) return null;
  if (uniqueErrors.length === 1) return uniqueErrors[0];
  return `${uniqueErrors.length} unique errors: ${uniqueErrors.slice(0, 3).join(" | ")}${uniqueErrors.length > 3 ? " | …" : ""}`;
}

async function googleErrorMessage(response: Response) {
  const text = await response.text().catch(() => "");
  if (!text) return `${response.status} ${response.statusText}`.trim();
  try {
    const parsed = JSON.parse(text) as { error?: { message?: string }; error_description?: string };
    return parsed.error?.message ?? parsed.error_description ?? text;
  } catch {
    return text;
  }
}

async function deleteGoogleCalendarEvent(userId: string, eventId: string) {
  const accessToken = await accessTokenForUser(userId);
  if (!accessToken) return syncResult("failed", "unknown", `Cannot delete Google Calendar event ${eventId}: no valid Google Calendar token for user ${userId}.`, eventId);
  const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`, {
    method: "DELETE",
    headers: { authorization: `Bearer ${accessToken}` },
  });
  if (response.ok || response.status === 404 || response.status === 410) return syncResult("synced", "unknown", `Deleted Google Calendar event ${eventId}.`, eventId);
  const error = await googleErrorMessage(response);
  console.error("Google Calendar event delete failed", { userId, eventId, status: response.status, error });
  return syncResult("failed", "unknown", `Google Calendar delete failed for event ${eventId}: ${error}`, eventId);
}

export async function syncTaskToGoogleCalendar(taskId: string): Promise<GoogleCalendarSyncResult> {
  try {
    if (!hasGoogleConfig()) return syncResult("skipped", taskId, "Google OAuth is not configured.");
    const { data: task, error: taskError } = await getSupabaseAdmin()
      .from("tasks")
      .select("id,title,description,type,status,priority,due_date,duration_minutes,assigned_to,recurrence,recurrence_interval,recurrence_day_of_week,recurrence_day_of_month,recurrence_completion_required,recurrence_parent_task_id,google_calendar_event_id,google_calendar_user_id")
      .eq("id", taskId)
      .maybeSingle();
    if (taskError) {
      if (isMissingGoogleCalendarTaskColumn(taskError)) {
        const message = missingGoogleCalendarTaskColumnsMessage();
        console.error(message, { taskId, error: taskError });
        return syncResult("failed", taskId, message);
      }
      console.error("Unable to load task for Google Calendar sync", { taskId, error: taskError });
      return syncResult("failed", taskId, `Unable to load task: ${taskError.message}`);
    }
    if (!task) return syncResult("skipped", taskId, "Task was not found.");

    // Automatic recurring occurrences are represented in Google by their parent task's
    // RRULE series, so they must never be pushed as their own one-off events — doing so
    // makes every occurrence appear twice (once from the parent series, once from the
    // child). If a child still carries an event from older behavior, delete it so the
    // parent series stays the single source of truth.
    if (task.recurrence_parent_task_id && !task.recurrence_completion_required) {
      const childEventId = task.google_calendar_event_id as string | null;
      const childEventUserId = task.google_calendar_user_id as string | null;
      if (childEventId && childEventUserId) {
        await deleteGoogleCalendarEvent(childEventUserId, childEventId);
        await getSupabaseAdmin()
          .from("tasks")
          .update({ google_calendar_event_id: null, google_calendar_event_url: null, google_calendar_user_id: null, google_calendar_synced_at: null })
          .eq("id", taskId);
      }
      return syncResult("skipped", taskId, "Automatic recurring occurrence is covered by its parent's Google Calendar series.");
    }

    const existingEventId = task.google_calendar_event_id as string | null;
    const existingUserId = task.google_calendar_user_id as string | null;
    const assignedUserId = task.assigned_to as string | null;

    if (existingEventId && existingUserId && existingUserId !== assignedUserId) {
      const deleteResult = await deleteGoogleCalendarEvent(existingUserId, existingEventId);
      if (deleteResult.status === "failed") return syncResult("failed", taskId, deleteResult.message, existingEventId);
    }

    if (inactiveTaskStatuses.has(task.status as string) || !assignedUserId || !task.due_date) {
      if (existingEventId && existingUserId) {
        const deleteResult = await deleteGoogleCalendarEvent(existingUserId, existingEventId);
        if (deleteResult.status === "failed") return syncResult("failed", taskId, deleteResult.message, existingEventId);
      }
      const { error: clearError } = await getSupabaseAdmin()
        .from("tasks")
        .update({ google_calendar_event_id: null, google_calendar_event_url: null, google_calendar_user_id: null, google_calendar_synced_at: null })
        .eq("id", taskId);
      if (clearError) {
        if (isMissingGoogleCalendarTaskColumn(clearError)) {
          const message = missingGoogleCalendarTaskColumnsMessage();
          console.error(message, { taskId, error: clearError });
          return syncResult("failed", taskId, message);
        }
        console.error("Unable to clear Google Calendar task fields", { taskId, error: clearError });
        return syncResult("failed", taskId, `Unable to clear Google Calendar fields: ${clearError.message}`);
      }
      return syncResult("skipped", taskId, inactiveTaskStatuses.has(task.status as string) ? "Task is ended." : !assignedUserId ? "Task has no assignee." : "Task has no due date.");
    }

    const accessToken = await accessTokenForUser(assignedUserId);
    if (!accessToken) return syncResult("skipped", taskId, `Assigned user ${assignedUserId} has no connected Google Calendar account or valid refresh token.`);
    const { data: files, error: filesError } = await getSupabaseAdmin()
      .from("files")
      .select("filename,url")
      .eq("entity_type", "Task")
      .eq("entity_id", taskId);
    if (filesError) {
      console.error("Unable to load task files for Google Calendar sync", { taskId, error: filesError });
      return syncResult("failed", taskId, `Unable to load task links/files: ${filesError.message}`, existingEventId);
    }
    const body = taskGoogleCalendarPayload({ ...(task as typeof task & { due_date: string }), due_date: task.due_date as string }, files ?? []);
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
    if (!response.ok) {
      const error = await googleErrorMessage(response);
      console.error("Google Calendar event sync failed", { taskId, assignedUserId, eventId, status: response.status, error });
      return syncResult("failed", taskId, `Google Calendar API failed: ${error}`, eventId);
    }
    const event = await response.json() as { id?: string; htmlLink?: string };
    if (!event.id) return syncResult("failed", taskId, "Google Calendar API response did not include an event ID.");
    const { error: updateError } = await getSupabaseAdmin()
      .from("tasks")
      .update({
        google_calendar_event_id: event.id,
        google_calendar_event_url: event.htmlLink ?? null,
        google_calendar_user_id: assignedUserId,
        google_calendar_synced_at: new Date().toISOString(),
      })
      .eq("id", taskId);
    if (updateError) {
      if (isMissingGoogleCalendarTaskColumn(updateError)) {
        const message = missingGoogleCalendarTaskColumnsMessage();
        console.error(message, { taskId, eventId: event.id, error: updateError });
        return syncResult("failed", taskId, message, event.id);
      }
      console.error("Unable to save Google Calendar sync fields", { taskId, eventId: event.id, error: updateError });
      return syncResult("failed", taskId, `Unable to save Google Calendar fields: ${updateError.message}`, event.id);
    }
    return syncResult("synced", taskId, eventId ? "Updated Google Calendar event." : "Created Google Calendar event.", event.id);
  } catch (error) {
    console.error("Unexpected Google Calendar task sync failure", { taskId, error });
    return syncResult("failed", taskId, error instanceof Error ? error.message : "Unexpected Google Calendar sync failure.");
  }
}

export async function listGoogleCalendarEventsForUser(userId: string, rangeStart: Date, rangeEnd: Date): Promise<GoogleCalendarExternalEvent[]> {
  if (!hasGoogleConfig()) return [];
  const accessToken = await accessTokenForUser(userId);
  if (!accessToken) return [];

  const params = new URLSearchParams({
    singleEvents: "true",
    orderBy: "startTime",
    timeMin: rangeStart.toISOString(),
    timeMax: rangeEnd.toISOString(),
    maxResults: "250",
  });
  const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?${params.toString()}`, {
    headers: { authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  if (!response.ok) {
    const error = await googleErrorMessage(response);
    console.error("Unable to read Google Calendar events", { userId, status: response.status, error });
    return [];
  }

  const payload = await response.json() as {
    items?: {
      id?: string;
      summary?: string;
      description?: string;
      htmlLink?: string;
      start?: { dateTime?: string; date?: string };
      end?: { dateTime?: string; date?: string };
      status?: string;
      extendedProperties?: { private?: { rapidRiseTaskId?: string } };
    }[];
  };

  return (payload.items ?? [])
    .filter((event) => event.status !== "cancelled" && !event.extendedProperties?.private?.rapidRiseTaskId)
    .map((event) => {
      const start = event.start?.dateTime ?? (event.start?.date ? `${event.start.date}T00:00:00` : null);
      if (!event.id || !start) return null;
      return {
        id: event.id,
        title: event.summary?.trim() || "Google Calendar event",
        start,
        end: event.end?.dateTime ?? (event.end?.date ? `${event.end.date}T00:00:00` : null),
        description: event.description ?? null,
        htmlLink: event.htmlLink ?? null,
      };
    })
    .filter((event): event is GoogleCalendarExternalEvent => Boolean(event));
}

export async function syncAssignedTasksToGoogleCalendar(userId: string): Promise<GoogleCalendarBatchSyncResult> {
  const result: GoogleCalendarBatchSyncResult = { attempted: 0, synced: 0, skipped: 0, failed: 0, errors: [] };
  if (!hasGoogleConfig()) {
    result.skipped = 1;
    result.errors.push("Google OAuth is not configured.");
    return result;
  }

  // Every task assigned to this user syncs under this user's token. If Calendar
  // isn't actually connected (e.g. the account was only used for "Sign in with
  // Google", or a login downgraded the grant), each task would skip with no visible
  // reason. Detect it once up front and report an actionable message instead of a
  // silent "skipped N".
  if (!(await accessTokenForUser(userId))) {
    result.errors.push(
      'Google Calendar isn’t connected for your account. Open Settings and click “Connect Google” to grant calendar access, then sync again.',
    );
    return result;
  }

  const { data: tasks, error } = await getSupabaseAdmin()
    .from("tasks")
    .select("id,recurrence_parent_task_id,recurrence_completion_required")
    .eq("assigned_to", userId)
    .not("due_date", "is", null)
    .neq("status", "SCRAPPED");
  if (error) {
    console.error("Unable to load assigned tasks for Google Calendar sync", { userId, error });
    result.failed = 1;
    result.errors.push(`Unable to load assigned tasks: ${error.message}`);
    return result;
  }
  const skipReasons: string[] = [];
  for (const task of tasks ?? []) {
    if (task.recurrence_parent_task_id && !task.recurrence_completion_required) continue;
    result.attempted += 1;
    const taskResult = await syncTaskToGoogleCalendar(task.id as string);
    if (taskResult.status === "synced") result.synced += 1;
    if (taskResult.status === "skipped") {
      result.skipped += 1;
      skipReasons.push(taskResult.message);
    }
    if (taskResult.status === "failed") {
      result.failed += 1;
      result.errors.push(taskResult.message);
    }
  }
  // If nothing synced but tasks were skipped, surface the reasons so a silent
  // "skipped N" can never again hide a real problem.
  if (result.synced === 0 && result.skipped > 0) {
    result.errors.push(...skipReasons);
  }
  return result;
}
