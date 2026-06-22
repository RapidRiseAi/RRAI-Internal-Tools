import { z } from "zod";
import {
  affiliateStatuses,
  clientStatuses,
  contentStatuses,
  documentTemplateTypes,
  employmentTypes,
  payTypes,
  payrollStatuses,
  invoiceStatuses,
  knowledgeCategories,
  leadStages,
  paymentStatuses,
  priorities,
  projectStatuses,
  quoteStatuses,
  retainerStatuses,
  taskStatuses,
  taskTypes,
  taskRecurrences,
  ticketCategories,
  ticketStatuses,
} from "./constants";

const optionalEmail = z
  .string()
  .trim()
  .email()
  .or(z.literal(""))
  .optional()
  .transform((value) => value || undefined);
const optionalText = z
  .string()
  .trim()
  .optional()
  .transform((value) => value || undefined);
const optionalDate = z
  .string()
  .optional()
  .transform((value) => (value ? new Date(value) : undefined));
const cents = z.coerce.number().int().min(0).default(0);
const optionalUuid = optionalText;

export const messageSchema = z.object({
  audience: z.enum(["DIRECT", "BROADCAST"]).default("DIRECT"),
  recipientId: optionalText,
  broadcastRole: optionalText,
  body: z.string().trim().min(1).max(4000),
});

export const goalSchema = z.object({
  metric: z.string().trim().min(2),
  label: optionalText,
  target: z.coerce.number().min(0),
  period: z.string().trim().min(2).default("MONTHLY"),
});

export const selfNoteSchema = z.object({
  body: z.string().trim().min(1).max(2000),
});

export const leadSchema = z.object({
  companyName: z.string().trim().min(2),
  contactName: z.string().trim().min(2),
  email: optionalEmail,
  phone: optionalText,
  source: z.string().trim().min(2),
  serviceInterest: z.string().trim().min(2),
  stage: z.enum(leadStages),
  score: z.coerce.number().int().min(0).max(100),
  followUpDate: optionalDate,
  nextAction: optionalText,
  painPoints: optionalText,
  assignedToId: optionalText,
});

export const clientSchema = z.object({
  companyName: z.string().trim().min(2),
  accountStatus: z.enum(clientStatuses),
  industry: optionalText,
  website: optionalText,
  primaryEmail: optionalEmail,
  primaryPhone: optionalText,
  nextAction: optionalText,
  mrrCents: cents,
});

export const taskSchema = z.object({
  title: z.string().trim().min(3),
  description: optionalText,
  type: z.enum(taskTypes),
  status: z.enum(taskStatuses),
  priority: z.enum(priorities),
  dueDate: optionalDate,
  durationMinutes: z.coerce.number().int().min(5).max(1440).default(60),
  clientId: optionalUuid,
  projectId: optionalUuid,
  assignedToId: optionalUuid,
  recurrence: z.enum(taskRecurrences).default("NONE"),
  recurrenceInterval: z.coerce.number().int().min(1).max(52).default(1),
  recurrenceDayOfWeek: z.coerce.number().int().min(0).max(6).optional(),
  recurrenceDayOfMonth: z.coerce.number().int().min(1).max(31).optional(),
});

export const userSchema = z.object({
  name: z.string().trim().min(2),
  email: z.string().trim().email(),
  password: z.string().min(10).optional().or(z.literal("")),
  roleId: z.string().min(1),
  title: optionalText,
  phone: optionalText,
  status: z.enum(["ACTIVE", "INACTIVE"]),
  employmentType: z.enum(employmentTypes).default("FULL_TIME"),
  department: optionalText,
  specialties: optionalText,
  payType: z.enum(payTypes).default("SALARY"),
  payRateCents: cents,
  startDate: optionalDate,
  emergencyContact: optionalText,
  employeeNotes: optionalText,
});

export const accountLoginSchema = z.object({
  name: z.string().trim().min(2),
  email: z.string().trim().email(),
  currentPassword: z.string().min(1),
  newPassword: z.string().min(10).optional().or(z.literal("")),
});

export const quoteSchema = z.object({
  title: z.string().trim().min(3),
  status: z.enum(quoteStatuses),
  clientId: optionalUuid,
  leadId: optionalUuid,
  validUntil: optionalDate,
  internalNotes: optionalText,
  itemDescription: z.string().trim().min(3),
  itemQuantity: z.coerce.number().int().min(1).default(1),
  itemOnceOffCents: cents,
  itemMonthlyCents: cents,
  serviceId: optionalUuid,
});

export const projectSchema = z.object({
  name: z.string().trim().min(3),
  clientId: z.string().min(1),
  quoteId: optionalUuid,
  status: z.enum(projectStatuses),
  stage: optionalText,
  priority: z.enum(priorities),
  deadline: optionalDate,
  progress: z.coerce.number().int().min(0).max(100).default(0),
  blocker: optionalText,
  seedChecklist: z.boolean().default(false),
  checklistTemplateId: optionalUuid,
  assignedToId: optionalUuid,
});

export const invoiceSchema = z.object({
  invoiceNumber: optionalText,
  clientId: z.string().min(1),
  quoteId: optionalUuid,
  status: z.enum(invoiceStatuses),
  amountCents: z.coerce.number().int().min(1),
  dueDate: optionalDate,
});

export const paymentSchema = z.object({
  invoiceId: z.string().min(1),
  amountCents: z.coerce.number().int().min(1),
  status: z.enum(paymentStatuses),
  method: optionalText,
  reference: optionalText,
});

export const vendorSchema = z.object({
  name: z.string().trim().min(2),
  category: optionalText,
  contactName: optionalText,
  email: optionalEmail,
  phone: optionalText,
  website: optionalText,
  notes: optionalText,
});

export const expenseSchema = z.object({
  vendor: z.string().trim().min(2),
  category: z.string().trim().min(2),
  expenseType: z.string().trim().min(2).default("General"),
  amountCents: z.coerce.number().int().min(1),
  status: z.enum(["PENDING", "APPROVED", "PAID", "REJECTED"]),
  expenseDate: optionalDate,
  notes: optionalText,
  clientId: optionalUuid,
  projectId: optionalUuid,
  recurrence: z.enum(["NONE", "WEEKLY", "MONTHLY", "QUARTERLY", "ANNUAL"]).default("NONE"),
  nextDueDate: optionalDate,
});

export const retainerSchema = z.object({
  clientId: z.string().min(1),
  type: z.string().trim().min(2),
  status: z.enum(retainerStatuses),
  monthlyAmountCents: z.coerce.number().int().min(1),
  nextBillingDate: optionalDate,
});

export const supportTicketSchema = z.object({
  title: z.string().trim().min(3),
  category: z.enum(ticketCategories),
  priority: z.enum(priorities),
  status: z.enum(ticketStatuses),
  clientId: optionalUuid,
  projectId: optionalUuid,
  assignedToId: optionalUuid,
  internalNotes: optionalText,
  clientUpdateNotes: optionalText,
  resolutionNotes: optionalText,
});

export const affiliateSchema = z.object({
  name: z.string().trim().min(2),
  email: z.string().trim().email(),
  trackingCode: optionalText,
  status: z.enum(affiliateStatuses),
  defaultCommissionType: z.enum(["ONCE_OFF", "RECURRING"]),
  defaultCommissionRate: z.coerce.number().int().min(0).max(100),
});

export const referralSchema = z.object({
  affiliateId: z.string().min(1),
  leadId: optionalUuid,
  clientId: optionalUuid,
  status: z.string().trim().min(2).default("PENDING"),
});
export const commissionSchema = z.object({
  affiliateId: z.string().min(1),
  quoteId: optionalUuid,
  projectId: optionalUuid,
  paymentId: optionalUuid,
  status: z.string().trim().min(2),
  amountCents: z.coerce.number().int().min(1),
  commissionType: z.enum(["ONCE_OFF", "RECURRING"]),
});
export const campaignSchema = z.object({
  name: z.string().trim().min(2),
  platform: z.string().trim().min(2),
  targetIndustry: optionalText,
  offerMessage: optionalText,
  numberContacted: cents,
  replies: cents,
  callsBooked: cents,
  quotesSent: cents,
  dealsClosed: cents,
});
export const contentItemSchema = z.object({
  title: z.string().trim().min(2),
  status: z.enum(contentStatuses),
  platform: optionalText,
  postUrl: optionalText,
  performanceNotes: optionalText,
  leadsGenerated: cents,
});
export const knowledgeBaseSchema = z.object({
  title: z.string().trim().min(2),
  category: z.enum(knowledgeCategories),
  body: z.string().trim().min(10),
  visibility: z.enum(["INTERNAL", "TEAM", "PRIVATE"]),
});
export const noteSchema = z.object({
  body: z.string().trim().min(2),
  entityType: z.string().trim().min(2),
  entityId: z.string().min(1),
  clientId: optionalUuid,
  leadId: optionalUuid,
  projectId: optionalUuid,
});
export const allowedFileEntityTypes = [
  "Lead",
  "Client",
  "Project",
  "KnowledgeBase",
  "Task",
  "Expense",
  "ActivityLog",
] as const;
export const allowedFileMimeTypes = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "text/plain",
  "text/csv",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
] as const;
export const maxUploadFileSizeBytes = 10 * 1024 * 1024;

export const fileEntitySchema = z.object({
  entityType: z.enum(allowedFileEntityTypes),
  entityId: z.string().uuid(),
  clientId: optionalUuid,
  leadId: optionalUuid,
  projectId: optionalUuid,
  knowledgeBaseItemId: optionalUuid,
});
export const fileRecordSchema = fileEntitySchema.extend({
  filename: z.string().trim().min(2),
  url: z.string().trim().url(),
  mimeType: optionalText,
});
export const uploadFileSchema = fileEntitySchema.extend({
  filename: z.string().trim().min(2),
  mimeType: z.enum(allowedFileMimeTypes),
  size: z.number().int().min(1).max(maxUploadFileSizeBytes),
});
export const checklistTemplateSchema = z.object({
  id: optionalUuid,
  name: z.string().trim().min(2),
  serviceId: optionalUuid,
  description: optionalText,
  firstItemTitle: optionalText,
  isActive: z.boolean().default(true),
});
export const checklistItemSchema = z.object({
  id: optionalUuid,
  templateId: z.string().min(1),
  title: z.string().trim().min(2),
  description: optionalText,
  sortOrder: z.coerce.number().int().min(0).default(0),
});
export const projectChecklistSchema = z.object({
  id: z.string().min(1),
  status: z.enum(taskStatuses),
});

export const serviceSchema = z.object({
  id: optionalUuid,
  name: z.string().trim().min(2),
  category: z.string().trim().min(2),
  description: z.string().trim().min(5),
  baseOnceOffCents: cents,
  baseMonthlyCents: cents,
  hourlyRateCents: cents,
  estimatedHours: z.coerce.number().min(0).default(0),
  isActive: z.boolean().default(true),
});

export const logTimeSchema = z.object({
  taskId: optionalText,
  projectId: optionalText,
  clientId: optionalText,
  description: optionalText,
  startedAt: z.string().min(1),
  endedAt: optionalText,
  isBillable: z.boolean().optional(),
});
export const interactionEventSchema = z.object({
  entityType: z.enum(["Lead", "Client"]),
  leadId: optionalUuid,
  clientId: optionalUuid,
  eventType: z.enum(["CALL", "EMAIL", "MESSAGE", "TASK", "OTHER"]),
  direction: z.enum(["OUTBOUND", "RECEIVED", "INTERNAL"]),
  summary: z.string().trim().min(2),
  objections: optionalText,
  outcome: optionalText,
  taskId: optionalUuid,
});
export const bookEventSchema = z.object({
  entityType: z.enum(["Lead", "Client"]),
  leadId: optionalUuid,
  clientId: optionalUuid,
  eventType: z.enum(["CALL", "MEETING", "FOLLOW_UP", "OTHER"]),
  title: z.string().trim().min(2),
  eventAt: optionalDate,
  notes: optionalText,
  assignedToId: optionalUuid,
});
export const linkedTaskSchema = z.object({
  entityType: z.enum(["Lead", "Client"]),
  leadId: optionalUuid,
  clientId: optionalUuid,
  title: z.string().trim().min(2),
  description: optionalText,
  dueDate: optionalDate,
  durationMinutes: z.coerce.number().int().min(5).max(1440).default(60),
  assignedToId: optionalUuid,
});
export const leadCallSchema = z.object({
  leadId: z.string().min(1),
  callSummary: z.string().trim().min(2),
  objections: optionalText,
  outcome: z.string().trim().min(2),
  nextAction: optionalText,
  bookedCallAt: optionalDate,
  assignedToId: optionalUuid,
});
export const taskStatusSchema = z.object({
  id: z.string().min(1),
  status: z.enum(taskStatuses),
  assignedToId: optionalUuid,
});
export const companySettingsSchema = z.object({
  companyName: z.string().trim().min(2),
  billingEmail: optionalEmail,
  bankName: optionalText,
  bankAccountName: optionalText,
  bankAccountNumber: optionalText,
  bankBranchCode: optionalText,
  paymentTerms: optionalText,
  quoteFooter: optionalText,
  invoiceFooter: optionalText,
});
export const payrollRunSchema = z.object({
  periodStart: z.string().min(1).transform((value) => new Date(value)),
  periodEnd: z.string().min(1).transform((value) => new Date(value)),
  status: z.enum(payrollStatuses).default("DRAFT"),
  notes: optionalText,
});

export const payrollItemSchema = z.object({
  payrollRunId: z.string().min(1),
  userId: z.string().min(1),
  payType: z.enum(payTypes),
  hours: z.coerce.number().min(0).default(0),
  grossPayCents: z.coerce.number().int().min(0),
  deductionsCents: z.coerce.number().int().min(0).default(0),
  notes: optionalText,
});

export const documentTemplateSchema = z.object({
  id: optionalText,
  name: z.string().trim().min(2),
  type: z.enum(documentTemplateTypes),
  content: z.string().trim().min(10),
  isDefault: z.boolean().default(false),
});
