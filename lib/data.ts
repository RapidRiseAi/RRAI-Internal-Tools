import "server-only";

import { getSupabaseAdmin, hasSupabaseConfig } from "./supabase";
import type { ActivityLog, Affiliate, Campaign, ChecklistItem, ChecklistTemplate, Client, Commission, CompanySettings, ContentItem, DocumentTemplate, FileRecord, Invoice, KnowledgeBaseItem, Lead, Note, Package, Payment, Project, ProjectChecklist, Quote, QuoteItem, Referral, Retainer, Role, Service, SupportTicket, Task, User } from "./types";

export async function tableCount(table: string, filters?: Record<string, string | number | boolean | null>) {
  if (!hasSupabaseConfig()) return 0;
  const supabase = getSupabaseAdmin();
  let query = supabase.from(table).select("id", { count: "exact", head: true });
  for (const [key, value] of Object.entries(filters ?? {})) query = query.eq(key, value);
  const { count, error } = await query;
  if (error) return 0;
  return count ?? 0;
}

export async function listUsers() { if (!hasSupabaseConfig()) return [] as User[]; const { data } = await getSupabaseAdmin().from("users").select("*, role:roles(*)").order("created_at", { ascending: false }); return (data ?? []) as User[]; }
export async function listRoles() { if (!hasSupabaseConfig()) return [] as Role[]; const { data } = await getSupabaseAdmin().from("roles").select("*").order("name"); return (data ?? []) as Role[]; }
export async function listLeads() { if (!hasSupabaseConfig()) return [] as Lead[]; const { data } = await getSupabaseAdmin().from("leads").select("*, assignee:users!leads_assigned_to_fkey(id,name)").is("archived_at", null).order("updated_at", { ascending: false }); return (data ?? []) as Lead[]; }
export async function getLead(id: string) { if (!hasSupabaseConfig()) return null; const { data } = await getSupabaseAdmin().from("leads").select("*, assignee:users!leads_assigned_to_fkey(id,name)").eq("id", id).maybeSingle(); return data as Lead | null; }
export async function listClients() { if (!hasSupabaseConfig()) return [] as Client[]; const { data } = await getSupabaseAdmin().from("clients").select("*").is("archived_at", null).order("updated_at", { ascending: false }); return (data ?? []) as Client[]; }
export async function getClient(id: string) { if (!hasSupabaseConfig()) return null; const { data } = await getSupabaseAdmin().from("clients").select("*").eq("id", id).maybeSingle(); return data as Client | null; }
export async function listTasks() { if (!hasSupabaseConfig()) return [] as Task[]; const { data } = await getSupabaseAdmin().from("tasks").select("*, assignee:users!tasks_assigned_to_fkey(id,name)").order("updated_at", { ascending: false }); return (data ?? []) as Task[]; }
export async function listServices() { if (!hasSupabaseConfig()) return [] as Service[]; const { data } = await getSupabaseAdmin().from("services").select("*").order("name"); return (data ?? []) as Service[]; }
export async function listPackages() { if (!hasSupabaseConfig()) return [] as Package[]; const { data } = await getSupabaseAdmin().from("packages").select("*").order("name"); return (data ?? []) as Package[]; }
export async function recentActivity(limit = 8) { if (!hasSupabaseConfig()) return [] as ActivityLog[]; const { data } = await getSupabaseAdmin().from("activity_logs").select("*").order("created_at", { ascending: false }).limit(limit); return (data ?? []) as ActivityLog[]; }
export async function genericList<T>(table: string, order = "updated_at") { if (!hasSupabaseConfig()) return [] as T[]; const { data } = await getSupabaseAdmin().from(table).select("*").order(order, { ascending: false }); return (data ?? []) as T[]; }
export async function getProject(id: string) { if (!hasSupabaseConfig()) return null; const { data } = await getSupabaseAdmin().from("projects").select("*").eq("id", id).maybeSingle(); return data as Project | null; }
export async function getProjectChecklist(projectId: string) { if (!hasSupabaseConfig()) return [] as ProjectChecklist[]; const { data } = await getSupabaseAdmin().from("project_checklists").select("*").eq("project_id", projectId).order("created_at"); return (data ?? []) as ProjectChecklist[]; }
export async function listNotes(filters: { leadId?: string; clientId?: string; projectId?: string; entityId?: string }) { if (!hasSupabaseConfig()) return [] as Note[]; let query = getSupabaseAdmin().from("notes").select("*").order("created_at", { ascending: false }); if (filters.leadId) query = query.eq("lead_id", filters.leadId); if (filters.clientId) query = query.eq("client_id", filters.clientId); if (filters.projectId) query = query.eq("project_id", filters.projectId); if (filters.entityId) query = query.eq("entity_id", filters.entityId); const { data } = await query; return (data ?? []) as Note[]; }
export async function listFiles(filters: { clientId?: string; projectId?: string; entityId?: string }) { if (!hasSupabaseConfig()) return [] as FileRecord[]; let query = getSupabaseAdmin().from("files").select("*").order("created_at", { ascending: false }); if (filters.clientId) query = query.eq("client_id", filters.clientId); if (filters.projectId) query = query.eq("project_id", filters.projectId); if (filters.entityId) query = query.eq("entity_id", filters.entityId); const { data } = await query; return (data ?? []) as FileRecord[]; }
export async function listQuoteItems(quoteId: string) { if (!hasSupabaseConfig()) return [] as QuoteItem[]; const { data } = await getSupabaseAdmin().from("quote_items").select("*").eq("quote_id", quoteId).order("sort_order"); return (data ?? []) as QuoteItem[]; }
export async function listChecklistTemplates() { if (!hasSupabaseConfig()) return [] as ChecklistTemplate[]; const { data } = await getSupabaseAdmin().from("checklist_templates").select("*").order("name"); return (data ?? []) as ChecklistTemplate[]; }
export async function listChecklistItems() { if (!hasSupabaseConfig()) return [] as ChecklistItem[]; const { data } = await getSupabaseAdmin().from("checklist_items").select("*").order("sort_order"); return (data ?? []) as ChecklistItem[]; }
export async function listPayments() { return genericList<Payment>("payments"); }
export async function listReferrals() { return genericList<Referral>("referrals"); }
export async function listCommissions() { return genericList<Commission>("commissions"); }
export async function listCompanySettings() { if (!hasSupabaseConfig()) return null; const { data } = await getSupabaseAdmin().from("company_settings").select("*").eq("id", true).maybeSingle(); return data as CompanySettings | null; }
export async function listDocumentTemplates() { return genericList<DocumentTemplate>("document_templates"); }

export type ModuleData = { quotes: Quote[]; projects: Project[]; invoices: Invoice[]; retainers: Retainer[]; tickets: SupportTicket[]; affiliates: Affiliate[]; campaigns: Campaign[]; content: ContentItem[]; kb: KnowledgeBaseItem[]; };
