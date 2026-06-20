"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  createSession,
  destroySession,
  requirePermission,
  requireUser,
} from "./auth";
import { buildOnceOffInvoiceItemsFromQuoteItems } from "./business-rules";
import { labelize, permissions } from "./constants";
import { getSupabaseAdmin } from "./supabase";
import { syncAssignedTasksToGoogleCalendar, syncTaskToGoogleCalendar } from "./google";
import {
  actionFormData,
  type ActionResult,
  withActionResult,
} from "./action-utils";
import {
  accountLoginSchema,
  affiliateSchema,
  bookEventSchema,
  campaignSchema,
  checklistItemSchema,
  checklistTemplateSchema,
  clientSchema,
  commissionSchema,
  companySettingsSchema,
  contentItemSchema,
  documentTemplateSchema,
  fileRecordSchema,
  expenseSchema,
  interactionEventSchema,
  linkedTaskSchema,
  invoiceSchema,
  knowledgeBaseSchema,
  leadCallSchema,
  leadSchema,
  noteSchema,
  paymentSchema,
  payrollItemSchema,
  payrollRunSchema,
  projectChecklistSchema,
  projectSchema,
  quoteSchema,
  referralSchema,
  retainerSchema,
  serviceSchema,
  supportTicketSchema,
  taskSchema,
  taskStatusSchema,
  uploadFileSchema,
  userSchema,
  vendorSchema,
} from "./validation";

function str(formData: FormData, key: string) {
  return String(formData.get(key) ?? "");
}

function bool(formData: FormData, key: string) {
  return formData.get(key) === "on" || formData.get(key) === "true";
}

function path(formData: FormData, fallback: string) {
  return str(formData, "redirectTo") || fallback;
}

function randsToCents(value: FormDataEntryValue | null) {
  return Math.round(Number(value ?? 0) * 100);
}

function positiveInt(value: FormDataEntryValue | null, fallback: number) {
  const parsed = Number(value ?? fallback);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.trunc(parsed) : fallback;
}

function parseQuoteLineItems(formData: FormData) {
  const descriptions = formData
    .getAll("itemDescription")
    .map((value) => String(value).trim());
  return descriptions
    .map((description, index) => ({
      service_id: String(formData.getAll("serviceId")[index] ?? "") || null,
      description,
      quantity: Math.max(
        1,
        positiveInt(formData.getAll("itemQuantity")[index] ?? null, 1),
      ),
      once_off_cents: positiveInt(
        formData.getAll("itemOnceOffCents")[index] ?? null,
        0,
      ),
      monthly_cents: positiveInt(
        formData.getAll("itemMonthlyCents")[index] ?? null,
        0,
      ),
      sort_order: index,
    }))
    .filter((item) => item.description);
}

function parseInvoiceLineItems(formData: FormData) {
  const descriptions = formData
    .getAll("invoiceItemDescription")
    .map((value) => String(value).trim());
  return descriptions
    .map((description, index) => ({
      description,
      quantity: Math.max(
        1,
        positiveInt(formData.getAll("invoiceItemQuantity")[index] ?? null, 1),
      ),
      unit_amount_cents: positiveInt(
        formData.getAll("invoiceItemUnitCents")[index] ?? null,
        0,
      ),
      sort_order: index,
    }))
    .filter((item) => item.description);
}

function nextRecurringDate(dateValue: string | null | undefined, recurrence: string) {
  const date = dateValue ? new Date(`${dateValue}T00:00:00.000Z`) : new Date();
  if (recurrence === "WEEKLY") date.setUTCDate(date.getUTCDate() + 7);
  if (recurrence === "MONTHLY") date.setUTCMonth(date.getUTCMonth() + 1);
  if (recurrence === "QUARTERLY") date.setUTCMonth(date.getUTCMonth() + 3);
  if (recurrence === "ANNUAL") date.setUTCFullYear(date.getUTCFullYear() + 1);
  return date.toISOString().slice(0, 10);
}

function parseTaskLinks(formData: FormData) {
  const urls = formData.getAll("taskLinkUrl").map((value) => String(value).trim());
  const labels = formData.getAll("taskLinkLabel").map((value) => String(value).trim());
  return urls
    .map((url, index) => ({ url, label: labels[index] || url }))
    .filter((link) => link.url);
}

function numberCode(prefix: string) {
  return `${prefix}-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
}

function trackingCode(name: string) {
  return `${
    name
      .replace(/[^a-z0-9]/gi, "")
      .slice(0, 6)
      .toUpperCase() || "RRAI"
  }-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

async function reserveSubmission(
  userId: string,
  formData: FormData,
  action: string,
) {
  const submissionKey = str(formData, "submissionKey");
  if (!submissionKey) return true;

  const { error } = await getSupabaseAdmin().from("form_submissions").insert({
    user_id: userId,
    submission_key: submissionKey,
    action,
  });

  if (!error) return true;
  if (error.code === "23505") return false;
  if (error.code === "42P01") return true;
  throw error;
}

async function logActivity(input: {
  action: string;
  entityType: string;
  entityId: string;
  message: string;
  actorId?: string;
  leadId?: string | null;
  clientId?: string | null;
  quoteId?: string | null;
  projectId?: string | null;
  taskId?: string | null;
}) {
  await getSupabaseAdmin()
    .from("activity_logs")
    .insert({
      action: input.action,
      entity_type: input.entityType,
      entity_id: input.entityId,
      message: input.message,
      actor_id: input.actorId ?? null,
      lead_id: input.leadId ?? null,
      client_id: input.clientId ?? null,
      quote_id: input.quoteId ?? null,
      project_id: input.projectId ?? null,
      task_id: input.taskId ?? null,
    });
}

async function attachOptionalFile(
  formData: FormData,
  target: {
    entityType: string;
    entityId: string;
    clientId?: string | null;
    leadId?: string | null;
    projectId?: string | null;
    knowledgeBaseItemId?: string | null;
    activityMessage?: string;
    actorId?: string;
  },
) {
  const uploadedFiles = formData.getAll("file").filter((file): file is File => file instanceof File && file.size > 0);
  const hasUpload = uploadedFiles.length > 0;
  const url = str(formData, "url");
  if (!hasUpload && !url) return;

  const supabase = getSupabaseAdmin();
  let filename = str(formData, "filename");
  let fileUrl = url;
  let mimeType = str(formData, "mimeType") || null;

  if (hasUpload) {
    const uploadedRecords = await Promise.all(
      uploadedFiles.map(async (file) => {
        const upload = uploadFileSchema.parse({
          filename:
            uploadedFiles.length === 1 && filename ? filename : file.name,
          mimeType: file.type,
          size: file.size,
          entityType: target.entityType,
          entityId: target.entityId,
          clientId: target.clientId ?? "",
          leadId: target.leadId ?? "",
          projectId: target.projectId ?? "",
          knowledgeBaseItemId: target.knowledgeBaseItemId ?? "",
        });
        const storagePath = `${upload.entityType.toLowerCase()}/${upload.entityId}/${crypto.randomUUID()}-${safeStorageName(upload.filename)}`;
        const { error: uploadError } = await supabase.storage
          .from(internalFilesBucket)
          .upload(storagePath, file, {
            contentType: upload.mimeType,
            upsert: false,
          });
        if (uploadError) throw uploadError;
        const { data: signed, error: signedError } = await supabase.storage
          .from(internalFilesBucket)
          .createSignedUrl(storagePath, 60 * 60 * 24 * 365 * 10);
        if (signedError) throw signedError;
        return {
          filename: upload.filename,
          url: signed.signedUrl,
          mimeType: upload.mimeType,
        };
      }),
    );
    const { error: filesError } = await supabase.from("files").insert(
      uploadedRecords.map((record) => ({
        filename: record.filename,
        url: record.url,
        mime_type: record.mimeType ?? null,
        entity_type: target.entityType,
        entity_id: target.entityId,
        client_id: target.clientId ?? null,
        lead_id: target.leadId ?? null,
        project_id: target.projectId ?? null,
        knowledge_base_item_id: target.knowledgeBaseItemId ?? null,
      })),
    );
    if (filesError) throw filesError;
    if (target.activityMessage || uploadedRecords.length) {
      await logActivity({
        action: "FILE_UPLOADED",
        entityType: target.entityType,
        entityId: target.entityId,
        clientId: target.clientId ?? null,
        leadId: target.leadId ?? null,
        projectId: target.projectId ?? null,
        actorId: target.actorId,
        message:
          uploadedRecords.length === 1
            ? (target.activityMessage ?? `${uploadedRecords[0].filename} uploaded`)
            : `${uploadedRecords.length} files uploaded`,
      });
    }
    return;

  } else {
    const parsed = fileRecordSchema.parse({
      filename:
        filename ||
        safeStorageName(
          new URL(url).pathname.split("/").pop() || "external-file",
        ),
      url,
      mimeType,
      entityType: target.entityType,
      entityId: target.entityId,
      clientId: target.clientId ?? "",
      leadId: target.leadId ?? "",
      projectId: target.projectId ?? "",
      knowledgeBaseItemId: target.knowledgeBaseItemId ?? "",
    });
    filename = parsed.filename;
    fileUrl = parsed.url;
    mimeType = parsed.mimeType ?? null;
  }

  const { error } = await supabase.from("files").insert({
    filename,
    url: fileUrl,
    mime_type: mimeType,
    entity_type: target.entityType,
    entity_id: target.entityId,
    client_id: target.clientId ?? null,
    lead_id: target.leadId ?? null,
    project_id: target.projectId ?? null,
    knowledge_base_item_id: target.knowledgeBaseItemId ?? null,
  });
  if (error) throw error;
  if (target.activityMessage && target.actorId)
    await logActivity({
      action: hasUpload ? "FILE_UPLOADED" : "FILE_LINK_ADDED",
      entityType: target.entityType,
      entityId: target.entityId,
      clientId: target.clientId,
      leadId: target.leadId,
      projectId: target.projectId,
      actorId: target.actorId,
      message: target.activityMessage,
    });
}

async function resolveDefaultChecklistTemplateId() {
  const supabase = getSupabaseAdmin();
  const { data: generalTemplate } = await supabase
    .from("checklist_templates")
    .select("id")
    .eq("is_active", true)
    .is("service_id", null)
    .order("name")
    .limit(1)
    .maybeSingle();
  if (generalTemplate?.id) return generalTemplate.id as string;

  const { data: activeTemplate } = await supabase
    .from("checklist_templates")
    .select("id")
    .eq("is_active", true)
    .order("name")
    .limit(1)
    .maybeSingle();
  return activeTemplate?.id as string | undefined;
}

async function resolveChecklistTemplateIdForQuote(quoteId?: string | null) {
  if (!quoteId) return undefined;

  const supabase = getSupabaseAdmin();
  const { data: quoteItems } = await supabase
    .from("quote_items")
    .select("service_id")
    .eq("quote_id", quoteId)
    .not("service_id", "is", null)
    .order("sort_order")
    .limit(1);
  const serviceId = quoteItems?.[0]?.service_id as string | null | undefined;
  if (!serviceId) return undefined;

  const { data: template } = await supabase
    .from("checklist_templates")
    .select("id")
    .eq("service_id", serviceId)
    .eq("is_active", true)
    .order("name")
    .limit(1)
    .maybeSingle();
  return template?.id as string | undefined;
}

async function seedProjectChecklist(
  projectId: string,
  templateId?: string,
  options: { replaceExisting?: boolean } = {},
) {
  const supabase = getSupabaseAdmin();
  if (options.replaceExisting)
    await supabase
      .from("project_checklists")
      .delete()
      .eq("project_id", projectId);
  const selectedTemplateId =
    templateId || (await resolveDefaultChecklistTemplateId());
  let query = supabase
    .from("checklist_items")
    .select("id,title")
    .order("sort_order")
    .limit(12);
  if (selectedTemplateId) query = query.eq("template_id", selectedTemplateId);

  const { data: templateItems } = await query;
  const rows = (
    templateItems?.length
      ? templateItems
      : [
          { id: null, title: "Confirm project scope and success criteria" },
          {
            id: null,
            title: "Collect client content, access and brand assets",
          },
          { id: null, title: "Complete build and internal QA" },
          { id: null, title: "Client review, revisions and launch handover" },
        ]
  ).map((item) => ({
    project_id: projectId,
    template_item_id: item.id,
    title: item.title,
    status: "TO_DO",
  }));
  await supabase.from("project_checklists").insert(rows);
}

async function insertInvoiceRecord(
  payload: Record<string, string | number | null>,
) {
  const supabase = getSupabaseAdmin();
  const result = await supabase
    .from("invoices")
    .insert(payload)
    .select("id,invoice_number,client_id")
    .single();
  if (
    !result.error ||
    result.error.code !== "42703" ||
    !("quote_id" in payload)
  )
    return result;

  const fallbackPayload = { ...payload };
  delete fallbackPayload.quote_id;
  return supabase
    .from("invoices")
    .insert(fallbackPayload)
    .select("id,invoice_number,client_id")
    .single();
}

type ConvertLeadResult = { client_id: string };
type AcceptQuoteResult = {
  client_id: string;
  project_id: string;
  invoice_id: string | null;
  retainer_id: string | null;
};

function workflowError(error: unknown, workflowName: string) {
  const message = error instanceof Error ? error.message : String(error);
  return new Error(
    `${workflowName} failed and all workflow changes were rolled back: ${message}`,
  );
}

export async function loginAction(
  _previousState: { error?: string; success?: boolean } | null,
  formData: FormData,
) {
  const email = str(formData, "email").trim().toLowerCase();
  const password = str(formData, "password");
  const supabase = getSupabaseAdmin();
  const { data: user, error } = await supabase
    .from("users")
    .select("id,email,password_hash,status")
    .eq("email", email)
    .maybeSingle();

  if (error || !user || user.status !== "ACTIVE")
    return { error: "Invalid login details." };
  const ok = await bcrypt.compare(password, user.password_hash as string);
  if (!ok) return { error: "Invalid login details." };

  await supabase
    .from("users")
    .update({ last_login_at: new Date().toISOString() })
    .eq("id", user.id as string);
  await createSession(user.id as string);
  return { success: true };
}

export async function logoutAction() {
  await destroySession();
  redirect("/login");
}

export async function updateOwnLoginDetails(formData: FormData) {
  const user = await requireUser();
  const parsed = accountLoginSchema.parse({
    name: str(formData, "name"),
    email: str(formData, "email").toLowerCase(),
    currentPassword: str(formData, "currentPassword"),
    newPassword: str(formData, "newPassword"),
  });
  const { data: existing, error } = await getSupabaseAdmin()
    .from("users")
    .select("password_hash")
    .eq("id", user.id)
    .single();
  if (error || !existing?.password_hash)
    throw new Error("Unable to verify login details.");
  const ok = await bcrypt.compare(
    parsed.currentPassword,
    existing.password_hash as string,
  );
  if (!ok) throw new Error("Current password is incorrect.");
  const payload: Record<string, string> = {
    name: parsed.name,
    email: parsed.email,
  };
  if (parsed.newPassword)
    payload.password_hash = await bcrypt.hash(parsed.newPassword, 12);
  const { error: updateError } = await getSupabaseAdmin()
    .from("users")
    .update(payload)
    .eq("id", user.id);
  if (updateError) throw updateError;
  revalidatePath("/settings");
  redirect("/settings");
}

export async function upsertLead(
  previousState: ActionResult | null,
  submittedFormData?: FormData,
) {
  const formData = actionFormData(previousState, submittedFormData);
  return withActionResult(async () => {
    const user = await requirePermission(permissions.leadsWrite);
    const id = str(formData, "id") || undefined;
    if (!id && !(await reserveSubmission(user.id, formData, "lead:create")))
      redirect("/leads");
    const parsed = leadSchema.parse({
      companyName: str(formData, "companyName"),
      contactName: str(formData, "contactName"),
      email: str(formData, "email"),
      phone: str(formData, "phone"),
      source: str(formData, "source"),
      serviceInterest: str(formData, "serviceInterest"),
      stage: str(formData, "stage"),
      score: formData.get("score"),
      followUpDate: str(formData, "followUpDate"),
      nextAction: str(formData, "nextAction"),
      painPoints: str(formData, "painPoints"),
      assignedToId: str(formData, "assignedToId"),
    });
    const payload = {
      company_name: parsed.companyName,
      contact_name: parsed.contactName,
      email: parsed.email ?? null,
      phone: parsed.phone ?? null,
      source: parsed.source,
      service_interest: parsed.serviceInterest,
      stage: parsed.stage,
      score: parsed.score,
      follow_up_date: parsed.followUpDate?.toISOString() ?? null,
      next_action: parsed.nextAction ?? null,
      pain_points: parsed.painPoints ?? null,
      assigned_to: parsed.assignedToId ?? null,
      ...(id ? {} : { created_by: user.id }),
    };
    const result = id
      ? await getSupabaseAdmin()
          .from("leads")
          .update(payload)
          .eq("id", id)
          .select("id,company_name")
          .single()
      : await getSupabaseAdmin()
          .from("leads")
          .insert(payload)
          .select("id,company_name")
          .single();
    if (result.error) throw result.error;
    await logActivity({
      action: id ? "LEAD_UPDATED" : "LEAD_CREATED",
      entityType: "Lead",
      entityId: result.data.id,
      leadId: result.data.id,
      actorId: user.id,
      message: `${result.data.company_name} ${id ? "updated" : "created"}`,
    });
    revalidatePath("/leads");
    revalidatePath("/dashboard");
    redirect(`/leads/${result.data.id}`);
  });
}

export async function archiveLead(formData: FormData) {
  const user = await requirePermission(permissions.leadsWrite);
  const id = str(formData, "id");
  const { data, error } = await getSupabaseAdmin()
    .from("leads")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", id)
    .select("id,company_name")
    .single();
  if (error) throw error;
  await logActivity({
    action: "LEAD_ARCHIVED",
    entityType: "Lead",
    entityId: id,
    leadId: id,
    actorId: user.id,
    message: `${data.company_name} archived`,
  });
  revalidatePath("/leads");
  redirect("/leads");
}

export async function convertLeadToClient(formData: FormData) {
  const user = await requirePermission(permissions.clientsWrite);
  if (!(await reserveSubmission(user.id, formData, "lead:convert")))
    redirect("/clients");
  const leadId = str(formData, "leadId");
  const { data, error } = await getSupabaseAdmin()
    .rpc("convert_lead_to_client_atomic", {
      p_lead_id: leadId,
      p_actor_id: user.id,
    })
    .single<ConvertLeadResult>();
  if (error || !data?.client_id)
    throw workflowError(
      error ?? new Error("No client id returned."),
      "Lead conversion",
    );
  revalidatePath("/leads");
  revalidatePath("/clients");
  redirect(`/clients/${data.client_id}`);
}

export async function upsertClient(
  previousState: ActionResult | null,
  submittedFormData?: FormData,
) {
  const formData = actionFormData(previousState, submittedFormData);
  return withActionResult(async () => {
    const user = await requirePermission(permissions.clientsWrite);
    const id = str(formData, "id") || undefined;
    if (!id && !(await reserveSubmission(user.id, formData, "client:create")))
      redirect("/clients");
    const parsed = clientSchema.parse({
      companyName: str(formData, "companyName"),
      accountStatus: str(formData, "accountStatus"),
      industry: str(formData, "industry"),
      website: str(formData, "website"),
      primaryEmail: str(formData, "primaryEmail"),
      primaryPhone: str(formData, "primaryPhone"),
      nextAction: str(formData, "nextAction"),
      mrrCents: randsToCents(formData.get("mrrRands")),
    });
    const payload = {
      company_name: parsed.companyName,
      account_status: parsed.accountStatus,
      industry: parsed.industry ?? null,
      website: parsed.website ?? null,
      primary_email: parsed.primaryEmail ?? null,
      primary_phone: parsed.primaryPhone ?? null,
      next_action: parsed.nextAction ?? null,
      mrr_cents: parsed.mrrCents,
    };
    const result = id
      ? await getSupabaseAdmin()
          .from("clients")
          .update(payload)
          .eq("id", id)
          .select("id,company_name")
          .single()
      : await getSupabaseAdmin()
          .from("clients")
          .insert(payload)
          .select("id,company_name")
          .single();
    if (result.error) throw result.error;
    await logActivity({
      action: id ? "CLIENT_UPDATED" : "CLIENT_CREATED",
      entityType: "Client",
      entityId: result.data.id,
      clientId: result.data.id,
      actorId: user.id,
      message: `${result.data.company_name} ${id ? "updated" : "created"}`,
    });
    revalidatePath("/clients");
    redirect(`/clients/${result.data.id}`);
  });
}

function clampDayOfMonth(year: number, month: number, day: number) {
  return Math.min(day, new Date(Date.UTC(year, month + 1, 0)).getUTCDate());
}

function nextRecurringDueDate({
  baseDate,
  recurrence,
  interval,
  dayOfWeek,
  dayOfMonth,
}: {
  baseDate?: Date;
  recurrence: "NONE" | "WEEKLY" | "MONTHLY";
  interval: number;
  dayOfWeek?: number | null;
  dayOfMonth?: number | null;
}) {
  if (recurrence === "NONE") return null;
  const base = baseDate ? new Date(baseDate) : new Date();
  if (recurrence === "WEEKLY") {
    const targetDay = dayOfWeek ?? base.getUTCDay();
    const candidate = new Date(base);
    const daysAhead = (targetDay - candidate.getUTCDay() + 7) % 7 || interval * 7;
    candidate.setUTCDate(candidate.getUTCDate() + daysAhead);
    return candidate;
  }
  const targetDay = dayOfMonth ?? base.getUTCDate();
  const candidate = new Date(base);
  candidate.setUTCMonth(candidate.getUTCMonth() + interval, 1);
  candidate.setUTCDate(clampDayOfMonth(candidate.getUTCFullYear(), candidate.getUTCMonth(), targetDay));
  return candidate;
}

export async function upsertTask(formData: FormData) {
  const user = await requirePermission(permissions.tasksWrite);
  const id = str(formData, "id") || undefined;
  if (!id && !(await reserveSubmission(user.id, formData, "task:create")))
    redirect(path(formData, "/tasks"));
  const parsed = taskSchema.parse({
    title: str(formData, "title"),
    description: str(formData, "description"),
    type: str(formData, "type"),
    status: str(formData, "status"),
    priority: str(formData, "priority"),
    dueDate: str(formData, "dueDate"),
    clientId: str(formData, "clientId"),
    projectId: str(formData, "projectId"),
    assignedToId: str(formData, "assignedToId"),
    recurrence: str(formData, "recurrence") || "NONE",
    recurrenceInterval: str(formData, "recurrenceInterval") || "1",
    recurrenceDayOfWeek: str(formData, "recurrenceDayOfWeek") || undefined,
    recurrenceDayOfMonth: str(formData, "recurrenceDayOfMonth") || undefined,
  });
  const instructions = str(formData, "instructions").trim();
  const expectedOutcome = str(formData, "expectedOutcome").trim();
  const scheduledAt = str(formData, "scheduledAt").trim();
  const taskLinks = parseTaskLinks(formData);
  const recurrenceNextDueAt = nextRecurringDueDate({
    baseDate: parsed.dueDate,
    recurrence: parsed.recurrence,
    interval: parsed.recurrenceInterval,
    dayOfWeek: parsed.recurrenceDayOfWeek,
    dayOfMonth: parsed.recurrenceDayOfMonth,
  });
  const taskDueDate = parsed.dueDate ?? recurrenceNextDueAt;
  const descriptionParts = [
    parsed.description,
    instructions ? `Instructions:\n${instructions}` : null,
    expectedOutcome ? `Expected outcome:\n${expectedOutcome}` : null,
    scheduledAt ? `Scheduled date/time: ${scheduledAt}` : null,
  ].filter(Boolean);
  const payload = {
    title: parsed.title,
    description: descriptionParts.join("\n\n") || null,
    type: parsed.type,
    status: parsed.status,
    priority: parsed.priority,
    due_date: taskDueDate?.toISOString() ?? null,
    recurrence: parsed.recurrence,
    recurrence_interval: parsed.recurrence === "NONE" ? 1 : parsed.recurrenceInterval,
    recurrence_day_of_week: parsed.recurrence === "WEEKLY" ? parsed.recurrenceDayOfWeek ?? taskDueDate?.getUTCDay() ?? null : null,
    recurrence_day_of_month: parsed.recurrence === "MONTHLY" ? parsed.recurrenceDayOfMonth ?? taskDueDate?.getUTCDate() ?? null : null,
    recurrence_next_due_at: parsed.recurrence === "NONE" ? null : recurrenceNextDueAt?.toISOString() ?? null,
    client_id: parsed.clientId ?? null,
    project_id: parsed.projectId ?? null,
    assigned_to: parsed.assignedToId ?? null,
    completed_at: parsed.status === "DONE" ? new Date().toISOString() : null,
    ...(id ? {} : { created_by: user.id }),
  };
  const result = id
    ? await getSupabaseAdmin()
        .from("tasks")
        .update(payload)
        .eq("id", id)
        .select("id,title")
        .single()
    : await getSupabaseAdmin()
        .from("tasks")
        .insert(payload)
        .select("id,title")
        .single();
  if (result.error) throw result.error;
  await attachOptionalFile(formData, {
    entityType: "Task",
    entityId: result.data.id,
    clientId: parsed.clientId,
    projectId: parsed.projectId,
    actorId: user.id,
    activityMessage: `File attached to task ${result.data.title}`,
  });
  if (taskLinks.length) {
    const { error: linkError } = await getSupabaseAdmin().from("files").insert(
      taskLinks.map((link) => ({
        filename: link.label,
        url: link.url,
        mime_type: "text/uri-list",
        entity_type: "Task",
        entity_id: result.data.id,
        client_id: parsed.clientId ?? null,
        project_id: parsed.projectId ?? null,
      })),
    );
    if (linkError) throw linkError;
  }
  await syncTaskToGoogleCalendar(result.data.id);
  await logActivity({
    action:
      parsed.status === "DONE"
        ? "TASK_COMPLETED"
        : id
          ? "TASK_UPDATED"
          : "TASK_CREATED",
    entityType: "Task",
    entityId: result.data.id,
    taskId: result.data.id,
    clientId: parsed.clientId,
    projectId: parsed.projectId,
    actorId: user.id,
    message: `${result.data.title} ${id ? "updated" : "created"}`,
  });
  revalidatePath("/tasks");
  redirect(path(formData, "/tasks"));
}

export async function syncMyGoogleCalendar() {
  const user = await requireUser();
  const result = await syncAssignedTasksToGoogleCalendar(user.id);
  revalidatePath("/settings");
  revalidatePath("/calendar");
  revalidatePath("/tasks");
  const params = new URLSearchParams({
    googleSync: result.failed > 0 ? "failed" : "success",
    attempted: String(result.attempted),
    synced: String(result.synced),
    skipped: String(result.skipped),
    failed: String(result.failed),
  });
  if (result.errors[0]) params.set("message", result.errors[0]);
  redirect(`/settings?${params.toString()}`);
}

export async function upsertUser(
  previousState: ActionResult | null,
  submittedFormData?: FormData,
) {
  const formData = actionFormData(previousState, submittedFormData);
  return withActionResult(async () => {
    const user = await requirePermission(permissions.settingsManage);
    if (!(await reserveSubmission(user.id, formData, "user:create")))
      redirect("/settings");
    const parsed = userSchema.parse({
      name: str(formData, "name"),
      email: str(formData, "email").toLowerCase(),
      password: str(formData, "password"),
      roleId: str(formData, "roleId"),
      title: str(formData, "title"),
      phone: str(formData, "phone"),
      status: str(formData, "status"),
      employmentType: str(formData, "employmentType") || "FULL_TIME",
      department: str(formData, "department"),
      specialties: str(formData, "specialties"),
      payType: str(formData, "payType") || "SALARY",
      payRateCents: randsToCents(formData.get("payRateRands")),
      startDate: str(formData, "startDate"),
      emergencyContact: str(formData, "emergencyContact"),
      employeeNotes: str(formData, "employeeNotes"),
    });
    const id = str(formData, "id") || undefined;
    if (!id && !parsed.password)
      throw new Error("Password is required for new users.");
    const payload = {
      name: parsed.name,
      email: parsed.email,
      role_id: parsed.roleId,
      title: parsed.title ?? null,
      phone: parsed.phone ?? null,
      status: parsed.status,
      employment_type: parsed.employmentType,
      department: parsed.department ?? null,
      specialties: parsed.specialties ?? null,
      pay_type: parsed.payType,
      pay_rate_cents: parsed.payRateCents,
      start_date: parsed.startDate?.toISOString().slice(0, 10) ?? null,
      emergency_contact: parsed.emergencyContact ?? null,
      employee_notes: parsed.employeeNotes ?? null,
      ...(parsed.password ? { password_hash: await bcrypt.hash(parsed.password, 12) } : {}),
    };
    const { data: savedUser, error } = id
      ? await getSupabaseAdmin()
          .from("users")
          .update(payload)
          .eq("id", id)
          .select("id,name,pay_rate_cents,start_date")
          .single()
      : await getSupabaseAdmin()
          .from("users")
          .insert(payload)
          .select("id,name,pay_rate_cents,start_date")
          .single();
    if (error) throw error;
    if (savedUser.pay_rate_cents > 0) {
      const expenseDate = savedUser.start_date ?? new Date().toISOString().slice(0, 10);
      const payrollExpense = {
        vendor: savedUser.name,
        category: "Payroll",
        expense_type: "PAYROLL",
        amount_cents: savedUser.pay_rate_cents,
        status: "PENDING",
        expense_date: expenseDate,
        recurrence: parsed.payType === "HOURLY" ? "NONE" : "MONTHLY",
        next_due_date: parsed.payType === "HOURLY" ? null : expenseDate,
        notes: `${labelize(parsed.payType)} employee pay`,
        created_by: user.id,
      };
      const { data: existingPayrollExpense, error: payrollFindError } = await getSupabaseAdmin()
        .from("expenses")
        .select("id")
        .eq("expense_type", "PAYROLL")
        .eq("vendor", savedUser.name)
        .maybeSingle();
      if (payrollFindError) throw payrollFindError;
      const { error: payrollExpenseError } = existingPayrollExpense
        ? await getSupabaseAdmin().from("expenses").update(payrollExpense).eq("id", existingPayrollExpense.id)
        : await getSupabaseAdmin().from("expenses").insert(payrollExpense);
      if (payrollExpenseError) throw payrollExpenseError;
    }
    revalidatePath("/settings");
    revalidatePath("/payroll");
    revalidatePath("/billing");
    redirect("/settings");
  });
}

export async function upsertQuote(
  previousState: ActionResult | null,
  submittedFormData?: FormData,
) {
  const formData = actionFormData(previousState, submittedFormData);
  return withActionResult(async () => {
    const user = await requirePermission(permissions.quotesWrite);
    const id = str(formData, "id") || undefined;
    if (!id && !(await reserveSubmission(user.id, formData, "quote:create")))
      redirect("/quotes");
    const lineItems = parseQuoteLineItems(formData);
    if (!lineItems.length) throw new Error("Add at least one quote line item.");
    const parsed = quoteSchema.parse({
      title: str(formData, "title"),
      status: str(formData, "status"),
      clientId: str(formData, "clientId"),
      leadId: str(formData, "leadId"),
      validUntil: str(formData, "validUntil"),
      internalNotes: str(formData, "internalNotes"),
      itemDescription: lineItems[0].description,
      itemQuantity: lineItems[0].quantity,
      itemOnceOffCents: lineItems[0].once_off_cents,
      itemMonthlyCents: lineItems[0].monthly_cents,
      serviceId: lineItems[0].service_id ?? "",
    });
    const onceOff = lineItems.reduce(
      (sum, item) => sum + item.quantity * item.once_off_cents,
      0,
    );
    const monthly = lineItems.reduce(
      (sum, item) => sum + item.quantity * item.monthly_cents,
      0,
    );
    const quotePayload = {
      title: parsed.title,
      status: parsed.status,
      client_id: parsed.clientId ?? null,
      lead_id: parsed.leadId ?? null,
      valid_until: parsed.validUntil?.toISOString() ?? null,
      internal_notes: parsed.internalNotes ?? null,
      once_off_total_cents: onceOff,
      monthly_total_cents: monthly,
      ...(parsed.status === "SENT"
        ? { sent_at: new Date().toISOString() }
        : {}),
      ...(parsed.status === "ACCEPTED"
        ? { accepted_at: new Date().toISOString() }
        : {}),
    };
    const supabase = getSupabaseAdmin();
    const result = id
      ? await supabase
          .from("quotes")
          .update(quotePayload)
          .eq("id", id)
          .select("id,title,client_id,lead_id")
          .single()
      : await supabase
          .from("quotes")
          .insert({ ...quotePayload, quote_number: numberCode("Q") })
          .select("id,title,client_id,lead_id")
          .single();
    if (result.error) throw result.error;
    await supabase.from("quote_items").delete().eq("quote_id", result.data.id);
    const { error: lineItemsError } = await supabase
      .from("quote_items")
      .insert(lineItems.map((item) => ({ ...item, quote_id: result.data.id })));
    if (lineItemsError) throw lineItemsError;
    await logActivity({
      action: id ? "QUOTE_UPDATED" : "QUOTE_CREATED",
      entityType: "Quote",
      entityId: result.data.id,
      quoteId: result.data.id,
      clientId: result.data.client_id,
      leadId: result.data.lead_id,
      actorId: user.id,
      message: `${result.data.title} ${id ? "updated" : "created"}`,
    });
    revalidatePath("/quotes");
    redirect("/quotes");
  });
}

export async function acceptQuote(formData: FormData) {
  const user = await requirePermission(permissions.quotesWrite);
  if (!(await reserveSubmission(user.id, formData, "quote:accept")))
    redirect("/quotes");
  const id = str(formData, "id");
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .rpc("accept_quote_atomic", {
      p_quote_id: id,
      p_actor_id: user.id,
      p_invoice_number: numberCode("INV"),
    })
    .single<AcceptQuoteResult>();
  if (error || !data?.project_id)
    throw workflowError(
      error ?? new Error("No project id returned."),
      "Quote acceptance",
    );

  if (data.invoice_id) {
    const { data: quote, error: quoteError } = await supabase
      .from("quotes")
      .select("once_off_total_cents")
      .eq("id", id)
      .single();
    if (quoteError) throw workflowError(quoteError, "Quote acceptance");

    const { data: quoteItems, error: quoteItemsError } = await supabase
      .from("quote_items")
      .select("description,quantity,once_off_cents,sort_order")
      .eq("quote_id", id)
      .order("sort_order");
    if (quoteItemsError)
      throw workflowError(quoteItemsError, "Quote acceptance");

    const invoiceItems = buildOnceOffInvoiceItemsFromQuoteItems(
      quoteItems ?? [],
      quote.once_off_total_cents as number,
    ).map((item) => ({ ...item, invoice_id: data.invoice_id }));

    if (invoiceItems.length) {
      const { error: invoiceItemsError } = await supabase
        .from("invoice_items")
        .insert(invoiceItems);
      if (invoiceItemsError)
        throw workflowError(invoiceItemsError, "Quote acceptance");
    }
  }

  const quoteTemplateId = await resolveChecklistTemplateIdForQuote(id);
  if (quoteTemplateId)
    await seedProjectChecklist(data.project_id, quoteTemplateId, {
      replaceExisting: true,
    });
  revalidatePath("/quotes");
  revalidatePath("/projects");
  revalidatePath("/billing");
  revalidatePath("/retainers");
  revalidatePath("/clients");
  redirect(`/projects/${data.project_id}`);
}

export async function upsertProject(formData: FormData) {
  const user = await requirePermission(permissions.projectsWrite);
  const id = str(formData, "id") || undefined;
  if (!id && !(await reserveSubmission(user.id, formData, "project:create")))
    redirect("/projects");
  const parsed = projectSchema.parse({
    name: str(formData, "name"),
    clientId: str(formData, "clientId"),
    quoteId: str(formData, "quoteId"),
    status: str(formData, "status"),
    stage: str(formData, "stage"),
    priority: str(formData, "priority"),
    deadline: str(formData, "deadline"),
    progress: formData.get("progress"),
    blocker: str(formData, "blocker"),
    seedChecklist: bool(formData, "seedChecklist"),
    checklistTemplateId: str(formData, "checklistTemplateId"),
    assignedToId: str(formData, "assignedToId"),
  });
  const payload = {
    name: parsed.name,
    client_id: parsed.clientId,
    quote_id: parsed.quoteId ?? null,
    status: parsed.status,
    stage: parsed.stage ?? null,
    priority: parsed.priority,
    deadline: parsed.deadline?.toISOString() ?? null,
    progress: parsed.progress,
    blocker: parsed.blocker ?? null,
    assigned_to: parsed.assignedToId ?? null,
  };
  const previousProject = id
    ? await getSupabaseAdmin()
        .from("projects")
        .select("assigned_to")
        .eq("id", id)
        .maybeSingle()
    : null;
  const result = id
    ? await getSupabaseAdmin()
        .from("projects")
        .update(payload)
        .eq("id", id)
        .select("id,name,client_id")
        .single()
    : await getSupabaseAdmin()
        .from("projects")
        .insert(payload)
        .select("id,name,client_id")
        .single();
  if (result.error) throw result.error;
  if (!id && parsed.seedChecklist)
    await seedProjectChecklist(
      result.data.id,
      parsed.checklistTemplateId ??
        (await resolveChecklistTemplateIdForQuote(parsed.quoteId)),
    );
  const assignmentChanged =
    parsed.assignedToId &&
    (!id || previousProject?.data?.assigned_to !== parsed.assignedToId);
  if (assignmentChanged)
    await getSupabaseAdmin()
      .from("tasks")
      .insert({
        title: `Project assignment: ${result.data.name}`,
        description: `You are assigned to own project ${result.data.name}.`,
        type: "ADMIN_TASK",
        status: "TO_DO",
        priority: parsed.priority,
        due_date: parsed.deadline?.toISOString() ?? null,
        client_id: result.data.client_id,
        project_id: result.data.id,
        assigned_to: parsed.assignedToId,
        created_by: user.id,
      });
  await logActivity({
    action: id ? "PROJECT_UPDATED" : "PROJECT_CREATED",
    entityType: "Project",
    entityId: result.data.id,
    projectId: result.data.id,
    clientId: result.data.client_id,
    actorId: user.id,
    message: `${result.data.name} ${id ? "updated" : "created"}`,
  });
  revalidatePath("/projects");
  redirect(`/projects/${result.data.id}`);
}

export async function updateProjectChecklist(formData: FormData) {
  const user = await requirePermission(permissions.projectsWrite);
  if (!(await reserveSubmission(user.id, formData, "project-checklist:update")))
    return;
  const parsed = projectChecklistSchema.parse({
    id: str(formData, "id"),
    status: str(formData, "status"),
  });
  await getSupabaseAdmin()
    .from("project_checklists")
    .update({
      status: parsed.status,
      completed_at: parsed.status === "DONE" ? new Date().toISOString() : null,
    })
    .eq("id", parsed.id);
  revalidatePath(path(formData, "/projects"));
}

export async function upsertInvoice(
  previousState: ActionResult | null,
  submittedFormData?: FormData,
) {
  const formData = actionFormData(previousState, submittedFormData);
  return withActionResult(async () => {
    const user = await requirePermission(permissions.billingWrite);
    if (!(await reserveSubmission(user.id, formData, "invoice:create")))
      redirect("/billing");
    const lineItems = parseInvoiceLineItems(formData);
    if (!lineItems.length)
      throw new Error("Add at least one invoice line item.");
    const amountCents = lineItems.reduce(
      (sum, item) => sum + item.quantity * item.unit_amount_cents,
      0,
    );
    const parsed = invoiceSchema.parse({
      invoiceNumber: str(formData, "invoiceNumber"),
      clientId: str(formData, "clientId"),
      quoteId: str(formData, "quoteId"),
      status: str(formData, "status"),
      amountCents,
      dueDate: str(formData, "dueDate"),
    });
    const { data, error } = await insertInvoiceRecord({
      invoice_number: parsed.invoiceNumber ?? numberCode("INV"),
      client_id: parsed.clientId,
      quote_id: parsed.quoteId ?? null,
      status: parsed.status,
      amount_cents: parsed.amountCents,
      due_date: parsed.dueDate?.toISOString() ?? null,
      issued_at: new Date().toISOString(),
    });
    if (error) throw error;
    const { error: itemError } = await getSupabaseAdmin()
      .from("invoice_items")
      .insert(lineItems.map((item) => ({ ...item, invoice_id: data.id })));
    if (itemError && itemError.code !== "42P01") throw itemError;
    await logActivity({
      action: "INVOICE_CREATED",
      entityType: "Invoice",
      entityId: data.id,
      clientId: data.client_id,
      actorId: user.id,
      message: `${data.invoice_number} created with ${lineItems.length} line item${lineItems.length === 1 ? "" : "s"}`,
    });
    revalidatePath("/billing");
    redirect("/billing");
  });
}

export async function recordPayment(formData: FormData) {
  const user = await requirePermission(permissions.billingWrite);
  if (!(await reserveSubmission(user.id, formData, "payment:create")))
    redirect("/billing");
  const parsed = paymentSchema.parse({
    invoiceId: str(formData, "invoiceId"),
    amountCents: randsToCents(formData.get("amountRands")),
    status: str(formData, "status"),
    method: str(formData, "method"),
    reference: str(formData, "reference"),
  });
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("payments")
    .insert({
      invoice_id: parsed.invoiceId,
      amount_cents: parsed.amountCents,
      status: parsed.status,
      method: parsed.method ?? null,
      reference: parsed.reference ?? null,
      paid_at: parsed.status === "PAID" ? new Date().toISOString() : null,
    })
    .select("id,invoice_id")
    .single();
  if (error) throw error;
  if (parsed.status === "PAID")
    await supabase
      .from("invoices")
      .update({ status: "PAID" })
      .eq("id", parsed.invoiceId);
  await logActivity({
    action: "PAYMENT_RECORDED",
    entityType: "Payment",
    entityId: data.id,
    actorId: user.id,
    message: `Payment recorded for invoice ${data.invoice_id}`,
  });
  revalidatePath("/billing");
  redirect("/billing");
}

export async function upsertVendor(formData: FormData) {
  const user = await requirePermission(permissions.billingWrite);
  if (!(await reserveSubmission(user.id, formData, "vendor:create")))
    redirect("/billing?tab=vendors");
  const parsed = vendorSchema.parse({
    name: str(formData, "name"),
    category: str(formData, "category"),
    contactName: str(formData, "contactName"),
    email: str(formData, "email"),
    phone: str(formData, "phone"),
    website: str(formData, "website"),
    notes: str(formData, "notes"),
  });
  const { data, error } = await getSupabaseAdmin()
    .from("vendors")
    .insert({
      name: parsed.name,
      category: parsed.category ?? null,
      contact_name: parsed.contactName ?? null,
      email: parsed.email ?? null,
      phone: parsed.phone ?? null,
      website: parsed.website ?? null,
      notes: parsed.notes ?? null,
    })
    .select("id,name")
    .single();
  if (error) throw error;
  await logActivity({
    action: "VENDOR_CREATED",
    entityType: "Vendor",
    entityId: data.id,
    actorId: user.id,
    message: `${data.name} vendor created`,
  });
  revalidatePath("/billing");
  redirect("/billing?tab=vendors");
}

async function ensureVendor(name: string, category?: string | null) {
  const cleanName = name.trim();
  if (!cleanName) return;
  const { data: existing, error: findError } = await getSupabaseAdmin()
    .from("vendors")
    .select("id")
    .ilike("name", cleanName)
    .maybeSingle();
  if (findError) throw findError;
  if (existing) return;
  const { error } = await getSupabaseAdmin().from("vendors").insert({
    name: cleanName,
    category: category ?? null,
  });
  if (error && error.code !== "23505") throw error;
}

function expensePayload(parsed: {
  vendor: string;
  category: string;
  expenseType: string;
  amountCents: number;
  status: string;
  expenseDate?: Date;
  notes?: string;
  clientId?: string;
  projectId?: string;
  recurrence: string;
}) {
  const expenseDate =
    parsed.expenseDate?.toISOString().slice(0, 10) ??
    new Date().toISOString().slice(0, 10);
  return {
    vendor: parsed.vendor,
    category: parsed.category,
    expense_type: parsed.expenseType,
    amount_cents: parsed.amountCents,
    status: parsed.status,
    expense_date: expenseDate,
    notes: parsed.notes ?? null,
    client_id: parsed.clientId ?? null,
    project_id: parsed.projectId ?? null,
    recurrence: parsed.recurrence,
    next_due_date: parsed.recurrence === "NONE" ? null : expenseDate,
  };
}

export async function recordExpense(formData: FormData) {
  const user = await requirePermission(permissions.billingWrite);
  if (!(await reserveSubmission(user.id, formData, "expense:create")))
    redirect("/billing?tab=expenses");
  const parsed = expenseSchema.parse({
    vendor: str(formData, "vendor") || str(formData, "newVendor"),
    category: str(formData, "category"),
    expenseType: str(formData, "expenseType") || "GENERAL",
    amountCents: randsToCents(formData.get("amountRands")),
    status: str(formData, "status") || "PENDING",
    expenseDate: str(formData, "expenseDate"),
    notes: str(formData, "notes"),
    clientId: str(formData, "clientId"),
    projectId: str(formData, "projectId"),
    recurrence: str(formData, "recurrence"),
    nextDueDate: str(formData, "nextDueDate"),
  });
  await ensureVendor(parsed.vendor, parsed.category);
  const { data, error } = await getSupabaseAdmin()
    .from("expenses")
    .insert({ ...expensePayload(parsed), created_by: user.id })
    .select("id,vendor")
    .single();
  if (error) throw error;
  await attachOptionalFile(formData, {
    entityType: "Expense",
    entityId: data.id,
    clientId: parsed.clientId ?? null,
    projectId: parsed.projectId ?? null,
    actorId: user.id,
    activityMessage: `Receipt attached to ${data.vendor} expense`,
  });
  await logActivity({
    action: "EXPENSE_RECORDED",
    entityType: "Expense",
    entityId: data.id,
    clientId: parsed.clientId ?? null,
    projectId: parsed.projectId ?? null,
    actorId: user.id,
    message: `${data.vendor} expense recorded`,
  });
  revalidatePath("/billing");
  redirect("/billing?tab=expenses");
}


export async function updateExpense(formData: FormData) {
  const user = await requirePermission(permissions.billingWrite);
  const id = str(formData, "id");
  const parsed = expenseSchema.parse({
    vendor: str(formData, "vendor") || str(formData, "newVendor"),
    category: str(formData, "category"),
    expenseType: str(formData, "expenseType") || "GENERAL",
    amountCents: randsToCents(formData.get("amountRands")),
    status: str(formData, "status") || "PENDING",
    expenseDate: str(formData, "expenseDate"),
    notes: str(formData, "notes"),
    clientId: str(formData, "clientId"),
    projectId: str(formData, "projectId"),
    recurrence: str(formData, "recurrence"),
  });
  await ensureVendor(parsed.vendor, parsed.category);
  const { error } = await getSupabaseAdmin()
    .from("expenses")
    .update(expensePayload(parsed))
    .eq("id", id);
  if (error) throw error;
  await logActivity({
    action: "EXPENSE_UPDATED",
    entityType: "Expense",
    entityId: id,
    clientId: parsed.clientId ?? null,
    projectId: parsed.projectId ?? null,
    actorId: user.id,
    message: `${parsed.vendor} expense updated`,
  });
  revalidatePath("/billing");
  redirect("/billing?tab=expenses");
}

export async function deleteExpense(formData: FormData) {
  const user = await requirePermission(permissions.billingWrite);
  const id = str(formData, "id");
  const { data: expense, error: fetchError } = await getSupabaseAdmin()
    .from("expenses")
    .select("id,vendor,client_id,project_id")
    .eq("id", id)
    .single();
  if (fetchError) throw fetchError;
  const { error } = await getSupabaseAdmin().from("expenses").delete().eq("id", id);
  if (error) throw error;
  await logActivity({
    action: "EXPENSE_REMOVED",
    entityType: "Expense",
    entityId: id,
    clientId: expense.client_id,
    projectId: expense.project_id,
    actorId: user.id,
    message: `${expense.vendor} expense removed`,
  });
  revalidatePath("/billing");
  redirect("/billing?tab=expenses");
}

export async function markExpensePaid(formData: FormData) {
  const user = await requirePermission(permissions.billingWrite);
  const id = str(formData, "id");
  const { data: expense, error: fetchError } = await getSupabaseAdmin()
    .from("expenses")
    .select("id,vendor,recurrence,expense_date,client_id,project_id")
    .eq("id", id)
    .single();
  if (fetchError) throw fetchError;
  const recurring = expense.recurrence && expense.recurrence !== "NONE";
  const nextDate = recurring
    ? nextRecurringDate(expense.expense_date, expense.recurrence)
    : null;
  const { error } = await getSupabaseAdmin()
    .from("expenses")
    .update(
      recurring
        ? { status: "PENDING", expense_date: nextDate, next_due_date: nextDate }
        : { status: "PAID" },
    )
    .eq("id", id);
  if (error) throw error;
  await logActivity({
    action: "EXPENSE_PAID",
    entityType: "Expense",
    entityId: id,
    clientId: expense.client_id,
    projectId: expense.project_id,
    actorId: user.id,
    message: recurring
      ? `${expense.vendor} paid; next ${expense.recurrence.toLowerCase()} due ${nextDate}`
      : `${expense.vendor} marked paid`,
  });
  revalidatePath("/billing");
  redirect("/billing?tab=expenses");
}

export async function upsertRetainer(formData: FormData) {
  const user = await requirePermission(permissions.billingWrite);
  if (!(await reserveSubmission(user.id, formData, "retainer:create")))
    redirect("/retainers");
  const parsed = retainerSchema.parse({
    clientId: str(formData, "clientId"),
    type: str(formData, "type"),
    status: str(formData, "status"),
    monthlyAmountCents: randsToCents(formData.get("monthlyAmountRands")),
    nextBillingDate: str(formData, "nextBillingDate"),
  });
  const { data, error } = await getSupabaseAdmin()
    .from("retainers")
    .insert({
      client_id: parsed.clientId,
      type: parsed.type,
      status: parsed.status,
      monthly_amount_cents: parsed.monthlyAmountCents,
      next_billing_date: parsed.nextBillingDate?.toISOString() ?? null,
    })
    .select("id,type,client_id")
    .single();
  if (error) throw error;
  await logActivity({
    action: "RETAINER_CREATED",
    entityType: "Retainer",
    entityId: data.id,
    clientId: data.client_id,
    actorId: user.id,
    message: `${data.type} retainer created`,
  });
  revalidatePath("/billing");
  revalidatePath("/retainers");
  redirect("/billing?tab=retainers");
}

export async function upsertSupportTicket(formData: FormData) {
  const user = await requirePermission(permissions.supportWrite);
  const id = str(formData, "id") || undefined;
  if (
    !id &&
    !(await reserveSubmission(user.id, formData, "support-ticket:create"))
  )
    redirect("/support");
  const parsed = supportTicketSchema.parse({
    title: str(formData, "title"),
    category: str(formData, "category"),
    priority: str(formData, "priority"),
    status: str(formData, "status"),
    clientId: str(formData, "clientId"),
    projectId: str(formData, "projectId"),
    assignedToId: str(formData, "assignedToId"),
    internalNotes: str(formData, "internalNotes"),
    clientUpdateNotes: str(formData, "clientUpdateNotes"),
    resolutionNotes: str(formData, "resolutionNotes"),
  });
  const payload = {
    title: parsed.title,
    category: parsed.category,
    priority: parsed.priority,
    status: parsed.status,
    client_id: parsed.clientId ?? null,
    project_id: parsed.projectId ?? null,
    assigned_to: parsed.assignedToId ?? null,
    internal_notes: parsed.internalNotes ?? null,
    client_update_notes: parsed.clientUpdateNotes ?? null,
    resolution_notes: parsed.resolutionNotes ?? null,
    resolved_at: ["RESOLVED", "CLOSED"].includes(parsed.status)
      ? new Date().toISOString()
      : null,
  };
  const result = id
    ? await getSupabaseAdmin()
        .from("support_tickets")
        .update(payload)
        .eq("id", id)
        .select("id,title,client_id,project_id")
        .single()
    : await getSupabaseAdmin()
        .from("support_tickets")
        .insert(payload)
        .select("id,title,client_id,project_id")
        .single();
  if (result.error) throw result.error;
  await logActivity({
    action: id ? "TICKET_UPDATED" : "TICKET_CREATED",
    entityType: "SupportTicket",
    entityId: result.data.id,
    clientId: result.data.client_id,
    projectId: result.data.project_id,
    actorId: user.id,
    message: `${result.data.title} ${id ? "updated" : "created"}`,
  });
  revalidatePath("/support");
  redirect("/support");
}

export async function upsertAffiliate(formData: FormData) {
  const user = await requirePermission(permissions.marketingWrite);
  if (!(await reserveSubmission(user.id, formData, "affiliate:create")))
    redirect("/affiliates");
  const parsed = affiliateSchema.parse({
    name: str(formData, "name"),
    email: str(formData, "email"),
    trackingCode: str(formData, "trackingCode"),
    status: str(formData, "status"),
    defaultCommissionType: str(formData, "defaultCommissionType"),
    defaultCommissionRate: formData.get("defaultCommissionRate"),
  });
  const { error } = await getSupabaseAdmin()
    .from("affiliates")
    .insert({
      name: parsed.name,
      email: parsed.email,
      tracking_code: parsed.trackingCode ?? trackingCode(parsed.name),
      status: parsed.status,
      default_commission_type: parsed.defaultCommissionType,
      default_commission_rate: parsed.defaultCommissionRate,
    });
  if (error) throw error;
  revalidatePath("/affiliates");
  redirect("/affiliates");
}

export async function createReferral(formData: FormData) {
  const user = await requirePermission(permissions.marketingWrite);
  if (!(await reserveSubmission(user.id, formData, "referral:create")))
    redirect("/affiliates");
  const parsed = referralSchema.parse({
    affiliateId: str(formData, "affiliateId"),
    leadId: str(formData, "leadId"),
    clientId: str(formData, "clientId"),
    status: str(formData, "status") || "PENDING",
  });
  await getSupabaseAdmin()
    .from("referrals")
    .insert({
      affiliate_id: parsed.affiliateId,
      lead_id: parsed.leadId ?? null,
      client_id: parsed.clientId ?? null,
      status: parsed.status,
    });
  revalidatePath("/affiliates");
  redirect("/affiliates");
}

export async function createCommission(formData: FormData) {
  const user = await requirePermission(permissions.marketingWrite);
  if (!(await reserveSubmission(user.id, formData, "commission:create")))
    redirect("/affiliates");
  const parsed = commissionSchema.parse({
    affiliateId: str(formData, "affiliateId"),
    quoteId: str(formData, "quoteId"),
    projectId: str(formData, "projectId"),
    paymentId: str(formData, "paymentId"),
    status: str(formData, "status"),
    amountCents: randsToCents(formData.get("amountRands")),
    commissionType: str(formData, "commissionType"),
  });
  await getSupabaseAdmin()
    .from("commissions")
    .insert({
      affiliate_id: parsed.affiliateId,
      quote_id: parsed.quoteId ?? null,
      project_id: parsed.projectId ?? null,
      payment_id: parsed.paymentId ?? null,
      status: parsed.status,
      amount_cents: parsed.amountCents,
      commission_type: parsed.commissionType,
      paid_at: parsed.status === "PAID" ? new Date().toISOString() : null,
    });
  revalidatePath("/affiliates");
  redirect("/affiliates");
}

export async function upsertCampaign(formData: FormData) {
  const user = await requirePermission(permissions.marketingWrite);
  if (!(await reserveSubmission(user.id, formData, "campaign:create")))
    redirect("/marketing");
  const parsed = campaignSchema.parse({
    name: str(formData, "name"),
    platform: str(formData, "platform"),
    targetIndustry: str(formData, "targetIndustry"),
    offerMessage: str(formData, "offerMessage"),
    numberContacted: formData.get("numberContacted"),
    replies: formData.get("replies"),
    callsBooked: formData.get("callsBooked"),
    quotesSent: formData.get("quotesSent"),
    dealsClosed: formData.get("dealsClosed"),
  });
  await getSupabaseAdmin()
    .from("campaigns")
    .insert({
      name: parsed.name,
      platform: parsed.platform,
      target_industry: parsed.targetIndustry ?? null,
      offer_message: parsed.offerMessage ?? null,
      number_contacted: parsed.numberContacted,
      replies: parsed.replies,
      calls_booked: parsed.callsBooked,
      quotes_sent: parsed.quotesSent,
      deals_closed: parsed.dealsClosed,
    });
  revalidatePath("/marketing");
  redirect("/marketing");
}

export async function upsertContentItem(formData: FormData) {
  const user = await requirePermission(permissions.marketingWrite);
  if (!(await reserveSubmission(user.id, formData, "content-item:create")))
    redirect("/marketing");
  const parsed = contentItemSchema.parse({
    title: str(formData, "title"),
    status: str(formData, "status"),
    platform: str(formData, "platform"),
    postUrl: str(formData, "postUrl"),
    performanceNotes: str(formData, "performanceNotes"),
    leadsGenerated: formData.get("leadsGenerated"),
  });
  await getSupabaseAdmin()
    .from("content_items")
    .insert({
      title: parsed.title,
      status: parsed.status,
      platform: parsed.platform ?? null,
      post_url: parsed.postUrl ?? null,
      performance_notes: parsed.performanceNotes ?? null,
      leads_generated: parsed.leadsGenerated,
    });
  revalidatePath("/marketing");
  redirect("/marketing");
}

export async function upsertKnowledgeBaseItem(formData: FormData) {
  const user = await requirePermission(permissions.settingsManage);
  if (!(await reserveSubmission(user.id, formData, "knowledge-base:create")))
    redirect("/knowledge-base");
  const parsed = knowledgeBaseSchema.parse({
    title: str(formData, "title"),
    category: str(formData, "category"),
    body: str(formData, "body"),
    visibility: str(formData, "visibility"),
  });
  await getSupabaseAdmin().from("knowledge_base_items").insert({
    title: parsed.title,
    category: parsed.category,
    body: parsed.body,
    visibility: parsed.visibility,
  });
  revalidatePath("/knowledge-base");
  redirect("/knowledge-base");
}

export async function addNote(formData: FormData) {
  const user = await requirePermission(permissions.clientsWrite);
  if (!(await reserveSubmission(user.id, formData, "note:create"))) return;
  const parsed = noteSchema.parse({
    body: str(formData, "body"),
    entityType: str(formData, "entityType"),
    entityId: str(formData, "entityId"),
    clientId: str(formData, "clientId"),
    leadId: str(formData, "leadId"),
    projectId: str(formData, "projectId"),
  });
  const { error } = await getSupabaseAdmin()
    .from("notes")
    .insert({
      body: parsed.body,
      entity_type: parsed.entityType,
      entity_id: parsed.entityId,
      client_id: parsed.clientId ?? null,
      lead_id: parsed.leadId ?? null,
      project_id: parsed.projectId ?? null,
    });
  if (error) throw error;
  await logActivity({
    action: "NOTE_ADDED",
    entityType: parsed.entityType,
    entityId: parsed.entityId,
    clientId: parsed.clientId,
    leadId: parsed.leadId,
    projectId: parsed.projectId,
    actorId: user.id,
    message: "Note added",
  });
  revalidatePath(path(formData, "/dashboard"));
}

const internalFilesBucket = "internal-files";

function filePermission(entityType: string) {
  if (entityType === "Lead") return permissions.leadsWrite;
  if (entityType === "KnowledgeBase") return permissions.settingsManage;
  return permissions.clientsWrite;
}


function fileTypedIds(parsed: { entityType: string; entityId: string; clientId?: string; leadId?: string; projectId?: string; knowledgeBaseItemId?: string }) {
  return {
    lead_id: parsed.leadId ?? (parsed.entityType === "Lead" ? parsed.entityId : null),
    client_id: parsed.clientId ?? (parsed.entityType === "Client" ? parsed.entityId : null),
    project_id: parsed.projectId ?? (parsed.entityType === "Project" ? parsed.entityId : null),
    knowledge_base_item_id: parsed.knowledgeBaseItemId ?? (parsed.entityType === "KnowledgeBase" ? parsed.entityId : null),
  };
}

function safeStorageName(filename: string) {
  const cleaned = filename
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 140);
  return cleaned || "upload";
}

export async function addFileRecord(
  previousState: ActionResult | null,
  submittedFormData?: FormData,
) {
  const formData = actionFormData(previousState, submittedFormData);
  return withActionResult(async () => {
    const entityType = str(formData, "entityType");
    const user = await requirePermission(filePermission(entityType));
    if (!(await reserveSubmission(user.id, formData, "file-record:create")))
      return;

    const uploadedFiles = formData.getAll("file").filter((file): file is File => file instanceof File && file.size > 0);
    const hasUpload = uploadedFiles.length > 0;
    const supabase = getSupabaseAdmin();
    let parsed: {
      filename: string;
      url: string;
      mimeType?: string;
      entityType: string;
      entityId: string;
      clientId?: string;
      leadId?: string;
      projectId?: string;
      knowledgeBaseItemId?: string;
    };

    if (hasUpload) {
      const records = await Promise.all(
        uploadedFiles.map(async (file) => {
          const upload = uploadFileSchema.parse({
            filename:
              uploadedFiles.length === 1 && str(formData, "filename")
                ? str(formData, "filename")
                : file.name,
            mimeType: file.type,
            size: file.size,
            entityType,
            entityId: str(formData, "entityId"),
            clientId: str(formData, "clientId"),
            leadId: str(formData, "leadId"),
            projectId: str(formData, "projectId"),
            knowledgeBaseItemId: str(formData, "knowledgeBaseItemId"),
          });
          const storagePath = `${upload.entityType.toLowerCase()}/${upload.entityId}/${crypto.randomUUID()}-${safeStorageName(upload.filename)}`;
          const { error: uploadError } = await supabase.storage
            .from(internalFilesBucket)
            .upload(storagePath, file, {
              contentType: upload.mimeType,
              upsert: false,
            });
          if (uploadError) throw uploadError;
          const { data: signed, error: signedError } = await supabase.storage
            .from(internalFilesBucket)
            .createSignedUrl(storagePath, 60 * 60 * 24 * 365 * 10);
          if (signedError) throw signedError;
          return { ...upload, url: signed.signedUrl };
        }),
      );
      parsed = records[0];
      const rows = records.map((record) => {
        const typedIds = fileTypedIds(record);
        return {
          filename: record.filename,
          url: record.url,
          mime_type: record.mimeType ?? null,
          entity_type: record.entityType,
          entity_id: record.entityId,
          ...typedIds,
        };
      });
      const { error } = await supabase.from("files").insert(rows);
      if (error) throw error;
      await logActivity({
        action: "FILE_UPLOADED",
        entityType: parsed.entityType,
        entityId: parsed.entityId,
        clientId: fileTypedIds(parsed).client_id,
        leadId: fileTypedIds(parsed).lead_id,
        projectId: fileTypedIds(parsed).project_id,
        actorId: user.id,
        message: `${records.length} file${records.length === 1 ? "" : "s"} uploaded`,
      });
      revalidatePath(path(formData, "/dashboard"));
      return;
    } else {
      parsed = fileRecordSchema.parse({
        filename:
          str(formData, "filename") ||
          safeStorageName(
            new URL(str(formData, "url")).pathname.split("/").pop() ||
              "external-file",
          ),
        url: str(formData, "url"),
        mimeType: str(formData, "mimeType"),
        entityType,
        entityId: str(formData, "entityId"),
        clientId: str(formData, "clientId"),
        leadId: str(formData, "leadId"),
        projectId: str(formData, "projectId"),
        knowledgeBaseItemId: str(formData, "knowledgeBaseItemId"),
      });
    }

    const typedIds = fileTypedIds(parsed);
    const { error } = await supabase.from("files").insert({
      filename: parsed.filename,
      url: parsed.url,
      mime_type: parsed.mimeType ?? null,
      entity_type: parsed.entityType,
      entity_id: parsed.entityId,
      ...typedIds,
    });
    if (error) throw error;
    await logActivity({
      action: hasUpload ? "FILE_UPLOADED" : "FILE_LINK_ADDED",
      entityType: parsed.entityType,
      entityId: parsed.entityId,
      clientId: typedIds.client_id,
      leadId: typedIds.lead_id,
      projectId: typedIds.project_id,
      actorId: user.id,
      message: `${parsed.filename} ${hasUpload ? "uploaded" : "linked"}`,
    });
    revalidatePath(path(formData, "/dashboard"));
  });
}

export async function createChecklistTemplate(formData: FormData) {
  const user = await requirePermission(permissions.settingsManage);
  const id = str(formData, "id") || undefined;
  if (
    !id &&
    !(await reserveSubmission(user.id, formData, "checklist-template:create"))
  )
    redirect("/settings");
  const parsed = checklistTemplateSchema.parse({
    id,
    name: str(formData, "name"),
    serviceId: str(formData, "serviceId"),
    description: str(formData, "description"),
    firstItemTitle: str(formData, "firstItemTitle"),
    isActive: bool(formData, "isActive"),
  });
  const payload = {
    name: parsed.name,
    service_id: parsed.serviceId ?? null,
    description: parsed.description ?? null,
    is_active: parsed.isActive,
  };
  const result = id
    ? await getSupabaseAdmin()
        .from("checklist_templates")
        .update(payload)
        .eq("id", id)
        .select("id")
        .single()
    : await getSupabaseAdmin()
        .from("checklist_templates")
        .insert(payload)
        .select("id")
        .single();
  if (result.error) throw result.error;
  if (!id && parsed.firstItemTitle)
    await getSupabaseAdmin().from("checklist_items").insert({
      template_id: result.data.id,
      title: parsed.firstItemTitle,
      sort_order: 0,
    });
  revalidatePath("/settings");
  redirect("/settings");
}

export async function createChecklistItem(formData: FormData) {
  const user = await requirePermission(permissions.settingsManage);
  const id = str(formData, "id") || undefined;
  if (
    !id &&
    !(await reserveSubmission(user.id, formData, "checklist-item:create"))
  )
    redirect("/settings");
  const parsed = checklistItemSchema.parse({
    id,
    templateId: str(formData, "templateId"),
    title: str(formData, "title"),
    description: str(formData, "description"),
    sortOrder: formData.get("sortOrder"),
  });
  const payload = {
    template_id: parsed.templateId,
    title: parsed.title,
    description: parsed.description ?? null,
    sort_order: parsed.sortOrder,
  };
  const { error } = id
    ? await getSupabaseAdmin()
        .from("checklist_items")
        .update(payload)
        .eq("id", id)
    : await getSupabaseAdmin().from("checklist_items").insert(payload);
  if (error) throw error;
  revalidatePath("/settings");
  redirect("/settings");
}

export async function upsertService(formData: FormData) {
  await requirePermission(permissions.settingsManage);
  const id = str(formData, "id") || undefined;
  const parsed = serviceSchema.parse({
    id,
    name: str(formData, "name"),
    category: str(formData, "category"),
    description: str(formData, "description"),
    baseOnceOffCents: randsToCents(formData.get("baseOnceOffRands")),
    baseMonthlyCents: randsToCents(formData.get("baseMonthlyRands")),
    isActive: bool(formData, "isActive"),
  });
  const payload = {
    name: parsed.name,
    category: parsed.category,
    description: parsed.description,
    base_once_off_cents: parsed.baseOnceOffCents,
    base_monthly_cents: parsed.baseMonthlyCents,
    is_active: parsed.isActive,
  };
  const { error } = id
    ? await getSupabaseAdmin().from("services").update(payload).eq("id", id)
    : await getSupabaseAdmin()
        .from("services")
        .upsert(payload, { onConflict: "name" });
  if (error) throw error;
  revalidatePath("/services");
  revalidatePath("/settings");
  redirect(path(formData, "/services"));
}

export async function upsertActivityWorkflow(formData: FormData) {
  const entityType = str(formData, "entityType");
  const permission =
    entityType === "Lead" ? permissions.leadsWrite : permissions.clientsWrite;
  const user = await requirePermission(permission);
  if (!(await reserveSubmission(user.id, formData, "activity-workflow:upsert")))
    redirect(path(formData, "/dashboard"));

  const entityId =
    str(formData, "entityId") ||
    (entityType === "Lead" ? str(formData, "leadId") : str(formData, "clientId"));
  if (!entityId || !["Lead", "Client"].includes(entityType))
    throw new Error("Activity log must be linked to a lead or client.");

  const leadId = entityType === "Lead" ? entityId : str(formData, "leadId") || null;
  const clientId = entityType === "Client" ? entityId : str(formData, "clientId") || null;
  const eventType = str(formData, "eventType") || "CALL";
  const direction = str(formData, "direction") || "INTERNAL";
  const summary = str(formData, "summary").trim();
  const objections = str(formData, "objections").trim();
  const outcome = str(formData, "outcome").trim();
  const scrapReason = str(formData, "scrapReason").trim();
  const title = str(formData, "title").trim() || outcome || `${eventType} log`;
  const taskId = str(formData, "taskId") || null;
  const taskCloseMode = str(formData, "taskCloseMode") || "KEEP_OPEN";

  const body = [
    `Log type: ${eventType}`,
    `Direction: ${direction}`,
    taskId ? `Related task: ${taskId}` : null,
    `Summary: ${summary}`,
    objections ? `Important replies: ${objections}` : null,
    outcome ? `Outcome: ${outcome}` : null,
    scrapReason ? `Scrap/blocker reason: ${scrapReason}` : null,
  ].filter(Boolean).join("\n");

  const supabase = getSupabaseAdmin();
  const { error: noteError } = await supabase.from("notes").insert({
    body,
    entity_type: entityType,
    entity_id: entityId,
    client_id: clientId,
    lead_id: leadId,
  });
  if (noteError) throw noteError;

  if (taskId && taskCloseMode !== "KEEP_OPEN") {
    const status = taskCloseMode === "SCRAPPED" ? "SCRAPPED" : "DONE";
    const { error: taskError } = await supabase
      .from("tasks")
      .update({ status, completed_at: new Date().toISOString() })
      .eq("id", taskId);
    if (taskError) throw taskError;
  }

  await attachOptionalFile(formData, {
    entityType,
    entityId,
    clientId,
    leadId,
    actorId: user.id,
    activityMessage: `Attachment saved for ${title}`,
  });

  await logActivity({
    action: eventType === "TASK" ? "TASK_OUTCOME_LOGGED" : "ACTIVITY_LOGGED",
    entityType,
    entityId,
    leadId,
    clientId,
    taskId,
    actorId: user.id,
    message: `${title}: ${outcome || summary}`,
  });

  revalidatePath(path(formData, "/dashboard"));
  revalidatePath("/tasks");
  redirect(path(formData, "/dashboard"));
}

export async function assignLinkedTask(formData: FormData) {
  const entityType = str(formData, "entityType");
  const permission =
    entityType === "Lead" ? permissions.leadsWrite : permissions.clientsWrite;
  const user = await requirePermission(permission);
  if (!(await reserveSubmission(user.id, formData, "linked-task:create")))
    redirect(path(formData, "/dashboard"));
  const parsed = linkedTaskSchema.parse({
    entityType,
    leadId: str(formData, "leadId"),
    clientId: str(formData, "clientId"),
    title: str(formData, "title"),
    description: str(formData, "description"),
    dueDate: str(formData, "dueDate"),
    assignedToId: str(formData, "assignedToId"),
  });
  const entityId =
    parsed.entityType === "Lead" ? parsed.leadId : parsed.clientId;
  if (!entityId) throw new Error("Task must be linked to a lead or client.");
  const { data, error } = await getSupabaseAdmin()
    .from("tasks")
    .insert({
      title: parsed.title,
      description: parsed.description ?? null,
      type: "SALES_FOLLOW_UP",
      status: "TO_DO",
      priority: "HIGH",
      due_date: parsed.dueDate?.toISOString() ?? null,
      assigned_to: parsed.assignedToId ?? null,
      client_id: parsed.clientId ?? null,
      created_by: user.id,
    })
    .select("id,title")
    .single();
  if (error) throw error;
  if (parsed.entityType === "Lead" && parsed.leadId)
    await getSupabaseAdmin()
      .from("leads")
      .update({
        next_action: parsed.title,
        follow_up_date: parsed.dueDate?.toISOString() ?? null,
        assigned_to: parsed.assignedToId ?? null,
      })
      .eq("id", parsed.leadId);
  if (parsed.entityType === "Client" && parsed.clientId)
    await getSupabaseAdmin()
      .from("clients")
      .update({ next_action: parsed.title })
      .eq("id", parsed.clientId);
  await attachOptionalFile(formData, {
    entityType: "Task",
    entityId: data.id,
    clientId: parsed.clientId ?? null,
    leadId: parsed.leadId ?? null,
    actorId: user.id,
    activityMessage: `File attached to assigned task ${parsed.title}`,
  });
  await logActivity({
    action: "TASK_ASSIGNED",
    entityType: parsed.entityType,
    entityId,
    leadId: parsed.leadId,
    clientId: parsed.clientId,
    taskId: data.id,
    actorId: user.id,
    message: `${parsed.title} assigned`,
  });
  revalidatePath(path(formData, "/dashboard"));
  revalidatePath("/tasks");
  redirect(path(formData, "/dashboard"));
}

export async function logInteractionEvent(formData: FormData) {
  const entityType = str(formData, "entityType");
  const permission =
    entityType === "Lead" ? permissions.leadsWrite : permissions.clientsWrite;
  const user = await requirePermission(permission);
  if (!(await reserveSubmission(user.id, formData, "interaction-event:create")))
    redirect(path(formData, "/dashboard"));
  const parsed = interactionEventSchema.parse({
    entityType,
    leadId: str(formData, "leadId"),
    clientId: str(formData, "clientId"),
    eventType: str(formData, "eventType"),
    direction: str(formData, "direction"),
    summary: str(formData, "summary"),
    objections: str(formData, "objections"),
    outcome: str(formData, "outcome"),
    taskId: str(formData, "taskId"),
  });
  const entityId =
    parsed.entityType === "Lead" ? parsed.leadId : parsed.clientId;
  if (!entityId) throw new Error("Event must be linked to a lead or client.");
  const body = [
    `${parsed.eventType} • ${parsed.direction}`,
    `Summary: ${parsed.summary}`,
    parsed.objections ? `Objections: ${parsed.objections}` : null,
    parsed.outcome ? `Outcome: ${parsed.outcome}` : null,
  ]
    .filter(Boolean)
    .join("\n");
  await getSupabaseAdmin()
    .from("notes")
    .insert({
      body,
      entity_type: parsed.entityType,
      entity_id: entityId,
      client_id: parsed.clientId ?? null,
      lead_id: parsed.leadId ?? null,
    });
  if (parsed.taskId && parsed.eventType === "TASK")
    await getSupabaseAdmin()
      .from("tasks")
      .update({ status: "DONE", completed_at: new Date().toISOString() })
      .eq("id", parsed.taskId);
  await attachOptionalFile(formData, {
    entityType: parsed.taskId ? "Task" : parsed.entityType,
    entityId: parsed.taskId ?? entityId,
    clientId: parsed.clientId ?? null,
    leadId: parsed.leadId ?? null,
    actorId: user.id,
    activityMessage: `File attached to ${parsed.eventType.toLowerCase()} log`,
  });
  await logActivity({
    action: "INTERACTION_LOGGED",
    entityType: parsed.entityType,
    entityId,
    leadId: parsed.leadId,
    clientId: parsed.clientId,
    actorId: user.id,
    message: `${parsed.eventType} logged: ${parsed.outcome ?? parsed.summary}`,
  });
  revalidatePath(path(formData, "/dashboard"));
  redirect(path(formData, "/dashboard"));
}

export async function bookEvent(formData: FormData) {
  const entityType = str(formData, "entityType");
  const permission =
    entityType === "Lead" ? permissions.leadsWrite : permissions.clientsWrite;
  const user = await requirePermission(permission);
  if (!(await reserveSubmission(user.id, formData, "book-event:create")))
    redirect(path(formData, "/dashboard"));
  const parsed = bookEventSchema.parse({
    entityType,
    leadId: str(formData, "leadId"),
    clientId: str(formData, "clientId"),
    eventType: str(formData, "eventType"),
    title: str(formData, "title"),
    eventAt: str(formData, "eventAt"),
    notes: str(formData, "notes"),
    assignedToId: str(formData, "assignedToId"),
  });
  const entityId =
    parsed.entityType === "Lead" ? parsed.leadId : parsed.clientId;
  if (!entityId || !parsed.eventAt)
    throw new Error("Booked events need a linked record and date/time.");
  const body = [
    `Booked ${parsed.eventType}: ${parsed.title}`,
    `When: ${parsed.eventAt.toISOString()}`,
    parsed.notes ? `Notes: ${parsed.notes}` : null,
  ]
    .filter(Boolean)
    .join("\n");
  const { data: task, error } = await getSupabaseAdmin()
    .from("tasks")
    .insert({
      title: parsed.title,
      description: body,
      type: parsed.eventType === "CALL" ? "DISCOVERY_CALL" : "SALES_FOLLOW_UP",
      status: "TO_DO",
      priority: "HIGH",
      due_date: parsed.eventAt.toISOString(),
      assigned_to: parsed.assignedToId ?? null,
      client_id: parsed.clientId ?? null,
      created_by: user.id,
    })
    .select("id,title")
    .single();
  if (error) throw error;
  await getSupabaseAdmin()
    .from("notes")
    .insert({
      body,
      entity_type: parsed.entityType,
      entity_id: entityId,
      client_id: parsed.clientId ?? null,
    });
  if (parsed.entityType === "Lead" && parsed.leadId)
    await getSupabaseAdmin()
      .from("leads")
      .update({
        follow_up_date: parsed.eventAt.toISOString(),
        next_action: parsed.title,
        assigned_to: parsed.assignedToId ?? null,
      })
      .eq("id", parsed.leadId);
  if (parsed.entityType === "Client" && parsed.clientId)
    await getSupabaseAdmin()
      .from("clients")
      .update({ next_action: parsed.title })
      .eq("id", parsed.clientId);
  await attachOptionalFile(formData, {
    entityType: "Task",
    entityId: task.id,
    clientId: parsed.clientId ?? null,
    leadId: parsed.leadId ?? null,
    actorId: user.id,
    activityMessage: `File attached to booked event ${parsed.title}`,
  });
  await syncTaskToGoogleCalendar(task.id);
  await logActivity({
    action: "EVENT_BOOKED",
    entityType: parsed.entityType,
    entityId,
    leadId: parsed.leadId,
    clientId: parsed.clientId,
    taskId: task.id,
    actorId: user.id,
    message: `${parsed.title} booked`,
  });
  revalidatePath(path(formData, "/dashboard"));
  revalidatePath("/calendar");
  redirect(path(formData, "/dashboard"));
}

export async function logLeadCall(formData: FormData) {
  const user = await requirePermission(permissions.leadsWrite);
  if (!(await reserveSubmission(user.id, formData, "lead-call:create")))
    redirect(path(formData, "/leads"));
  const parsed = leadCallSchema.parse({
    leadId: str(formData, "leadId"),
    callSummary: str(formData, "callSummary"),
    objections: str(formData, "objections"),
    outcome: str(formData, "outcome"),
    nextAction: str(formData, "nextAction"),
    bookedCallAt: str(formData, "bookedCallAt"),
    assignedToId: str(formData, "assignedToId"),
  });
  const body = [
    `Call outcome: ${parsed.outcome}`,
    `Summary: ${parsed.callSummary}`,
    parsed.objections ? `Objections: ${parsed.objections}` : null,
    parsed.nextAction ? `Next action: ${parsed.nextAction}` : null,
  ]
    .filter(Boolean)
    .join("\n");
  await getSupabaseAdmin().from("notes").insert({
    body,
    entity_type: "Lead",
    entity_id: parsed.leadId,
    lead_id: parsed.leadId,
  });
  let bookedTaskId: string | null = null;
  if (parsed.bookedCallAt) {
    const { data: task, error: taskError } = await getSupabaseAdmin()
      .from("tasks")
      .insert({
        title: `Booked call follow-up`,
        description: body,
        type: "DISCOVERY_CALL",
        status: "TO_DO",
        priority: "HIGH",
        due_date: parsed.bookedCallAt.toISOString(),
        assigned_to: parsed.assignedToId ?? null,
        created_by: user.id,
      })
      .select("id")
      .single();
    if (taskError) throw taskError;
    bookedTaskId = task.id;
  }
  await getSupabaseAdmin()
    .from("leads")
    .update({
      next_action: parsed.nextAction ?? parsed.outcome,
      follow_up_date: parsed.bookedCallAt?.toISOString() ?? null,
      assigned_to: parsed.assignedToId ?? null,
    })
    .eq("id", parsed.leadId);
  await attachOptionalFile(formData, {
    entityType: bookedTaskId ? "Task" : "Lead",
    entityId: bookedTaskId ?? parsed.leadId,
    leadId: parsed.leadId,
    actorId: user.id,
    activityMessage: `File attached to logged call: ${parsed.outcome}`,
  });
  await logActivity({
    action: "LEAD_CALL_LOGGED",
    entityType: "Lead",
    entityId: parsed.leadId,
    leadId: parsed.leadId,
    taskId: bookedTaskId,
    actorId: user.id,
    message: `Call logged: ${parsed.outcome}`,
  });
  revalidatePath(path(formData, "/leads"));
  redirect(path(formData, "/leads"));
}

export async function updateTaskStatus(formData: FormData) {
  const user = await requirePermission(permissions.tasksWrite);
  const parsed = taskStatusSchema.parse({
    id: str(formData, "id"),
    status: str(formData, "status"),
    assignedToId: str(formData, "assignedToId"),
  });
  const outcome = str(formData, "outcome").trim();
  const scrapReason = str(formData, "scrapReason").trim();
  const { data: previousTask, error: previousTaskError } = await getSupabaseAdmin()
    .from("tasks")
    .select("status")
    .eq("id", parsed.id)
    .single();
  if (previousTaskError) throw previousTaskError;
  const { data, error } = await getSupabaseAdmin()
    .from("tasks")
    .update({
      status: parsed.status,
      assigned_to: parsed.assignedToId ?? null,
      completed_at: ["DONE", "SCRAPPED"].includes(parsed.status)
        ? new Date().toISOString()
        : null,
    })
    .eq("id", parsed.id)
    .select("id,title,description,type,priority,due_date,client_id,project_id,assigned_to,created_by,recurrence,recurrence_interval,recurrence_day_of_week,recurrence_day_of_month")
    .single();
  if (error) throw error;
  if (parsed.status === "DONE" && previousTask.status !== "DONE" && data.recurrence !== "NONE") {
    const nextDueAt = nextRecurringDueDate({
      baseDate: data.due_date ? new Date(data.due_date) : new Date(),
      recurrence: data.recurrence,
      interval: data.recurrence_interval,
      dayOfWeek: data.recurrence_day_of_week,
      dayOfMonth: data.recurrence_day_of_month,
    });
    const followingDueAt = nextRecurringDueDate({
      baseDate: nextDueAt ?? new Date(),
      recurrence: data.recurrence,
      interval: data.recurrence_interval,
      dayOfWeek: data.recurrence_day_of_week,
      dayOfMonth: data.recurrence_day_of_month,
    });
    const { data: recurrenceTask, error: recurrenceError } = await getSupabaseAdmin().from("tasks").insert({
      title: data.title,
      description: data.description,
      type: data.type,
      status: "TO_DO",
      priority: data.priority,
      due_date: nextDueAt?.toISOString() ?? null,
      client_id: data.client_id,
      project_id: data.project_id,
      assigned_to: data.assigned_to,
      created_by: data.created_by ?? user.id,
      recurrence: data.recurrence,
      recurrence_interval: data.recurrence_interval,
      recurrence_day_of_week: data.recurrence_day_of_week,
      recurrence_day_of_month: data.recurrence_day_of_month,
      recurrence_next_due_at: followingDueAt?.toISOString() ?? null,
      recurrence_parent_task_id: data.id,
    }).select("id").single();
    if (recurrenceError) throw recurrenceError;
    if (recurrenceTask?.id) await syncTaskToGoogleCalendar(recurrenceTask.id as string);
  }
  await syncTaskToGoogleCalendar(data.id);
  if (outcome || scrapReason) {
    await logActivity({
      action: parsed.status === "SCRAPPED" ? "TASK_SCRAPPED" : "TASK_OUTCOME_LOGGED",
      entityType: "Task",
      entityId: data.id,
      taskId: data.id,
      clientId: data.client_id,
      projectId: data.project_id,
      actorId: user.id,
      message: `${data.title}: ${outcome || scrapReason}`,
    });
  }
  revalidatePath(path(formData, "/tasks"));
}

export async function upsertCompanySettings(formData: FormData) {
  await requirePermission(permissions.settingsManage);
  const parsed = companySettingsSchema.parse({
    companyName: str(formData, "companyName"),
    billingEmail: str(formData, "billingEmail"),
    bankName: str(formData, "bankName"),
    bankAccountName: str(formData, "bankAccountName"),
    bankAccountNumber: str(formData, "bankAccountNumber"),
    bankBranchCode: str(formData, "bankBranchCode"),
    paymentTerms: str(formData, "paymentTerms"),
    quoteFooter: str(formData, "quoteFooter"),
    invoiceFooter: str(formData, "invoiceFooter"),
  });
  await getSupabaseAdmin()
    .from("company_settings")
    .upsert({
      id: true,
      company_name: parsed.companyName,
      billing_email: parsed.billingEmail ?? null,
      bank_name: parsed.bankName ?? null,
      bank_account_name: parsed.bankAccountName ?? null,
      bank_account_number: parsed.bankAccountNumber ?? null,
      bank_branch_code: parsed.bankBranchCode ?? null,
      payment_terms: parsed.paymentTerms ?? null,
      quote_footer: parsed.quoteFooter ?? null,
      invoice_footer: parsed.invoiceFooter ?? null,
    });
  revalidatePath("/settings");
  redirect("/settings");
}

export async function updateRolePermissions(formData: FormData) {
  await requirePermission(permissions.settingsManage);
  const roleId = str(formData, "roleId");
  const selectedPermissions = formData
    .getAll("permissions")
    .map((value) => String(value));
  const { error } = await getSupabaseAdmin()
    .from("roles")
    .update({ permissions: selectedPermissions })
    .eq("id", roleId);
  if (error) throw error;
  revalidatePath("/settings");
  redirect("/settings");
}

export async function createPayrollRun(formData: FormData) {
  const user = await requirePermission(permissions.payrollWrite);
  if (!(await reserveSubmission(user.id, formData, "payroll-run:create")))
    redirect("/payroll");
  const parsed = payrollRunSchema.parse({
    periodStart: str(formData, "periodStart"),
    periodEnd: str(formData, "periodEnd"),
    status: str(formData, "status") || "DRAFT",
    notes: str(formData, "notes"),
  });
  const { data, error } = await getSupabaseAdmin()
    .from("payroll_runs")
    .insert({
      period_start: parsed.periodStart.toISOString().slice(0, 10),
      period_end: parsed.periodEnd.toISOString().slice(0, 10),
      status: parsed.status,
      notes: parsed.notes ?? null,
      created_by: user.id,
    })
    .select("id")
    .single();
  if (error) throw error;
  await logActivity({
    action: "PAYROLL_RUN_CREATED",
    entityType: "PayrollRun",
    entityId: data.id,
    actorId: user.id,
    message: "Payroll run created",
  });
  revalidatePath("/payroll");
  redirect("/payroll");
}

export async function addPayrollItem(formData: FormData) {
  const user = await requirePermission(permissions.payrollWrite);
  if (!(await reserveSubmission(user.id, formData, "payroll-item:create")))
    redirect("/payroll");
  const parsed = payrollItemSchema.parse({
    payrollRunId: str(formData, "payrollRunId"),
    userId: str(formData, "userId"),
    payType: str(formData, "payType"),
    hours: str(formData, "hours"),
    grossPayCents: randsToCents(formData.get("grossPayRands")),
    deductionsCents: randsToCents(formData.get("deductionsRands")),
    notes: str(formData, "notes"),
  });
  const selectedUser = await getSupabaseAdmin()
    .from("users")
    .select("name,title,role:roles(name)")
    .eq("id", parsed.userId)
    .maybeSingle();
  const role = selectedUser.data?.role as { name?: string } | { name?: string }[] | null | undefined;
  const roleName = Array.isArray(role) ? role[0]?.name : role?.name;
  const roleSnapshot = [selectedUser.data?.title, roleName].filter(Boolean).join(" / ") || null;
  const { data, error } = await getSupabaseAdmin()
    .from("payroll_items")
    .insert({
      payroll_run_id: parsed.payrollRunId,
      user_id: parsed.userId,
      role_snapshot: roleSnapshot,
      pay_type: parsed.payType,
      hours: parsed.hours,
      gross_pay_cents: parsed.grossPayCents,
      deductions_cents: parsed.deductionsCents,
      notes: parsed.notes ?? null,
    })
    .select("id")
    .single();
  if (error) throw error;
  await getSupabaseAdmin().from("expenses").insert({
    vendor: selectedUser.data?.name ?? "Employee payroll",
    category: "Payroll",
    amount_cents: parsed.grossPayCents,
    status: "PENDING",
    expense_date: new Date().toISOString().slice(0, 10),
    notes: parsed.notes ?? "Payroll item",
    created_by: user.id,
    recurrence: "NONE",
  });
  await logActivity({
    action: "PAYROLL_ITEM_ADDED",
    entityType: "PayrollItem",
    entityId: data.id,
    actorId: user.id,
    message: "Payroll line item added",
  });
  revalidatePath("/payroll");
  redirect("/payroll");
}

export async function createDocumentTemplate(formData: FormData) {
  await requirePermission(permissions.settingsManage);
  const parsed = documentTemplateSchema.parse({
    id: str(formData, "id"),
    name: str(formData, "name"),
    type: str(formData, "type"),
    content: str(formData, "content"),
    isDefault: bool(formData, "isDefault"),
  });
  const payload = {
    name: parsed.name,
    type: parsed.type,
    content: parsed.content,
    is_default: parsed.isDefault,
  };
  const result = parsed.id
    ? await getSupabaseAdmin().from("document_templates").update(payload).eq("id", parsed.id)
    : await getSupabaseAdmin().from("document_templates").insert(payload);
  if (result.error) throw result.error;
  revalidatePath("/settings");
  redirect("/settings");
}
