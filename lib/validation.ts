import { z } from "zod";
import { clientStatuses, leadStages, priorities, taskStatuses, taskTypes } from "./constants";

const optionalEmail = z.string().trim().email().or(z.literal("")).optional().transform((value) => value || undefined);
const optionalText = z.string().trim().optional().transform((value) => value || undefined);
const optionalDate = z.string().optional().transform((value) => value ? new Date(value) : undefined);

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
  mrrCents: z.coerce.number().int().min(0).default(0),
});

export const taskSchema = z.object({
  title: z.string().trim().min(3),
  description: optionalText,
  type: z.enum(taskTypes),
  status: z.enum(taskStatuses),
  priority: z.enum(priorities),
  dueDate: optionalDate,
  projectId: optionalText,
  assignedToId: optionalText,
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
