"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "./db";
import { createSession, destroySession, requirePermission, requireUser } from "./auth";
import { permissions } from "./constants";
import { clientSchema, leadSchema, taskSchema, userSchema } from "./validation";

function str(formData: FormData, key: string) {
  return String(formData.get(key) ?? "");
}

export async function loginAction(_prev: unknown, formData: FormData) {
  const email = str(formData, "email").trim().toLowerCase();
  const password = str(formData, "password");
  const user = await prisma.user.findUnique({ where: { email }, include: { role: true } });
  if (!user || user.status !== "ACTIVE") return { error: "Invalid login details." };
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return { error: "Invalid login details." };
  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await createSession(user.id);
  redirect("/dashboard");
}

export async function logoutAction() {
  await destroySession();
  redirect("/login");
}

async function logActivity(input: { action: string; entityType: string; entityId: string; message: string; actorId?: string; leadId?: string; clientId?: string; taskId?: string }) {
  await prisma.activityLog.create({ data: input });
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
  const lead = id
    ? await prisma.lead.update({ where: { id }, data: parsed })
    : await prisma.lead.create({ data: { ...parsed, createdById: user.id } });
  await logActivity({ action: id ? "LEAD_UPDATED" : "LEAD_CREATED", entityType: "Lead", entityId: lead.id, leadId: lead.id, actorId: user.id, message: `${lead.companyName} ${id ? "updated" : "created"}` });
  revalidatePath("/leads");
  revalidatePath("/dashboard");
  redirect(`/leads/${lead.id}`);
}

export async function archiveLead(formData: FormData) {
  const user = await requirePermission(permissions.leadsWrite);
  const id = str(formData, "id");
  const lead = await prisma.lead.update({ where: { id }, data: { archivedAt: new Date() } });
  await logActivity({ action: "LEAD_ARCHIVED", entityType: "Lead", entityId: id, leadId: id, actorId: user.id, message: `${lead.companyName} archived` });
  revalidatePath("/leads");
  redirect("/leads");
}

export async function convertLeadToClient(formData: FormData) {
  const user = await requirePermission(permissions.clientsWrite);
  const leadId = str(formData, "leadId");
  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead) throw new Error("Lead not found");
  if (lead.convertedClientId) redirect(`/clients/${lead.convertedClientId}`);
  const client = await prisma.client.create({
    data: {
      companyName: lead.companyName,
      primaryEmail: lead.email,
      primaryPhone: lead.phone,
      nextAction: "Complete client onboarding and create first project.",
      contacts: { create: { name: lead.contactName, email: lead.email, phone: lead.phone, isPrimary: true } },
    },
  });
  await prisma.lead.update({ where: { id: leadId }, data: { stage: "WON", convertedClientId: client.id } });
  await logActivity({ action: "LEAD_CONVERTED_TO_CLIENT", entityType: "Client", entityId: client.id, clientId: client.id, leadId, actorId: user.id, message: `${lead.companyName} converted to client` });
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
  const client = id ? await prisma.client.update({ where: { id }, data: parsed }) : await prisma.client.create({ data: parsed });
  await logActivity({ action: id ? "CLIENT_UPDATED" : "CLIENT_CREATED", entityType: "Client", entityId: client.id, clientId: client.id, actorId: user.id, message: `${client.companyName} ${id ? "updated" : "created"}` });
  revalidatePath("/clients");
  redirect(`/clients/${client.id}`);
}

export async function upsertTask(formData: FormData) {
  const user = await requirePermission(permissions.tasksWrite);
  const id = str(formData, "id") || undefined;
  const parsed = taskSchema.parse({
    title: str(formData, "title"),
    description: str(formData, "description"),
    type: str(formData, "type"),
    status: str(formData, "status"),
    priority: str(formData, "priority"),
    dueDate: str(formData, "dueDate"),
    projectId: str(formData, "projectId"),
    assignedToId: str(formData, "assignedToId"),
  });
  const completedAt = parsed.status === "DONE" ? new Date() : null;
  const task = id ? await prisma.task.update({ where: { id }, data: { ...parsed, completedAt } }) : await prisma.task.create({ data: { ...parsed, completedAt, createdById: user.id } });
  await logActivity({ action: parsed.status === "DONE" ? "TASK_COMPLETED" : id ? "TASK_UPDATED" : "TASK_CREATED", entityType: "Task", entityId: task.id, taskId: task.id, actorId: user.id, message: `${task.title} ${id ? "updated" : "created"}` });
  revalidatePath("/tasks");
  revalidatePath("/dashboard");
  redirect("/tasks");
}

export async function upsertUser(formData: FormData) {
  await requirePermission(permissions.settingsManage);
  const id = str(formData, "id") || undefined;
  const parsed = userSchema.parse({
    name: str(formData, "name"),
    email: str(formData, "email").toLowerCase(),
    password: str(formData, "password"),
    roleId: str(formData, "roleId"),
    title: str(formData, "title"),
    phone: str(formData, "phone"),
    status: str(formData, "status"),
  });
  const { password, ...data } = parsed;
  if (!id && !password) throw new Error("Password is required for new users.");
  await prisma.user.upsert({
    where: { id: id ?? "new" },
    create: { ...data, passwordHash: await bcrypt.hash(password || "", 12) },
    update: { ...data, ...(password ? { passwordHash: await bcrypt.hash(password, 12) } : {}) },
  });
  revalidatePath("/settings");
  redirect("/settings");
}

export async function ensureCanViewDashboard() {
  return requireUser();
}
