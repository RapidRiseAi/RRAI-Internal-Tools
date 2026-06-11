import "server-only";

import { getSupabaseAdmin, hasSupabaseConfig } from "./supabase";
import type { ActivityLog, Affiliate, Campaign, Client, ContentItem, Invoice, KnowledgeBaseItem, Lead, Project, Quote, Retainer, Role, Service, SupportTicket, Task, User } from "./types";

export async function tableCount(table: string, filters?: Record<string, string | number | boolean | null>) {
  if (!hasSupabaseConfig()) return 0;
  const supabase = getSupabaseAdmin();
  let query = supabase.from(table).select("id", { count: "exact", head: true });
  for (const [key, value] of Object.entries(filters ?? {})) query = query.eq(key, value);
  const { count, error } = await query;
  if (error) return 0;
  return count ?? 0;
}

export async function listUsers() {
  if (!hasSupabaseConfig()) return [] as User[];
  const { data } = await getSupabaseAdmin().from("users").select("*, role:roles(*)").order("created_at", { ascending: false });
  return (data ?? []) as User[];
}

export async function listRoles() {
  if (!hasSupabaseConfig()) return [] as Role[];
  const { data } = await getSupabaseAdmin().from("roles").select("*").order("name");
  return (data ?? []) as Role[];
}

export async function listLeads() {
  if (!hasSupabaseConfig()) return [] as Lead[];
  const { data } = await getSupabaseAdmin().from("leads").select("*, assignee:users!leads_assigned_to_fkey(id,name)").is("archived_at", null).order("updated_at", { ascending: false });
  return (data ?? []) as Lead[];
}

export async function getLead(id: string) {
  if (!hasSupabaseConfig()) return null;
  const { data } = await getSupabaseAdmin().from("leads").select("*, assignee:users!leads_assigned_to_fkey(id,name)").eq("id", id).maybeSingle();
  return data as Lead | null;
}

export async function listClients() {
  if (!hasSupabaseConfig()) return [] as Client[];
  const { data } = await getSupabaseAdmin().from("clients").select("*").is("archived_at", null).order("updated_at", { ascending: false });
  return (data ?? []) as Client[];
}

export async function getClient(id: string) {
  if (!hasSupabaseConfig()) return null;
  const { data } = await getSupabaseAdmin().from("clients").select("*").eq("id", id).maybeSingle();
  return data as Client | null;
}

export async function listTasks() {
  if (!hasSupabaseConfig()) return [] as Task[];
  const { data } = await getSupabaseAdmin().from("tasks").select("*, assignee:users!tasks_assigned_to_fkey(id,name)").order("updated_at", { ascending: false });
  return (data ?? []) as Task[];
}

export async function listServices() {
  if (!hasSupabaseConfig()) return [] as Service[];
  const { data } = await getSupabaseAdmin().from("services").select("*").order("name");
  return (data ?? []) as Service[];
}

export async function recentActivity(limit = 8) {
  if (!hasSupabaseConfig()) return [] as ActivityLog[];
  const { data } = await getSupabaseAdmin().from("activity_logs").select("*").order("created_at", { ascending: false }).limit(limit);
  return (data ?? []) as ActivityLog[];
}

export async function genericList<T>(table: string, order = "updated_at") {
  if (!hasSupabaseConfig()) return [] as T[];
  const { data } = await getSupabaseAdmin().from(table).select("*").order(order, { ascending: false });
  return (data ?? []) as T[];
}

export type ModuleData = {
  quotes: Quote[];
  projects: Project[];
  invoices: Invoice[];
  retainers: Retainer[];
  tickets: SupportTicket[];
  affiliates: Affiliate[];
  campaigns: Campaign[];
  content: ContentItem[];
  kb: KnowledgeBaseItem[];
};
