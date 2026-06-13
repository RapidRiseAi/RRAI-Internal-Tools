"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSession, destroySession, requirePermission } from "./auth";
import { permissions } from "./constants";
import { getSupabaseAdmin } from "./supabase";
import { affiliateSchema, campaignSchema, checklistItemSchema, checklistTemplateSchema, clientSchema, commissionSchema, companySettingsSchema, contentItemSchema, documentTemplateSchema, fileRecordSchema, invoiceSchema, knowledgeBaseSchema, leadCallSchema, leadSchema, noteSchema, paymentSchema, projectChecklistSchema, projectSchema, quoteSchema, referralSchema, retainerSchema, serviceSchema, supportTicketSchema, taskSchema, taskStatusSchema, userSchema } from "./validation";

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
  const descriptions = formData.getAll("itemDescription").map((value) => String(value).trim());
  return descriptions.map((description, index) => ({
    service_id: String(formData.getAll("serviceId")[index] ?? "") || null,
    description,
    quantity: Math.max(1, positiveInt(formData.getAll("itemQuantity")[index] ?? null, 1)),
    once_off_cents: positiveInt(formData.getAll("itemOnceOffCents")[index] ?? null, 0),
    monthly_cents: positiveInt(formData.getAll("itemMonthlyCents")[index] ?? null, 0),
    sort_order: index,
  })).filter((item) => item.description);
}

function parseInvoiceLineItems(formData: FormData) {
  const descriptions = formData.getAll("invoiceItemDescription").map((value) => String(value).trim());
  return descriptions.map((description, index) => ({
    description,
    quantity: Math.max(1, positiveInt(formData.getAll("invoiceItemQuantity")[index] ?? null, 1)),
    unit_amount_cents: positiveInt(formData.getAll("invoiceItemUnitCents")[index] ?? null, 0),
    sort_order: index,
  })).filter((item) => item.description);
}

function numberCode(prefix: string) {
  return `${prefix}-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
}

function trackingCode(name: string) {
  return `${name.replace(/[^a-z0-9]/gi, "").slice(0, 6).toUpperCase() || "RRAI"}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

async function reserveSubmission(userId: string, formData: FormData, action: string) {
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

async function logActivity(input: { action: string; entityType: string; entityId: string; message: string; actorId?: string; leadId?: string | null; clientId?: string | null; quoteId?: string | null; projectId?: string | null; taskId?: string | null }) {
  await getSupabaseAdmin().from("activity_logs").insert({
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

async function seedProjectChecklist(projectId: string) {
  const supabase = getSupabaseAdmin();
  const { data: templates } = await supabase.from("checklist_items").select("id,title").order("sort_order").limit(12);
  const rows = (templates?.length ? templates : [
    { id: null, title: "Confirm project scope and success criteria" },
    { id: null, title: "Collect client content, access and brand assets" },
    { id: null, title: "Complete build and internal QA" },
    { id: null, title: "Client review, revisions and launch handover" },
  ]).map((item) => ({ project_id: projectId, template_item_id: item.id, title: item.title, status: "TO_DO" }));
  await supabase.from("project_checklists").insert(rows);
}

async function insertInvoiceRecord(payload: Record<string, string | number | null>) {
  const supabase = getSupabaseAdmin();
  const result = await supabase.from("invoices").insert(payload).select("id,invoice_number,client_id").single();
  if (!result.error || result.error.code !== "42703" || !("quote_id" in payload)) return result;

  const fallbackPayload = { ...payload };
  delete fallbackPayload.quote_id;
  return supabase.from("invoices").insert(fallbackPayload).select("id,invoice_number,client_id").single();
}

export async function loginAction(_previousState: { error?: string; success?: boolean } | null, formData: FormData) {
  const email = str(formData, "email").trim().toLowerCase();
  const password = str(formData, "password");
  const supabase = getSupabaseAdmin();
  const { data: user, error } = await supabase.from("users").select("id,email,password_hash,status").eq("email", email).maybeSingle();

  if (error || !user || user.status !== "ACTIVE") return { error: "Invalid login details." };
  const ok = await bcrypt.compare(password, user.password_hash as string);
  if (!ok) return { error: "Invalid login details." };

  await supabase.from("users").update({ last_login_at: new Date().toISOString() }).eq("id", user.id as string);
  await createSession(user.id as string);
  return { success: true };
}

export async function logoutAction() {
  await destroySession();
  redirect("/login");
}

export async function upsertLead(formData: FormData) {
  const user = await requirePermission(permissions.leadsWrite);
  const id = str(formData, "id") || undefined;
  if (!id && !(await reserveSubmission(user.id, formData, "lead:create"))) redirect("/leads");
  const parsed = leadSchema.parse({ companyName: str(formData, "companyName"), contactName: str(formData, "contactName"), email: str(formData, "email"), phone: str(formData, "phone"), source: str(formData, "source"), serviceInterest: str(formData, "serviceInterest"), stage: str(formData, "stage"), score: formData.get("score"), followUpDate: str(formData, "followUpDate"), nextAction: str(formData, "nextAction"), painPoints: str(formData, "painPoints"), assignedToId: str(formData, "assignedToId") });
  const payload = { company_name: parsed.companyName, contact_name: parsed.contactName, email: parsed.email ?? null, phone: parsed.phone ?? null, source: parsed.source, service_interest: parsed.serviceInterest, stage: parsed.stage, score: parsed.score, follow_up_date: parsed.followUpDate?.toISOString() ?? null, next_action: parsed.nextAction ?? null, pain_points: parsed.painPoints ?? null, assigned_to: parsed.assignedToId ?? null, ...(id ? {} : { created_by: user.id }) };
  const result = id ? await getSupabaseAdmin().from("leads").update(payload).eq("id", id).select("id,company_name").single() : await getSupabaseAdmin().from("leads").insert(payload).select("id,company_name").single();
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
  if (!(await reserveSubmission(user.id, formData, "lead:convert"))) redirect("/clients");
  const leadId = str(formData, "leadId");
  const supabase = getSupabaseAdmin();
  const { data: lead, error: leadError } = await supabase.from("leads").select("*").eq("id", leadId).single();
  if (leadError || !lead) throw leadError ?? new Error("Lead not found");
  if (lead.converted_client_id) redirect(`/clients/${lead.converted_client_id}`);
  const { data: client, error } = await supabase.from("clients").insert({ company_name: lead.company_name, primary_email: lead.email, primary_phone: lead.phone, next_action: "Complete client onboarding and create first project." }).select("id,company_name").single();
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
  if (!id && !(await reserveSubmission(user.id, formData, "client:create"))) redirect("/clients");
  const parsed = clientSchema.parse({ companyName: str(formData, "companyName"), accountStatus: str(formData, "accountStatus"), industry: str(formData, "industry"), website: str(formData, "website"), primaryEmail: str(formData, "primaryEmail"), primaryPhone: str(formData, "primaryPhone"), nextAction: str(formData, "nextAction"), mrrCents: randsToCents(formData.get("mrrRands")) });
  const payload = { company_name: parsed.companyName, account_status: parsed.accountStatus, industry: parsed.industry ?? null, website: parsed.website ?? null, primary_email: parsed.primaryEmail ?? null, primary_phone: parsed.primaryPhone ?? null, next_action: parsed.nextAction ?? null, mrr_cents: parsed.mrrCents };
  const result = id ? await getSupabaseAdmin().from("clients").update(payload).eq("id", id).select("id,company_name").single() : await getSupabaseAdmin().from("clients").insert(payload).select("id,company_name").single();
  if (result.error) throw result.error;
  await logActivity({ action: id ? "CLIENT_UPDATED" : "CLIENT_CREATED", entityType: "Client", entityId: result.data.id, clientId: result.data.id, actorId: user.id, message: `${result.data.company_name} ${id ? "updated" : "created"}` });
  revalidatePath("/clients");
  redirect(`/clients/${result.data.id}`);
}

export async function upsertTask(formData: FormData) {
  const user = await requirePermission(permissions.tasksWrite);
  const id = str(formData, "id") || undefined;
  if (!id && !(await reserveSubmission(user.id, formData, "task:create"))) redirect(path(formData, "/tasks"));
  const parsed = taskSchema.parse({ title: str(formData, "title"), description: str(formData, "description"), type: str(formData, "type"), status: str(formData, "status"), priority: str(formData, "priority"), dueDate: str(formData, "dueDate"), clientId: str(formData, "clientId"), projectId: str(formData, "projectId"), assignedToId: str(formData, "assignedToId") });
  const payload = { title: parsed.title, description: parsed.description ?? null, type: parsed.type, status: parsed.status, priority: parsed.priority, due_date: parsed.dueDate?.toISOString() ?? null, client_id: parsed.clientId ?? null, project_id: parsed.projectId ?? null, assigned_to: parsed.assignedToId ?? null, completed_at: parsed.status === "DONE" ? new Date().toISOString() : null, ...(id ? {} : { created_by: user.id }) };
  const result = id ? await getSupabaseAdmin().from("tasks").update(payload).eq("id", id).select("id,title").single() : await getSupabaseAdmin().from("tasks").insert(payload).select("id,title").single();
  if (result.error) throw result.error;
  await logActivity({ action: parsed.status === "DONE" ? "TASK_COMPLETED" : id ? "TASK_UPDATED" : "TASK_CREATED", entityType: "Task", entityId: result.data.id, taskId: result.data.id, clientId: parsed.clientId, projectId: parsed.projectId, actorId: user.id, message: `${result.data.title} ${id ? "updated" : "created"}` });
  revalidatePath("/tasks");
  redirect(path(formData, "/tasks"));
}

export async function upsertUser(formData: FormData) {
  const user = await requirePermission(permissions.settingsManage);
  if (!(await reserveSubmission(user.id, formData, "user:create"))) redirect("/settings");
  const parsed = userSchema.parse({ name: str(formData, "name"), email: str(formData, "email").toLowerCase(), password: str(formData, "password"), roleId: str(formData, "roleId"), title: str(formData, "title"), phone: str(formData, "phone"), status: str(formData, "status") });
  if (!parsed.password) throw new Error("Password is required for new users.");
  const { error } = await getSupabaseAdmin().from("users").insert({ name: parsed.name, email: parsed.email, password_hash: await bcrypt.hash(parsed.password, 12), role_id: parsed.roleId, title: parsed.title ?? null, phone: parsed.phone ?? null, status: parsed.status });
  if (error) throw error;
  revalidatePath("/settings");
  redirect("/settings");
}

export async function upsertQuote(formData: FormData) {
  const user = await requirePermission(permissions.quotesWrite);
  const id = str(formData, "id") || undefined;
  if (!id && !(await reserveSubmission(user.id, formData, "quote:create"))) redirect("/quotes");
  const lineItems = parseQuoteLineItems(formData);
  if (!lineItems.length) throw new Error("Add at least one quote line item.");
  const parsed = quoteSchema.parse({ title: str(formData, "title"), status: str(formData, "status"), clientId: str(formData, "clientId"), leadId: str(formData, "leadId"), validUntil: str(formData, "validUntil"), internalNotes: str(formData, "internalNotes"), itemDescription: lineItems[0].description, itemQuantity: lineItems[0].quantity, itemOnceOffCents: lineItems[0].once_off_cents, itemMonthlyCents: lineItems[0].monthly_cents, serviceId: lineItems[0].service_id ?? "" });
  const onceOff = lineItems.reduce((sum, item) => sum + item.quantity * item.once_off_cents, 0);
  const monthly = lineItems.reduce((sum, item) => sum + item.quantity * item.monthly_cents, 0);
  const quotePayload = { title: parsed.title, status: parsed.status, client_id: parsed.clientId ?? null, lead_id: parsed.leadId ?? null, valid_until: parsed.validUntil?.toISOString() ?? null, internal_notes: parsed.internalNotes ?? null, once_off_total_cents: onceOff, monthly_total_cents: monthly, ...(parsed.status === "SENT" ? { sent_at: new Date().toISOString() } : {}), ...(parsed.status === "ACCEPTED" ? { accepted_at: new Date().toISOString() } : {}) };
  const supabase = getSupabaseAdmin();
  const result = id ? await supabase.from("quotes").update(quotePayload).eq("id", id).select("id,title,client_id,lead_id").single() : await supabase.from("quotes").insert({ ...quotePayload, quote_number: numberCode("Q") }).select("id,title,client_id,lead_id").single();
  if (result.error) throw result.error;
  await supabase.from("quote_items").delete().eq("quote_id", result.data.id);
  await supabase.from("quote_items").insert(lineItems.map((item) => ({ ...item, quote_id: result.data.id })));
  await logActivity({ action: id ? "QUOTE_UPDATED" : "QUOTE_CREATED", entityType: "Quote", entityId: result.data.id, quoteId: result.data.id, clientId: result.data.client_id, leadId: result.data.lead_id, actorId: user.id, message: `${result.data.title} ${id ? "updated" : "created"}` });
  revalidatePath("/quotes");
  redirect("/quotes");
}

export async function acceptQuote(formData: FormData) {
  const user = await requirePermission(permissions.quotesWrite);
  if (!(await reserveSubmission(user.id, formData, "quote:accept"))) redirect("/quotes");
  const id = str(formData, "id");
  const supabase = getSupabaseAdmin();
  const { data: quote, error } = await supabase.from("quotes").select("*").eq("id", id).single();
  if (error || !quote) throw error ?? new Error("Quote not found");
  let clientId = quote.client_id as string | null;
  if (!clientId && quote.lead_id) {
    const { data: lead } = await supabase.from("leads").select("*").eq("id", quote.lead_id).single();
    if (lead) {
      const { data: client, error: clientError } = await supabase.from("clients").insert({ company_name: lead.company_name, primary_email: lead.email, primary_phone: lead.phone, next_action: "Accepted quote: confirm onboarding and kickoff." }).select("id").single();
      if (clientError) throw clientError;
      clientId = client.id;
      await supabase.from("leads").update({ stage: "WON", converted_client_id: client.id }).eq("id", quote.lead_id);
      await supabase.from("quotes").update({ client_id: client.id }).eq("id", id);
    }
  }
  if (!clientId) throw new Error("A quote must be linked to a client or lead before acceptance.");
  await supabase.from("quotes").update({ status: "ACCEPTED", accepted_at: quote.accepted_at ?? new Date().toISOString(), client_id: clientId }).eq("id", id);
  const { data: existingProject, error: existingProjectError } = await supabase.from("projects").select("id,name").eq("quote_id", id).maybeSingle();
  if (existingProjectError) throw existingProjectError;
  let project = existingProject;
  if (!project) {
    const { data: createdProject, error: projectError } = await supabase.from("projects").insert({ client_id: clientId, quote_id: id, name: quote.title, status: "NOT_STARTED", stage: "Kickoff", priority: "MEDIUM", progress: 0 }).select("id,name").single();
    if (projectError) throw projectError;
    project = createdProject;
  }
  if (!project) throw new Error("Project could not be created from the accepted quote.");
  if (!existingProject) await seedProjectChecklist(project.id);
  if (!existingProject && quote.once_off_total_cents > 0) {
    const { error: invoiceError } = await insertInvoiceRecord({ client_id: clientId, quote_id: id, invoice_number: numberCode("INV"), status: "SENT", amount_cents: quote.once_off_total_cents, issued_at: new Date().toISOString(), due_date: new Date(Date.now() + 7 * 86400000).toISOString() });
    if (invoiceError) throw invoiceError;
  }
  if (!existingProject && quote.monthly_total_cents > 0) await supabase.from("retainers").insert({ client_id: clientId, type: `${quote.title} retainer`, status: "ACTIVE", monthly_amount_cents: quote.monthly_total_cents, next_billing_date: new Date(Date.now() + 30 * 86400000).toISOString() });
  await logActivity({ action: "QUOTE_ACCEPTED", entityType: "Quote", entityId: id, quoteId: id, projectId: project.id, clientId, leadId: quote.lead_id, actorId: user.id, message: `${quote.title} accepted; project, checklist and finance records created` });
  revalidatePath("/quotes");
  revalidatePath("/projects");
  redirect(`/projects/${project.id}`);
}

export async function upsertProject(formData: FormData) {
  const user = await requirePermission(permissions.projectsWrite);
  const id = str(formData, "id") || undefined;
  if (!id && !(await reserveSubmission(user.id, formData, "project:create"))) redirect("/projects");
  const parsed = projectSchema.parse({ name: str(formData, "name"), clientId: str(formData, "clientId"), quoteId: str(formData, "quoteId"), status: str(formData, "status"), stage: str(formData, "stage"), priority: str(formData, "priority"), deadline: str(formData, "deadline"), progress: formData.get("progress"), blocker: str(formData, "blocker"), seedChecklist: bool(formData, "seedChecklist") });
  const payload = { name: parsed.name, client_id: parsed.clientId, quote_id: parsed.quoteId ?? null, status: parsed.status, stage: parsed.stage ?? null, priority: parsed.priority, deadline: parsed.deadline?.toISOString() ?? null, progress: parsed.progress, blocker: parsed.blocker ?? null };
  const result = id ? await getSupabaseAdmin().from("projects").update(payload).eq("id", id).select("id,name,client_id").single() : await getSupabaseAdmin().from("projects").insert(payload).select("id,name,client_id").single();
  if (result.error) throw result.error;
  if (!id && parsed.seedChecklist) await seedProjectChecklist(result.data.id);
  await logActivity({ action: id ? "PROJECT_UPDATED" : "PROJECT_CREATED", entityType: "Project", entityId: result.data.id, projectId: result.data.id, clientId: result.data.client_id, actorId: user.id, message: `${result.data.name} ${id ? "updated" : "created"}` });
  revalidatePath("/projects");
  redirect(`/projects/${result.data.id}`);
}

export async function updateProjectChecklist(formData: FormData) {
  const user = await requirePermission(permissions.projectsWrite);
  if (!(await reserveSubmission(user.id, formData, "project-checklist:update"))) return;
  const parsed = projectChecklistSchema.parse({ id: str(formData, "id"), status: str(formData, "status") });
  await getSupabaseAdmin().from("project_checklists").update({ status: parsed.status, completed_at: parsed.status === "DONE" ? new Date().toISOString() : null }).eq("id", parsed.id);
  revalidatePath(path(formData, "/projects"));
}

export async function upsertInvoice(formData: FormData) {
  const user = await requirePermission(permissions.billingWrite);
  if (!(await reserveSubmission(user.id, formData, "invoice:create"))) redirect("/billing");
  const lineItems = parseInvoiceLineItems(formData);
  if (!lineItems.length) throw new Error("Add at least one invoice line item.");
  const amountCents = lineItems.reduce((sum, item) => sum + item.quantity * item.unit_amount_cents, 0);
  const parsed = invoiceSchema.parse({ invoiceNumber: str(formData, "invoiceNumber"), clientId: str(formData, "clientId"), quoteId: str(formData, "quoteId"), status: str(formData, "status"), amountCents, dueDate: str(formData, "dueDate") });
  const { data, error } = await insertInvoiceRecord({ invoice_number: parsed.invoiceNumber ?? numberCode("INV"), client_id: parsed.clientId, quote_id: parsed.quoteId ?? null, status: parsed.status, amount_cents: parsed.amountCents, due_date: parsed.dueDate?.toISOString() ?? null, issued_at: new Date().toISOString() });
  if (error) throw error;
  const { error: itemError } = await getSupabaseAdmin().from("invoice_items").insert(lineItems.map((item) => ({ ...item, invoice_id: data.id })));
  if (itemError && itemError.code !== "42P01") throw itemError;
  await logActivity({ action: "INVOICE_CREATED", entityType: "Invoice", entityId: data.id, clientId: data.client_id, actorId: user.id, message: `${data.invoice_number} created with ${lineItems.length} line item${lineItems.length === 1 ? "" : "s"}` });
  revalidatePath("/billing");
  redirect("/billing");
}

export async function recordPayment(formData: FormData) {
  const user = await requirePermission(permissions.billingWrite);
  if (!(await reserveSubmission(user.id, formData, "payment:create"))) redirect("/billing");
  const parsed = paymentSchema.parse({ invoiceId: str(formData, "invoiceId"), amountCents: randsToCents(formData.get("amountRands")), status: str(formData, "status"), method: str(formData, "method"), reference: str(formData, "reference") });
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from("payments").insert({ invoice_id: parsed.invoiceId, amount_cents: parsed.amountCents, status: parsed.status, method: parsed.method ?? null, reference: parsed.reference ?? null, paid_at: parsed.status === "PAID" ? new Date().toISOString() : null }).select("id,invoice_id").single();
  if (error) throw error;
  if (parsed.status === "PAID") await supabase.from("invoices").update({ status: "PAID" }).eq("id", parsed.invoiceId);
  await logActivity({ action: "PAYMENT_RECORDED", entityType: "Payment", entityId: data.id, actorId: user.id, message: `Payment recorded for invoice ${data.invoice_id}` });
  revalidatePath("/billing");
  redirect("/billing");
}

export async function upsertRetainer(formData: FormData) {
  const user = await requirePermission(permissions.billingWrite);
  if (!(await reserveSubmission(user.id, formData, "retainer:create"))) redirect("/retainers");
  const parsed = retainerSchema.parse({ clientId: str(formData, "clientId"), type: str(formData, "type"), status: str(formData, "status"), monthlyAmountCents: randsToCents(formData.get("monthlyAmountRands")), nextBillingDate: str(formData, "nextBillingDate") });
  const { data, error } = await getSupabaseAdmin().from("retainers").insert({ client_id: parsed.clientId, type: parsed.type, status: parsed.status, monthly_amount_cents: parsed.monthlyAmountCents, next_billing_date: parsed.nextBillingDate?.toISOString() ?? null }).select("id,type,client_id").single();
  if (error) throw error;
  await logActivity({ action: "RETAINER_CREATED", entityType: "Retainer", entityId: data.id, clientId: data.client_id, actorId: user.id, message: `${data.type} retainer created` });
  revalidatePath("/retainers");
  redirect("/retainers");
}

export async function upsertSupportTicket(formData: FormData) {
  const user = await requirePermission(permissions.supportWrite);
  const id = str(formData, "id") || undefined;
  if (!id && !(await reserveSubmission(user.id, formData, "support-ticket:create"))) redirect("/support");
  const parsed = supportTicketSchema.parse({ title: str(formData, "title"), category: str(formData, "category"), priority: str(formData, "priority"), status: str(formData, "status"), clientId: str(formData, "clientId"), projectId: str(formData, "projectId"), assignedToId: str(formData, "assignedToId"), internalNotes: str(formData, "internalNotes"), clientUpdateNotes: str(formData, "clientUpdateNotes"), resolutionNotes: str(formData, "resolutionNotes") });
  const payload = { title: parsed.title, category: parsed.category, priority: parsed.priority, status: parsed.status, client_id: parsed.clientId ?? null, project_id: parsed.projectId ?? null, assigned_to: parsed.assignedToId ?? null, internal_notes: parsed.internalNotes ?? null, client_update_notes: parsed.clientUpdateNotes ?? null, resolution_notes: parsed.resolutionNotes ?? null, resolved_at: ["RESOLVED", "CLOSED"].includes(parsed.status) ? new Date().toISOString() : null };
  const result = id ? await getSupabaseAdmin().from("support_tickets").update(payload).eq("id", id).select("id,title,client_id,project_id").single() : await getSupabaseAdmin().from("support_tickets").insert(payload).select("id,title,client_id,project_id").single();
  if (result.error) throw result.error;
  await logActivity({ action: id ? "TICKET_UPDATED" : "TICKET_CREATED", entityType: "SupportTicket", entityId: result.data.id, clientId: result.data.client_id, projectId: result.data.project_id, actorId: user.id, message: `${result.data.title} ${id ? "updated" : "created"}` });
  revalidatePath("/support");
  redirect("/support");
}

export async function upsertAffiliate(formData: FormData) {
  const user = await requirePermission(permissions.marketingWrite);
  if (!(await reserveSubmission(user.id, formData, "affiliate:create"))) redirect("/affiliates");
  const parsed = affiliateSchema.parse({ name: str(formData, "name"), email: str(formData, "email"), trackingCode: str(formData, "trackingCode"), status: str(formData, "status"), defaultCommissionType: str(formData, "defaultCommissionType"), defaultCommissionRate: formData.get("defaultCommissionRate") });
  const { error } = await getSupabaseAdmin().from("affiliates").insert({ name: parsed.name, email: parsed.email, tracking_code: parsed.trackingCode ?? trackingCode(parsed.name), status: parsed.status, default_commission_type: parsed.defaultCommissionType, default_commission_rate: parsed.defaultCommissionRate });
  if (error) throw error;
  revalidatePath("/affiliates");
  redirect("/affiliates");
}

export async function createReferral(formData: FormData) {
  const user = await requirePermission(permissions.marketingWrite);
  if (!(await reserveSubmission(user.id, formData, "referral:create"))) redirect("/affiliates");
  const parsed = referralSchema.parse({ affiliateId: str(formData, "affiliateId"), leadId: str(formData, "leadId"), clientId: str(formData, "clientId"), status: str(formData, "status") || "PENDING" });
  await getSupabaseAdmin().from("referrals").insert({ affiliate_id: parsed.affiliateId, lead_id: parsed.leadId ?? null, client_id: parsed.clientId ?? null, status: parsed.status });
  revalidatePath("/affiliates");
  redirect("/affiliates");
}

export async function createCommission(formData: FormData) {
  const user = await requirePermission(permissions.marketingWrite);
  if (!(await reserveSubmission(user.id, formData, "commission:create"))) redirect("/affiliates");
  const parsed = commissionSchema.parse({ affiliateId: str(formData, "affiliateId"), quoteId: str(formData, "quoteId"), projectId: str(formData, "projectId"), paymentId: str(formData, "paymentId"), status: str(formData, "status"), amountCents: randsToCents(formData.get("amountRands")), commissionType: str(formData, "commissionType") });
  await getSupabaseAdmin().from("commissions").insert({ affiliate_id: parsed.affiliateId, quote_id: parsed.quoteId ?? null, project_id: parsed.projectId ?? null, payment_id: parsed.paymentId ?? null, status: parsed.status, amount_cents: parsed.amountCents, commission_type: parsed.commissionType, paid_at: parsed.status === "PAID" ? new Date().toISOString() : null });
  revalidatePath("/affiliates");
  redirect("/affiliates");
}

export async function upsertCampaign(formData: FormData) {
  const user = await requirePermission(permissions.marketingWrite);
  if (!(await reserveSubmission(user.id, formData, "campaign:create"))) redirect("/marketing");
  const parsed = campaignSchema.parse({ name: str(formData, "name"), platform: str(formData, "platform"), targetIndustry: str(formData, "targetIndustry"), offerMessage: str(formData, "offerMessage"), numberContacted: formData.get("numberContacted"), replies: formData.get("replies"), callsBooked: formData.get("callsBooked"), quotesSent: formData.get("quotesSent"), dealsClosed: formData.get("dealsClosed") });
  await getSupabaseAdmin().from("campaigns").insert({ name: parsed.name, platform: parsed.platform, target_industry: parsed.targetIndustry ?? null, offer_message: parsed.offerMessage ?? null, number_contacted: parsed.numberContacted, replies: parsed.replies, calls_booked: parsed.callsBooked, quotes_sent: parsed.quotesSent, deals_closed: parsed.dealsClosed });
  revalidatePath("/marketing");
  redirect("/marketing");
}

export async function upsertContentItem(formData: FormData) {
  const user = await requirePermission(permissions.marketingWrite);
  if (!(await reserveSubmission(user.id, formData, "content-item:create"))) redirect("/marketing");
  const parsed = contentItemSchema.parse({ title: str(formData, "title"), status: str(formData, "status"), platform: str(formData, "platform"), postUrl: str(formData, "postUrl"), performanceNotes: str(formData, "performanceNotes"), leadsGenerated: formData.get("leadsGenerated") });
  await getSupabaseAdmin().from("content_items").insert({ title: parsed.title, status: parsed.status, platform: parsed.platform ?? null, post_url: parsed.postUrl ?? null, performance_notes: parsed.performanceNotes ?? null, leads_generated: parsed.leadsGenerated });
  revalidatePath("/marketing");
  redirect("/marketing");
}

export async function upsertKnowledgeBaseItem(formData: FormData) {
  const user = await requirePermission(permissions.settingsManage);
  if (!(await reserveSubmission(user.id, formData, "knowledge-base:create"))) redirect("/knowledge-base");
  const parsed = knowledgeBaseSchema.parse({ title: str(formData, "title"), category: str(formData, "category"), body: str(formData, "body"), visibility: str(formData, "visibility") });
  await getSupabaseAdmin().from("knowledge_base_items").insert({ title: parsed.title, category: parsed.category, body: parsed.body, visibility: parsed.visibility });
  revalidatePath("/knowledge-base");
  redirect("/knowledge-base");
}

export async function addNote(formData: FormData) {
  const user = await requirePermission(permissions.clientsWrite);
  if (!(await reserveSubmission(user.id, formData, "note:create"))) return;
  const parsed = noteSchema.parse({ body: str(formData, "body"), entityType: str(formData, "entityType"), entityId: str(formData, "entityId"), clientId: str(formData, "clientId"), leadId: str(formData, "leadId"), projectId: str(formData, "projectId") });
  const { error } = await getSupabaseAdmin().from("notes").insert({ body: parsed.body, entity_type: parsed.entityType, entity_id: parsed.entityId, client_id: parsed.clientId ?? null, lead_id: parsed.leadId ?? null, project_id: parsed.projectId ?? null });
  if (error) throw error;
  await logActivity({ action: "NOTE_ADDED", entityType: parsed.entityType, entityId: parsed.entityId, clientId: parsed.clientId, leadId: parsed.leadId, projectId: parsed.projectId, actorId: user.id, message: "Note added" });
  revalidatePath(path(formData, "/dashboard"));
}

export async function addFileRecord(formData: FormData) {
  const entityType = str(formData, "entityType");
  const user = await requirePermission(entityType === "Lead" ? permissions.leadsWrite : permissions.clientsWrite);
  if (!(await reserveSubmission(user.id, formData, "file-record:create"))) return;
  const parsed = fileRecordSchema.parse({ filename: str(formData, "filename"), url: str(formData, "url"), mimeType: str(formData, "mimeType"), entityType, entityId: str(formData, "entityId"), clientId: str(formData, "clientId"), projectId: str(formData, "projectId") });
  await getSupabaseAdmin().from("files").insert({ filename: parsed.filename, url: parsed.url, mime_type: parsed.mimeType ?? null, entity_type: parsed.entityType, entity_id: parsed.entityId, client_id: parsed.clientId ?? null, project_id: parsed.projectId ?? null });
  revalidatePath(path(formData, "/dashboard"));
}

export async function createChecklistTemplate(formData: FormData) {
  const user = await requirePermission(permissions.settingsManage);
  const id = str(formData, "id") || undefined;
  if (!id && !(await reserveSubmission(user.id, formData, "checklist-template:create"))) redirect("/settings");
  const parsed = checklistTemplateSchema.parse({ id, name: str(formData, "name"), serviceId: str(formData, "serviceId"), description: str(formData, "description"), firstItemTitle: str(formData, "firstItemTitle"), isActive: bool(formData, "isActive") });
  const payload = { name: parsed.name, service_id: parsed.serviceId ?? null, description: parsed.description ?? null, is_active: parsed.isActive };
  const result = id ? await getSupabaseAdmin().from("checklist_templates").update(payload).eq("id", id).select("id").single() : await getSupabaseAdmin().from("checklist_templates").insert(payload).select("id").single();
  if (result.error) throw result.error;
  if (!id && parsed.firstItemTitle) await getSupabaseAdmin().from("checklist_items").insert({ template_id: result.data.id, title: parsed.firstItemTitle, sort_order: 0 });
  revalidatePath("/settings");
  redirect("/settings");
}

export async function createChecklistItem(formData: FormData) {
  const user = await requirePermission(permissions.settingsManage);
  const id = str(formData, "id") || undefined;
  if (!id && !(await reserveSubmission(user.id, formData, "checklist-item:create"))) redirect("/settings");
  const parsed = checklistItemSchema.parse({ id, templateId: str(formData, "templateId"), title: str(formData, "title"), description: str(formData, "description"), sortOrder: formData.get("sortOrder") });
  const payload = { template_id: parsed.templateId, title: parsed.title, description: parsed.description ?? null, sort_order: parsed.sortOrder };
  const { error } = id ? await getSupabaseAdmin().from("checklist_items").update(payload).eq("id", id) : await getSupabaseAdmin().from("checklist_items").insert(payload);
  if (error) throw error;
  revalidatePath("/settings");
  redirect("/settings");
}

export async function upsertService(formData: FormData) {
  await requirePermission(permissions.settingsManage);
  const id = str(formData, "id") || undefined;
  const parsed = serviceSchema.parse({ id, name: str(formData, "name"), category: str(formData, "category"), description: str(formData, "description"), baseOnceOffCents: randsToCents(formData.get("baseOnceOffRands")), baseMonthlyCents: randsToCents(formData.get("baseMonthlyRands")), isActive: bool(formData, "isActive") });
  const payload = { name: parsed.name, category: parsed.category, description: parsed.description, base_once_off_cents: parsed.baseOnceOffCents, base_monthly_cents: parsed.baseMonthlyCents, is_active: parsed.isActive };
  const { error } = id ? await getSupabaseAdmin().from("services").update(payload).eq("id", id) : await getSupabaseAdmin().from("services").upsert(payload, { onConflict: "name" });
  if (error) throw error;
  revalidatePath("/services");
  revalidatePath("/settings");
  redirect(path(formData, "/services"));
}

export async function logLeadCall(formData: FormData) {
  const user = await requirePermission(permissions.leadsWrite);
  if (!(await reserveSubmission(user.id, formData, "lead-call:create"))) redirect(path(formData, "/leads"));
  const parsed = leadCallSchema.parse({ leadId: str(formData, "leadId"), callSummary: str(formData, "callSummary"), objections: str(formData, "objections"), outcome: str(formData, "outcome"), nextAction: str(formData, "nextAction"), bookedCallAt: str(formData, "bookedCallAt"), assignedToId: str(formData, "assignedToId") });
  const body = [`Call outcome: ${parsed.outcome}`, `Summary: ${parsed.callSummary}`, parsed.objections ? `Objections: ${parsed.objections}` : null, parsed.nextAction ? `Next action: ${parsed.nextAction}` : null].filter(Boolean).join("\n");
  await getSupabaseAdmin().from("notes").insert({ body, entity_type: "Lead", entity_id: parsed.leadId, lead_id: parsed.leadId });
  if (parsed.bookedCallAt) await getSupabaseAdmin().from("tasks").insert({ title: `Booked call follow-up`, description: body, type: "DISCOVERY_CALL", status: "TO_DO", priority: "HIGH", due_date: parsed.bookedCallAt.toISOString(), assigned_to: parsed.assignedToId ?? null, created_by: user.id });
  await getSupabaseAdmin().from("leads").update({ next_action: parsed.nextAction ?? parsed.outcome, follow_up_date: parsed.bookedCallAt?.toISOString() ?? null, assigned_to: parsed.assignedToId ?? null }).eq("id", parsed.leadId);
  await logActivity({ action: "LEAD_CALL_LOGGED", entityType: "Lead", entityId: parsed.leadId, leadId: parsed.leadId, actorId: user.id, message: `Call logged: ${parsed.outcome}` });
  revalidatePath(path(formData, "/leads"));
  redirect(path(formData, "/leads"));
}

export async function updateTaskStatus(formData: FormData) {
  await requirePermission(permissions.tasksWrite);
  const parsed = taskStatusSchema.parse({ id: str(formData, "id"), status: str(formData, "status"), assignedToId: str(formData, "assignedToId") });
  await getSupabaseAdmin().from("tasks").update({ status: parsed.status, assigned_to: parsed.assignedToId ?? null, completed_at: parsed.status === "DONE" ? new Date().toISOString() : null }).eq("id", parsed.id);
  revalidatePath(path(formData, "/tasks"));
}

export async function upsertCompanySettings(formData: FormData) {
  await requirePermission(permissions.settingsManage);
  const parsed = companySettingsSchema.parse({ companyName: str(formData, "companyName"), billingEmail: str(formData, "billingEmail"), bankName: str(formData, "bankName"), bankAccountName: str(formData, "bankAccountName"), bankAccountNumber: str(formData, "bankAccountNumber"), bankBranchCode: str(formData, "bankBranchCode"), paymentTerms: str(formData, "paymentTerms"), quoteFooter: str(formData, "quoteFooter"), invoiceFooter: str(formData, "invoiceFooter") });
  await getSupabaseAdmin().from("company_settings").upsert({ id: true, company_name: parsed.companyName, billing_email: parsed.billingEmail ?? null, bank_name: parsed.bankName ?? null, bank_account_name: parsed.bankAccountName ?? null, bank_account_number: parsed.bankAccountNumber ?? null, bank_branch_code: parsed.bankBranchCode ?? null, payment_terms: parsed.paymentTerms ?? null, quote_footer: parsed.quoteFooter ?? null, invoice_footer: parsed.invoiceFooter ?? null });
  revalidatePath("/settings");
  redirect("/settings");
}

export async function createDocumentTemplate(formData: FormData) {
  await requirePermission(permissions.settingsManage);
  const parsed = documentTemplateSchema.parse({ name: str(formData, "name"), type: str(formData, "type"), content: str(formData, "content"), isDefault: bool(formData, "isDefault") });
  await getSupabaseAdmin().from("document_templates").insert({ name: parsed.name, type: parsed.type, content: parsed.content, is_default: parsed.isDefault });
  revalidatePath("/settings");
  redirect("/settings");
}
