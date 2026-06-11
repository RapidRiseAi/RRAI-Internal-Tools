import { z } from "zod";
import { affiliateStatuses, clientStatuses, contentStatuses, invoiceStatuses, knowledgeCategories, leadStages, paymentStatuses, priorities, projectStatuses, quoteStatuses, retainerStatuses, taskStatuses, taskTypes, ticketCategories, ticketStatuses } from "./constants";

const optionalEmail = z.string().trim().email().or(z.literal("")).optional().transform((value) => value || undefined);
const optionalText = z.string().trim().optional().transform((value) => value || undefined);
const optionalDate = z.string().optional().transform((value) => value ? new Date(value) : undefined);
const cents = z.coerce.number().int().min(0).default(0);
const optionalUuid = optionalText;

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
  clientId: optionalUuid,
  projectId: optionalUuid,
  assignedToId: optionalUuid,
});

export const userSchema = z.object({
  name: z.string().trim().min(2),
  email: z.string().trim().email(),
  password: z.string().min(10).optional().or(z.literal("")),
  roleId: z.string().min(1),
  title: optionalText,
  phone: optionalText,
  status: z.enum(["ACTIVE", "INACTIVE"]),
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
});

export const invoiceSchema = z.object({
  invoiceNumber: optionalText,
  clientId: z.string().min(1),
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

export const referralSchema = z.object({ affiliateId: z.string().min(1), leadId: optionalUuid, clientId: optionalUuid, status: z.string().trim().min(2).default("PENDING") });
export const commissionSchema = z.object({ affiliateId: z.string().min(1), quoteId: optionalUuid, projectId: optionalUuid, paymentId: optionalUuid, status: z.string().trim().min(2), amountCents: z.coerce.number().int().min(1), commissionType: z.enum(["ONCE_OFF", "RECURRING"]) });
export const campaignSchema = z.object({ name: z.string().trim().min(2), platform: z.string().trim().min(2), targetIndustry: optionalText, offerMessage: optionalText, numberContacted: cents, replies: cents, callsBooked: cents, quotesSent: cents, dealsClosed: cents });
export const contentItemSchema = z.object({ title: z.string().trim().min(2), status: z.enum(contentStatuses), platform: optionalText, postUrl: optionalText, performanceNotes: optionalText, leadsGenerated: cents });
export const knowledgeBaseSchema = z.object({ title: z.string().trim().min(2), category: z.enum(knowledgeCategories), body: z.string().trim().min(10), visibility: z.enum(["INTERNAL", "TEAM", "PRIVATE"]) });
export const noteSchema = z.object({ body: z.string().trim().min(2), entityType: z.string().trim().min(2), entityId: z.string().min(1), clientId: optionalUuid, leadId: optionalUuid, projectId: optionalUuid });
export const fileRecordSchema = z.object({ filename: z.string().trim().min(2), url: z.string().trim().url(), mimeType: optionalText, entityType: z.string().trim().min(2), entityId: z.string().min(1), clientId: optionalUuid, projectId: optionalUuid });
export const checklistTemplateSchema = z.object({ name: z.string().trim().min(2), serviceId: optionalUuid, description: optionalText, firstItemTitle: optionalText });
export const checklistItemSchema = z.object({ templateId: z.string().min(1), title: z.string().trim().min(2), description: optionalText });
export const projectChecklistSchema = z.object({ id: z.string().min(1), status: z.enum(taskStatuses) });
