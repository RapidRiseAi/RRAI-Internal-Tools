"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSession, destroySession, requirePermission } from "./auth";
import { permissions } from "./constants";
import { getSupabaseAdmin } from "./supabase";
import { clientSchema, leadSchema, taskSchema, userSchema } from "./validation";

function str(formData: FormData, key: string) {
  return String(formData.get(key) ?? "");
}

async function logActivity(input: { action: string; entityType: string; entityId: string; message: string; actorId?: string; leadId?: string; clientId?: string; taskId?: string }) {
  await getSupabaseAdmin().from("activity_logs").insert({
    action: input.action,
    entity_type: input.entityType,
    entity_id: input.entityId,
    message: input.message,
    actor_id: input.actorId ?? null,
    lead_id: input.leadId ?? null,
    client_id: input.clientId ?? null,
    task_id: input.taskId ?? null,
  });
}

export async function loginAction(_previousState: { error?: string } | null, formData: FormData) {
  const email = str(formData, "email").trim().toLowerCase();
  const password = str(formData, "password");
  const supabase = getSupabaseAdmin();
  const { data: user, error } = await supabase.from("users").select("id,email,password_hash,status").eq("email", email).maybeSingle();

  if (error || !user || user.status !== "ACTIVE") return { error: "Invalid login details." };
  const ok = await bcrypt.compare(password, user.password_hash as string);
  if (!ok) return { error: "Invalid login details." };

  await supabase.from("users").update({ last_login_at: new Date().toISOString() }).eq("id", user.id as string);
  await createSession(user.id as string);
  redirect("/dashboard");
}

export async function logoutAction() {
  await destroySession();
  redirect("/login");
}

export async function upsertLead(formData: FormData) {
  const user = await requirePermission(permissions.leadsWrite);
  const id = str(formData, "id") || undefined;
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
  const supabase = getSupabaseAdmin();
  const result = id
    ? await supabase.from("leads").update(payload).eq("id", id).select("id,company_name").single()
    : await supabase.from("leads").insert(payload).select("id,company_name").single();
  if (result.error) throw result.error;
  await logActivity({ action: id ? "LEAD_UPDATED" : "LEAD_CREATED", entityType: "Lead", entityId: result.data.id, leadId: result.data.id, actorId: user.id, message: `${result.data.company_name} ${id ? "updated" : "created"}` });
  revalidatePath("/leads");
  revalidatePath("/dashboard");
  redirect(`/leads/${result.data.id}`);
}

export async function archiveLead(formData: FormData) {
  const user = await requirePermission(permissions.leadsWrite);
  const id = str(formData, "id");
  const { data, error } = await getSupabaseAdmin().from("leads").update({ archived_at: new Date().toISOString() }).eq("id", id).select("id,company_name").single();
  if (error) throw error;
  await logActivity({ action: "LEAD_ARCHIVED", entityType: "Lead", entityId: id, leadId: id, actorId: user.id, message: `${data.company_name} archived` });
  revalidatePath("/leads");
  redirect("/leads");
}

export async function convertLeadToClient(formData: FormData) {
  const user = await requirePermission(permissions.clientsWrite);
  const leadId = str(formData, "leadId");
  const supabase = getSupabaseAdmin();
  const { data: lead, error: leadError } = await supabase.from("leads").select("*").eq("id", leadId).single();
  if (leadError || !lead) throw leadError ?? new Error("Lead not found");
  if (lead.converted_client_id) redirect(`/clients/${lead.converted_client_id}`);

  const { data: client, error } = await supabase.from("clients").insert({
    company_name: lead.company_name,
    primary_email: lead.email,
    primary_phone: lead.phone,
    next_action: "Complete client onboarding and create first project.",
  }).select("id,company_name").single();
  if (error) throw error;

  await supabase.from("contacts").insert({ client_id: client.id, name: lead.contact_name, email: lead.email, phone: lead.phone, is_primary: true });
  await supabase.from("leads").update({ stage: "WON", converted_client_id: client.id }).eq("id", leadId);
  await logActivity({ action: "LEAD_CONVERTED_TO_CLIENT", entityType: "Client", entityId: client.id, clientId: client.id, leadId, actorId: user.id, message: `${client.company_name} converted to client` });
  revalidatePath("/leads");
  revalidatePath("/clients");
  redirect(`/clients/${client.id}`);
}

export async function upsertClient(formData: FormData) {
  const user = await requirePermission(permissions.clientsWrite);
  const id = str(formData, "id") || undefined;
  const parsed = clientSchema.parse({
    companyName: str(formData, "companyName"),
    accountStatus: str(formData, "accountStatus"),
    industry: str(formData, "industry"),
    website: str(formData, "website"),
    primaryEmail: str(formData, "primaryEmail"),
    primaryPhone: str(formData, "primaryPhone"),
    nextAction: str(formData, "nextAction"),
    mrrCents: formData.get("mrrCents"),
  });
  const payload = { company_name: parsed.companyName, account_status: parsed.accountStatus, industry: parsed.industry ?? null, website: parsed.website ?? null, primary_email: parsed.primaryEmail ?? null, primary_phone: parsed.primaryPhone ?? null, next_action: parsed.nextAction ?? null, mrr_cents: parsed.mrrCents };
  const result = id
    ? await getSupabaseAdmin().from("clients").update(payload).eq("id", id).select("id,company_name").single()
    : await getSupabaseAdmin().from("clients").insert(payload).select("id,company_name").single();
  if (result.error) throw result.error;
  await logActivity({ action: id ? "CLIENT_UPDATED" : "CLIENT_CREATED", entityType: "Client", entityId: result.data.id, clientId: result.data.id, actorId: user.id, message: `${result.data.company_name} ${id ? "updated" : "created"}` });
  revalidatePath("/clients");
  redirect(`/clients/${result.data.id}`);
}

export async function upsertTask(formData: FormData) {
  const user = await requirePermission(permissions.tasksWrite);
  const parsed = taskSchema.parse({ title: str(formData, "title"), description: str(formData, "description"), type: str(formData, "type"), status: str(formData, "status"), priority: str(formData, "priority"), dueDate: str(formData, "dueDate"), projectId: str(formData, "projectId"), assignedToId: str(formData, "assignedToId") });
  const { data, error } = await getSupabaseAdmin().from("tasks").insert({ title: parsed.title, description: parsed.description ?? null, type: parsed.type, status: parsed.status, priority: parsed.priority, due_date: parsed.dueDate?.toISOString() ?? null, project_id: parsed.projectId ?? null, assigned_to: parsed.assignedToId ?? null, created_by: user.id, completed_at: parsed.status === "DONE" ? new Date().toISOString() : null }).select("id,title").single();
  if (error) throw error;
  await logActivity({ action: parsed.status === "DONE" ? "TASK_COMPLETED" : "TASK_CREATED", entityType: "Task", entityId: data.id, taskId: data.id, actorId: user.id, message: `${data.title} created` });
  revalidatePath("/tasks");
  redirect("/tasks");
}

export async function upsertUser(formData: FormData) {
  await requirePermission(permissions.settingsManage);
  const parsed = userSchema.parse({ name: str(formData, "name"), email: str(formData, "email").toLowerCase(), password: str(formData, "password"), roleId: str(formData, "roleId"), title: str(formData, "title"), phone: str(formData, "phone"), status: str(formData, "status") });
  if (!parsed.password) throw new Error("Password is required for new users.");
  const { error } = await getSupabaseAdmin().from("users").insert({ name: parsed.name, email: parsed.email, password_hash: await bcrypt.hash(parsed.password, 12), role_id: parsed.roleId, title: parsed.title ?? null, phone: parsed.phone ?? null, status: parsed.status });
  if (error) throw error;
  revalidatePath("/settings");
  redirect("/settings");
}
