"use client";

import { useActionState, useMemo } from "react";
import { acceptQuote, addFileRecord, assignLinkedTask, addNote, bookEvent, createChecklistItem, createChecklistTemplate, createCommission, createDocumentTemplate, createReferral, logInteractionEvent, logLeadCall, recordPayment, upsertActivityWorkflow, upsertAffiliate, upsertCampaign, upsertClient, upsertContentItem, upsertKnowledgeBaseItem, upsertLead, upsertCompanySettings, upsertProject, upsertRetainer, upsertService, upsertSupportTicket, updateOwnLoginDetails, upsertTask, upsertUser } from "@/lib/actions";
import { affiliateStatuses, clientStatuses, commissionStatuses, contentStatuses, knowledgeCategories, labelize, leadStages, paymentStatuses, priorities, projectStatuses, retainerStatuses, taskStatuses, taskTypes, ticketCategories, ticketStatuses } from "@/lib/constants";
import type { Affiliate, ChecklistItem, ChecklistTemplate, Client, Lead, Payment, Project, Quote, Service, SupportTicket, Task, User } from "@/lib/types";
import { ModalPanel } from "./modal-panel";
import { Card, Field, inputClass } from "./ui";
import { rands } from "@/lib/format";
import { SubmitButton } from "./submit-button";
export { InvoiceForm } from "./invoice-form";
export { QuoteForm } from "./quote-form";

export type UserOption = { id: string; name: string };
export type ProjectOption = { id: string; name: string; client_id?: string };
export type RoleOption = { id: string; name: string };
export type ClientOption = { id: string; company_name: string };
export type LeadOption = { id: string; company_name: string };
export type QuoteOption = { id: string; title: string; client_id: string | null };
export type InvoiceOption = { id: string; invoice_number: string; amount_cents: number };
export type ServiceOption = Pick<Service, "id" | "name" | "description" | "base_once_off_cents" | "base_monthly_cents">;

function dateInput(value?: string | null) {
  return value ? value.slice(0, 10) : "";
}

function dateTimeInput(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  const timezoneOffsetMs = date.getTimezoneOffset() * 60 * 1000;
  return new Date(date.getTime() - timezoneOffsetMs).toISOString().slice(0, 16);
}

function Options({ values }: { values: readonly string[] }) {
  return values.map((value) => <option key={value} value={value}>{labelize(value)}</option>);
}

function SubmissionInput({ scope }: { scope: string }) {
  const submissionKey = useMemo(() => `${scope}:${globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)}`, [scope]);
  return <input type="hidden" name="submissionKey" value={submissionKey} />;
}

function FormError({ message }: { message?: string }) {
  return message ? <p className="rounded-xl border border-red-400/30 bg-red-400/10 px-3 py-2 text-sm text-red-200">{message}</p> : null;
}

function FieldError({ messages }: { messages?: string[] }) {
  return messages?.length ? <p className="text-xs font-medium text-red-300">{messages[0]}</p> : null;
}

export function LeadForm({ lead, users }: { lead?: Lead; users: UserOption[] }) {
  const [state, formAction] = useActionState(upsertLead, { ok: false });
  return (
    <form action={formAction} className="grid gap-4 md:grid-cols-2"><div className="md:col-span-2"><FormError message={state.formError} /></div><SubmissionInput scope="upsert-lead" />
      {lead?.id ? <input type="hidden" name="id" value={lead.id} /> : null}
      <Field label="Company"><input className={inputClass} name="companyName" defaultValue={lead?.company_name ?? ""} required /><FieldError messages={state.fieldErrors?.companyName} /></Field>
      <Field label="Contact"><input className={inputClass} name="contactName" defaultValue={lead?.contact_name ?? ""} required /><FieldError messages={state.fieldErrors?.contactName} /></Field>
      <Field label="Email"><input className={inputClass} name="email" type="email" defaultValue={lead?.email ?? ""} /><FieldError messages={state.fieldErrors?.email} /></Field>
      <Field label="Phone"><input className={inputClass} name="phone" defaultValue={lead?.phone ?? ""} /></Field>
      <Field label="Source"><input className={inputClass} name="source" defaultValue={lead?.source ?? "Referral"} required /></Field>
      <Field label="Service interest"><input className={inputClass} name="serviceInterest" defaultValue={lead?.service_interest ?? "Website development"} required /></Field>
      <Field label="Stage"><select className={inputClass} name="stage" defaultValue={lead?.stage ?? "NEW_LEAD"}><Options values={leadStages} /></select></Field>
      <Field label="Lead score"><input className={inputClass} name="score" type="number" min="0" max="100" defaultValue={lead?.score ?? 50} /></Field>
      <Field label="Follow-up date/time"><input className={inputClass} name="followUpDate" type="datetime-local" defaultValue={dateTimeInput(lead?.follow_up_date)} /></Field>
      <Field label="Assigned to"><select className={inputClass} name="assignedToId" defaultValue={lead?.assigned_to ?? ""}><option value="">Unassigned</option>{users.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}</select></Field>
      <Field label="Next action"><input className={inputClass} name="nextAction" defaultValue={lead?.next_action ?? ""} /></Field>
      <Field label="Pain points"><textarea className={inputClass} name="painPoints" defaultValue={lead?.pain_points ?? ""} /></Field>
      <div className="md:col-span-2"><SubmitButton>Save lead</SubmitButton></div>
    </form>
  );
}

export function ClientForm({ client }: { client?: Client }) {
  const [state, formAction] = useActionState(upsertClient, { ok: false });
  return (
    <form action={formAction} className="grid gap-4 md:grid-cols-2"><div className="md:col-span-2"><FormError message={state.formError} /></div><SubmissionInput scope="upsert-client" />
      {client?.id ? <input type="hidden" name="id" value={client.id} /> : null}
      <Field label="Company"><input className={inputClass} name="companyName" defaultValue={client?.company_name ?? ""} required /><FieldError messages={state.fieldErrors?.companyName} /></Field>
      <Field label="Status"><select className={inputClass} name="accountStatus" defaultValue={client?.account_status ?? "ACTIVE"}><Options values={clientStatuses} /></select></Field>
      <Field label="Industry"><input className={inputClass} name="industry" defaultValue={client?.industry ?? ""} /></Field>
      <Field label="Website"><input className={inputClass} name="website" defaultValue={client?.website ?? ""} /></Field>
      <Field label="Primary email"><input className={inputClass} name="primaryEmail" type="email" defaultValue={client?.primary_email ?? ""} /><FieldError messages={state.fieldErrors?.primaryEmail} /></Field>
      <Field label="Primary phone"><input className={inputClass} name="primaryPhone" defaultValue={client?.primary_phone ?? ""} /></Field>
      <Field label="MRR (R)"><input className={inputClass} name="mrrRands" type="number" min="0" defaultValue={rands(client?.mrr_cents ?? 0)} /></Field>
      <Field label="Next action"><input className={inputClass} name="nextAction" defaultValue={client?.next_action ?? ""} /></Field>
      <div className="md:col-span-2"><SubmitButton>Save client</SubmitButton></div>
    </form>
  );
}

export function TaskForm({ users, projects, clients, redirectTo }: { users: UserOption[]; projects: ProjectOption[]; clients?: ClientOption[]; redirectTo?: string }) {
  return (
    <form action={upsertTask} className="grid gap-4 md:grid-cols-3"><SubmissionInput scope="upsert-task" />
      {redirectTo ? <input type="hidden" name="redirectTo" value={redirectTo} /> : null}
      <Field label="Title"><input className={inputClass} name="title" required /></Field>
      <Field label="Type"><select className={inputClass} name="type"><Options values={taskTypes} /></select></Field>
      <Field label="Status"><select className={inputClass} name="status"><Options values={taskStatuses} /></select></Field>
      <Field label="Priority"><select className={inputClass} name="priority"><Options values={priorities} /></select></Field>
      <Field label="Due date/time"><input className={inputClass} type="datetime-local" name="dueDate" /></Field>
      <Field label="Assignee"><select className={inputClass} name="assignedToId"><option value="">Unassigned</option>{users.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}</select></Field>
      <Field label="Client"><select className={inputClass} name="clientId"><option value="">No client</option>{clients?.map((client) => <option key={client.id} value={client.id}>{client.company_name}</option>)}</select></Field>
      <Field label="Project"><select className={inputClass} name="projectId"><option value="">No project</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></Field>
      <Field label="Description"><textarea className={inputClass} name="description" /></Field>
      <div className="flex items-end"><SubmitButton>Create task</SubmitButton></div>
    </form>
  );
}

export function AccountLoginForm({ user }: { user: User }) {
  return <form action={updateOwnLoginDetails} className="grid gap-4 md:grid-cols-2">
    <Field label="Name"><input className={inputClass} name="name" defaultValue={user.name} required /></Field>
    <Field label="Email"><input className={inputClass} name="email" type="email" defaultValue={user.email} required /></Field>
    <Field label="Current password"><input className={inputClass} name="currentPassword" type="password" required /></Field>
    <Field label="New password"><input className={inputClass} name="newPassword" type="password" minLength={10} placeholder="Leave blank to keep current password" /></Field>
    <div className="md:col-span-2"><SubmitButton pendingLabel="Updating login…">Update login details</SubmitButton></div>
  </form>;
}

export function UserForm({ roles }: { roles: RoleOption[] }) {
  const [state, formAction] = useActionState(upsertUser, { ok: false });
  return (
    <form action={formAction} className="grid gap-4 md:grid-cols-3"><div className="md:col-span-3"><FormError message={state.formError} /></div><SubmissionInput scope="upsert-user" />
      <Field label="Name"><input className={inputClass} name="name" required /><FieldError messages={state.fieldErrors?.name} /></Field>
      <Field label="Email"><input className={inputClass} name="email" type="email" required /><FieldError messages={state.fieldErrors?.email} /></Field>
      <Field label="Temporary password"><input className={inputClass} name="password" type="password" minLength={10} required /><FieldError messages={state.fieldErrors?.password} /></Field>
      <Field label="Role"><select className={inputClass} name="roleId">{roles.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}</select></Field>
      <Field label="Title"><input className={inputClass} name="title" /></Field>
      <Field label="Phone"><input className={inputClass} name="phone" /></Field>
      <input type="hidden" name="status" value="ACTIVE" />
      <div className="md:col-span-3"><SubmitButton>Add employee</SubmitButton></div>
    </form>
  );
}

export function AcceptQuoteButton({ quote }: { quote: Quote }) {
  if (quote.status === "ACCEPTED") return null;
  return <form action={acceptQuote}><SubmissionInput scope="accept-quote" /><input type="hidden" name="id" value={quote.id} /><SubmitButton pendingLabel="Creating project…">Accept & create project</SubmitButton></form>;
}

export type ProjectFormProps = {
  clients: ClientOption[];
  quotes: QuoteOption[];
  project?: Project;
  users?: UserOption[];
  checklistTemplates?: ChecklistTemplate[];
};

export function ProjectForm({ clients, quotes, project, users = [], checklistTemplates = [] }: ProjectFormProps) {
  const activeChecklistTemplates = checklistTemplates.filter((template) => template.is_active);
  return <form action={upsertProject} className="grid gap-4 md:grid-cols-3"><SubmissionInput scope="upsert-project" />
    {project?.id ? <input type="hidden" name="id" value={project.id} /> : null}
    <Field label="Project name"><input className={inputClass} name="name" defaultValue={project?.name ?? ""} required /></Field>
    <Field label="Client"><select className={inputClass} name="clientId" defaultValue={project?.client_id ?? ""} required>{clients.map((client) => <option key={client.id} value={client.id}>{client.company_name}</option>)}</select></Field>
    <Field label="Accepted quote"><select className={inputClass} name="quoteId" defaultValue={project?.quote_id ?? ""}><option value="">No quote</option>{quotes.map((quote) => <option key={quote.id} value={quote.id}>{quote.title}</option>)}</select></Field>
    <Field label="Project owner"><select className={inputClass} name="assignedToId" defaultValue={project?.assigned_to ?? ""}><option value="">Unassigned</option>{users.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}</select></Field>
    <Field label="Status"><select className={inputClass} name="status" defaultValue={project?.status ?? "NOT_STARTED"}><Options values={projectStatuses} /></select></Field>
    <Field label="Priority"><select className={inputClass} name="priority" defaultValue={project?.priority ?? "MEDIUM"}><Options values={priorities} /></select></Field>
    <Field label="Deadline"><input className={inputClass} name="deadline" type="date" defaultValue={dateInput(project?.deadline)} /></Field>
    <Field label="Stage"><input className={inputClass} name="stage" defaultValue={project?.stage ?? "Kickoff"} /></Field>
    <Field label="Progress"><input className={inputClass} name="progress" type="number" min="0" max="100" defaultValue={project?.progress ?? 0} /></Field>
    <Field label="Blocker"><input className={inputClass} name="blocker" defaultValue={project?.blocker ?? ""} /></Field>
    {!project?.id ? <>
      <Field label="Checklist template"><select className={inputClass} name="checklistTemplateId" defaultValue=""><option value="">Best active default</option>{activeChecklistTemplates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}</select></Field>
      <label className="flex items-center gap-3 text-sm text-slate-300"><input name="seedChecklist" type="checkbox" defaultChecked /> Add starter checklist</label>
    </> : null}
    <div className="md:col-span-3"><SubmitButton>{project?.id ? "Save project" : "Create project"}</SubmitButton></div>
  </form>;
}

export function PaymentForm({ invoices }: { invoices: InvoiceOption[] }) {
  return <form action={recordPayment} className="grid gap-4 md:grid-cols-5"><SubmissionInput scope="record-payment" /><Field label="Invoice"><select className={inputClass} name="invoiceId" required>{invoices.map((invoice) => <option key={invoice.id} value={invoice.id}>{invoice.invoice_number}</option>)}</select></Field><Field label="Amount (R)"><input className={inputClass} name="amountRands" type="number" min="1" required /></Field><Field label="Status"><select className={inputClass} name="status" defaultValue="PAID"><Options values={paymentStatuses} /></select></Field><Field label="Method"><input className={inputClass} name="method" placeholder="EFT / Card" /></Field><Field label="Reference"><input className={inputClass} name="reference" /></Field><div className="md:col-span-5"><SubmitButton pendingLabel="Recording payment…">Record payment</SubmitButton></div></form>;
}

export function RetainerForm({ clients }: { clients: ClientOption[] }) {
  return <form action={upsertRetainer} className="grid gap-4 md:grid-cols-5"><SubmissionInput scope="upsert-retainer" /><Field label="Client"><select className={inputClass} name="clientId" required>{clients.map((client) => <option key={client.id} value={client.id}>{client.company_name}</option>)}</select></Field><Field label="Type"><input className={inputClass} name="type" defaultValue="Maintenance retainer" required /></Field><Field label="Status"><select className={inputClass} name="status"><Options values={retainerStatuses} /></select></Field><Field label="Monthly amount (R)"><input className={inputClass} name="monthlyAmountRands" type="number" min="1" required /></Field><Field label="Next billing"><input className={inputClass} name="nextBillingDate" type="date" /></Field><div className="md:col-span-5"><SubmitButton>Create retainer</SubmitButton></div></form>;
}

export function SupportTicketForm({ clients, projects, users, ticket }: { clients: ClientOption[]; projects: ProjectOption[]; users: UserOption[]; ticket?: SupportTicket }) {
  return <form action={upsertSupportTicket} className="grid gap-4 md:grid-cols-3"><SubmissionInput scope="upsert-support-ticket" />{ticket?.id ? <input type="hidden" name="id" value={ticket.id} /> : null}<Field label="Title"><input className={inputClass} name="title" defaultValue={ticket?.title ?? ""} required /></Field><Field label="Category"><select className={inputClass} name="category" defaultValue={ticket?.category ?? "OTHER"}><Options values={ticketCategories} /></select></Field><Field label="Priority"><select className={inputClass} name="priority" defaultValue={ticket?.priority ?? "MEDIUM"}><Options values={priorities} /></select></Field><Field label="Status"><select className={inputClass} name="status" defaultValue={ticket?.status ?? "NEW"}><Options values={ticketStatuses} /></select></Field><Field label="Client"><select className={inputClass} name="clientId" defaultValue={ticket?.client_id ?? ""}><option value="">No client</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.company_name}</option>)}</select></Field><Field label="Project"><select className={inputClass} name="projectId" defaultValue={ticket?.project_id ?? ""}><option value="">No project</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></Field><Field label="Assigned to"><select className={inputClass} name="assignedToId" defaultValue={ticket?.assigned_to ?? ""}><option value="">Unassigned</option>{users.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}</select></Field><Field label="Internal notes"><textarea className={inputClass} name="internalNotes" defaultValue={ticket?.internal_notes ?? ""} /></Field><Field label="Resolution notes"><textarea className={inputClass} name="resolutionNotes" defaultValue={ticket?.resolution_notes ?? ""} /></Field><div className="md:col-span-3"><SubmitButton>{ticket?.id ? "Update ticket" : "Create ticket"}</SubmitButton></div></form>;
}

export function AffiliateForm() { return <form action={upsertAffiliate} className="grid gap-4 md:grid-cols-5"><SubmissionInput scope="upsert-affiliate" /><Field label="Name"><input className={inputClass} name="name" required /></Field><Field label="Email"><input className={inputClass} name="email" type="email" required /></Field><Field label="Tracking code"><input className={inputClass} name="trackingCode" placeholder="Auto if empty" /></Field><Field label="Status"><select className={inputClass} name="status"><Options values={affiliateStatuses} /></select></Field><Field label="Commission %"><input className={inputClass} name="defaultCommissionRate" type="number" min="0" max="100" defaultValue="10" /></Field><input type="hidden" name="defaultCommissionType" value="ONCE_OFF" /><div className="md:col-span-5"><SubmitButton pendingLabel="Creating affiliate…">Create affiliate</SubmitButton></div></form>; }

export function ReferralCommissionForms({ affiliates, leads, clients, quotes, projects, payments }: { affiliates: Affiliate[]; leads: LeadOption[]; clients: ClientOption[]; quotes: QuoteOption[]; projects: ProjectOption[]; payments: Payment[] }) { return <div className="grid gap-4 xl:grid-cols-2"><Card><h3 className="mb-4 font-semibold text-white">Link referral</h3><form action={createReferral} className="grid gap-3"><SubmissionInput scope="create-referral" /><Field label="Affiliate"><select className={inputClass} name="affiliateId">{affiliates.map((affiliate) => <option key={affiliate.id} value={affiliate.id}>{affiliate.name}</option>)}</select></Field><Field label="Lead"><select className={inputClass} name="leadId"><option value="">No lead</option>{leads.map((lead) => <option key={lead.id} value={lead.id}>{lead.company_name}</option>)}</select></Field><Field label="Client"><select className={inputClass} name="clientId"><option value="">No client</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.company_name}</option>)}</select></Field><input type="hidden" name="status" value="PENDING" /><SubmitButton>Create referral</SubmitButton></form></Card><Card><h3 className="mb-4 font-semibold text-white">Record commission</h3><form action={createCommission} className="grid gap-3"><SubmissionInput scope="create-commission" /><Field label="Affiliate"><select className={inputClass} name="affiliateId">{affiliates.map((affiliate) => <option key={affiliate.id} value={affiliate.id}>{affiliate.name}</option>)}</select></Field><Field label="Quote"><select className={inputClass} name="quoteId"><option value="">No quote</option>{quotes.map((quote) => <option key={quote.id} value={quote.id}>{quote.title}</option>)}</select></Field><Field label="Project"><select className={inputClass} name="projectId"><option value="">No project</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></Field><Field label="Payment"><select className={inputClass} name="paymentId"><option value="">No payment</option>{payments.map((payment) => <option key={payment.id} value={payment.id}>{payment.reference ?? payment.id} ({payment.status})</option>)}</select></Field><Field label="Status"><select className={inputClass} name="status"><Options values={commissionStatuses} /></select></Field><Field label="Amount (R)"><input className={inputClass} name="amountRands" type="number" min="1" required /></Field><input type="hidden" name="commissionType" value="ONCE_OFF" /><SubmitButton>Record commission</SubmitButton></form></Card></div>; }

export function CampaignForm() { return <form action={upsertCampaign} className="grid gap-4 md:grid-cols-4"><SubmissionInput scope="upsert-campaign" /><Field label="Name"><input className={inputClass} name="name" required /></Field><Field label="Platform"><input className={inputClass} name="platform" defaultValue="LinkedIn" /></Field><Field label="Target industry"><input className={inputClass} name="targetIndustry" /></Field><Field label="Offer"><input className={inputClass} name="offerMessage" /></Field>{[["numberContacted", "Contacted"], ["replies", "Replies"], ["callsBooked", "Calls"], ["quotesSent", "Quotes"], ["dealsClosed", "Deals"]].map(([name, label]) => <Field key={name} label={label}><input className={inputClass} name={name} type="number" min="0" defaultValue="0" /></Field>)}<div className="md:col-span-4"><SubmitButton>Create campaign</SubmitButton></div></form>; }
export function ContentItemForm() { return <form action={upsertContentItem} className="grid gap-4 md:grid-cols-4"><SubmissionInput scope="upsert-content-item" /><Field label="Title"><input className={inputClass} name="title" required /></Field><Field label="Status"><select className={inputClass} name="status"><Options values={contentStatuses} /></select></Field><Field label="Platform"><input className={inputClass} name="platform" /></Field><Field label="Post URL"><input className={inputClass} name="postUrl" /></Field><Field label="Leads"><input className={inputClass} name="leadsGenerated" type="number" min="0" defaultValue="0" /></Field><Field label="Performance notes"><textarea className={inputClass} name="performanceNotes" /></Field><div className="md:col-span-4"><SubmitButton>Create content item</SubmitButton></div></form>; }

export function KnowledgeBaseForm() { return <form action={upsertKnowledgeBaseItem} className="grid gap-4"><SubmissionInput scope="upsert-knowledge-base-item" /><div className="grid gap-4 md:grid-cols-3"><Field label="Title"><input className={inputClass} name="title" required /></Field><Field label="Category"><select className={inputClass} name="category"><Options values={knowledgeCategories} /></select></Field><Field label="Visibility"><select className={inputClass} name="visibility"><option value="INTERNAL">Internal</option><option value="TEAM">Team</option><option value="PRIVATE">Private</option></select></Field></div><Field label="Article / SOP body"><textarea className={`${inputClass} min-h-40`} name="body" required /></Field><SubmitButton>Add article</SubmitButton></form>; }

export function ActivityWorkflowForm({ entityType, leadId, clientId, users, tasks = [], redirectTo, defaultTitle }: { entityType: "Lead" | "Client"; leadId?: string; clientId?: string; users: UserOption[]; tasks?: Task[]; redirectTo: string; defaultTitle?: string }) {
  const entityId = entityType === "Lead" ? leadId : clientId;
  return <form action={upsertActivityWorkflow} className="grid gap-4 md:grid-cols-2">
    <SubmissionInput scope="activity-workflow" />
    <input type="hidden" name="entityType" value={entityType} />
    <input type="hidden" name="entityId" value={entityId ?? ""} />
    <input type="hidden" name="leadId" value={leadId ?? ""} />
    <input type="hidden" name="clientId" value={clientId ?? ""} />
    <input type="hidden" name="redirectTo" value={redirectTo} />
    <Field label="Workflow type"><select className={inputClass} name="workflowMode" defaultValue="NOTE"><option value="NOTE">Log note only</option><option value="INTERACTION">Log call/email/message</option><option value="FOLLOW_UP">Schedule follow-up</option><option value="TASK">Assign task</option><option value="FILE">Attach file</option></select></Field>
    <Field label="Title / next action"><input className={inputClass} name="title" defaultValue={defaultTitle ?? ""} placeholder="Follow up, send recap, collect files…" /></Field>
    <Field label="Activity type"><select className={inputClass} name="eventType"><option value="NOTE">Note</option><option value="CALL">Call</option><option value="EMAIL">Email</option><option value="MESSAGE">Message</option><option value="MEETING">Meeting</option><option value="FOLLOW_UP">Follow-up</option><option value="TASK">Task</option><option value="OTHER">Other</option></select></Field>
    <Field label="Direction"><select className={inputClass} name="direction"><option value="OUTBOUND">Outbound</option><option value="RECEIVED">Received</option><option value="INTERNAL">Internal</option></select></Field>
    <Field label="Outcome"><input className={inputClass} name="outcome" placeholder="Interested / sent proposal / no answer" /></Field>
    <Field label="Related task"><select className={inputClass} name="taskId"><option value="">No task</option>{tasks.map((task) => <option key={task.id} value={task.id}>{task.title}</option>)}</select></Field>
    <Field label="Follow-up / due date"><input className={inputClass} name="dueDate" type="datetime-local" /></Field>
    <Field label="Assign to"><select className={inputClass} name="assignedToId"><option value="">Unassigned</option>{users.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}</select></Field>
    <div className="md:col-span-2 grid gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3">
      <p className="text-sm font-semibold text-white">Options</p>
      <div className="grid gap-2 text-sm text-slate-300 md:grid-cols-2">
        <label className="flex items-center gap-2"><input name="createNote" type="checkbox" defaultChecked /> Create note</label>
        <span className="text-slate-400">Activity log is always recorded</span>
        <label className="flex items-center gap-2"><input name="createTask" type="checkbox" /> Create task / follow-up</label>
        <label className="flex items-center gap-2"><input name="updateEntity" type="checkbox" defaultChecked /> Update next action</label>
        <label className="flex items-center gap-2"><input name="completeRelatedTask" type="checkbox" /> Complete related task</label>
        <label className="flex items-center gap-2"><input name="attachFile" type="checkbox" /> Attach file or link</label>
      </div>
    </div>
    <Field label="Activity details"><textarea className={inputClass} name="summary" placeholder="What happened, what needs to happen next, or file context." required /></Field>
    <Field label="Objections / important replies"><textarea className={inputClass} name="objections" placeholder="Price, timing, blockers, decision maker, etc." /></Field>
    <div className="md:col-span-2 grid gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3">
      <p className="text-sm font-semibold text-white">Attachment</p>
      <div className="grid gap-3 md:grid-cols-2"><Field label="File name"><input className={inputClass} name="filename" placeholder="Defaults to selected file name" /></Field><Field label="Upload file"><input className={inputClass} name="file" type="file" accept="application/pdf,image/jpeg,image/png,image/webp,text/plain,text/csv,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" /></Field><Field label="External URL"><input className={inputClass} name="url" type="url" placeholder="https://..." /></Field><Field label="External MIME type"><input className={inputClass} name="mimeType" placeholder="application/pdf" /></Field></div>
    </div>
    <div className="md:col-span-2"><SubmitButton pendingLabel="Saving activity…">Save activity workflow</SubmitButton></div>
  </form>;
}

export function NoteForm({ entityType, entityId, clientId, leadId, projectId, redirectTo }: { entityType: string; entityId: string; clientId?: string; leadId?: string; projectId?: string; redirectTo: string }) { return <form action={addNote} className="grid gap-3"><SubmissionInput scope="add-note" /><input type="hidden" name="entityType" value={entityType} /><input type="hidden" name="entityId" value={entityId} /><input type="hidden" name="clientId" value={clientId ?? ""} /><input type="hidden" name="leadId" value={leadId ?? ""} /><input type="hidden" name="projectId" value={projectId ?? ""} /><input type="hidden" name="redirectTo" value={redirectTo} /><Field label="Add note"><textarea className={inputClass} name="body" required /></Field><SubmitButton>Add note</SubmitButton></form>; }
export function FileRecordForm({ entityType, entityId, clientId, leadId, projectId, knowledgeBaseItemId, redirectTo }: { entityType: string; entityId: string; clientId?: string; leadId?: string; projectId?: string; knowledgeBaseItemId?: string; redirectTo: string }) {
  const [state, formAction] = useActionState(addFileRecord, { ok: false });
  const typedLeadId = leadId ?? (entityType === "Lead" ? entityId : "");
  const typedClientId = clientId ?? (entityType === "Client" ? entityId : "");
  const typedProjectId = projectId ?? (entityType === "Project" ? entityId : "");
  const typedKnowledgeBaseItemId = knowledgeBaseItemId ?? (entityType === "KnowledgeBase" ? entityId : "");
  return <form action={formAction} className="grid gap-3"><FormError message={state.formError} /><SubmissionInput scope="add-file-record" /><input type="hidden" name="entityType" value={entityType} /><input type="hidden" name="entityId" value={entityId} /><input type="hidden" name="clientId" value={typedClientId} /><input type="hidden" name="leadId" value={typedLeadId} /><input type="hidden" name="projectId" value={typedProjectId} /><input type="hidden" name="knowledgeBaseItemId" value={typedKnowledgeBaseItemId} /><input type="hidden" name="redirectTo" value={redirectTo} /><Field label="File name"><input className={inputClass} name="filename" placeholder="Defaults to selected file name" /></Field><Field label="Upload file"><input className={inputClass} name="file" type="file" accept="application/pdf,image/jpeg,image/png,image/webp,text/plain,text/csv,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" /></Field><div className="rounded-xl border border-white/10 bg-white/[0.03] p-3"><p className="mb-3 text-sm font-semibold text-white">Add external link</p><Field label="External URL"><input className={inputClass} name="url" type="url" placeholder="https://..." /></Field><Field label="External MIME type"><input className={inputClass} name="mimeType" placeholder="application/pdf" /></Field></div><p className="text-xs text-slate-500">Uploads accept PDFs, images, text, CSV, Word and Excel files up to 10 MB. Use the external link fields only for files already hosted elsewhere.</p><SubmitButton pendingLabel="Saving file…">Upload file</SubmitButton></form>; }
export function ChecklistTemplateForm({ services, templates }: { services: ServiceOption[]; templates: ChecklistTemplate[] }) { return <div className="grid gap-4 xl:grid-cols-2"><form action={createChecklistTemplate} className="grid gap-3"><SubmissionInput scope="create-checklist-template" /><h3 className="font-semibold text-white">Create checklist template</h3><Field label="Name"><input className={inputClass} name="name" required /></Field><Field label="Service"><select className={inputClass} name="serviceId"><option value="">General</option>{services.map((service) => <option key={service.id} value={service.id}>{service.name}</option>)}</select></Field><Field label="Description"><textarea className={inputClass} name="description" /></Field><Field label="First item"><input className={inputClass} name="firstItemTitle" /></Field><label className="flex items-center gap-3 text-sm text-slate-300"><input name="isActive" type="checkbox" defaultChecked /> Active template</label><SubmitButton>Create template</SubmitButton></form><form action={createChecklistItem} className="grid gap-3"><SubmissionInput scope="create-checklist-item" /><h3 className="font-semibold text-white">Add checklist item</h3><Field label="Template"><select className={inputClass} name="templateId">{templates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}</select></Field><Field label="Item title"><input className={inputClass} name="title" required /></Field><Field label="Description"><textarea className={inputClass} name="description" /></Field><Field label="Sort order"><input className={inputClass} name="sortOrder" type="number" min="0" defaultValue="0" /></Field><SubmitButton>Add item</SubmitButton></form></div>; }

export function ChecklistTemplateEditForm({ template, services }: { template: ChecklistTemplate; services: ServiceOption[] }) { return <form action={createChecklistTemplate} className="grid gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3 md:grid-cols-4"><input type="hidden" name="id" value={template.id} /><Field label="Template"><input className={inputClass} name="name" defaultValue={template.name} required /></Field><Field label="Service"><select className={inputClass} name="serviceId" defaultValue={template.service_id ?? ""}><option value="">General</option>{services.map((service) => <option key={service.id} value={service.id}>{service.name}</option>)}</select></Field><Field label="Description"><input className={inputClass} name="description" defaultValue={template.description ?? ""} /></Field><label className="flex items-center gap-3 self-end text-sm text-slate-300"><input name="isActive" type="checkbox" defaultChecked={template.is_active} /> Active</label><div className="md:col-span-4"><SubmitButton>Save template</SubmitButton></div></form>; }

export function ChecklistItemEditForm({ item, templates }: { item: ChecklistItem; templates: ChecklistTemplate[] }) { return <form action={createChecklistItem} className="grid gap-3 rounded-xl border border-white/10 bg-slate-950/35 p-3 md:grid-cols-5"><input type="hidden" name="id" value={item.id} /><Field label="Template"><select className={inputClass} name="templateId" defaultValue={item.template_id}>{templates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}</select></Field><Field label="Item"><input className={inputClass} name="title" defaultValue={item.title} required /></Field><Field label="Description"><input className={inputClass} name="description" defaultValue={item.description ?? ""} /></Field><Field label="Sort"><input className={inputClass} name="sortOrder" type="number" min="0" defaultValue={item.sort_order} /></Field><div className="flex items-end"><SubmitButton>Save item</SubmitButton></div></form>; }

export function ServiceForm({ service }: { service?: Service }) {
  return <form action={upsertService} className="grid gap-4 md:grid-cols-3">
    <SubmissionInput scope="upsert-service" />
    {service?.id ? <input type="hidden" name="id" value={service.id} /> : null}
    <Field label="Service name"><input className={inputClass} name="name" placeholder="Website development" defaultValue={service?.name ?? ""} required /></Field>
    <Field label="Category"><input className={inputClass} name="category" placeholder="Web / AI & Automation" defaultValue={service?.category ?? ""} required /></Field>
    <Field label="Once-off (R)"><input className={inputClass} name="baseOnceOffRands" type="number" min="0" defaultValue={rands(service?.base_once_off_cents ?? 0)} /></Field>
    <Field label="Monthly (R)"><input className={inputClass} name="baseMonthlyRands" type="number" min="0" defaultValue={rands(service?.base_monthly_cents ?? 0)} /></Field>
    <Field label="Description"><textarea className={inputClass} name="description" placeholder="What this service includes" defaultValue={service?.description ?? ""} required /></Field>
    <label className="flex items-center gap-3 text-sm text-slate-300"><input name="isActive" type="checkbox" defaultChecked={service?.is_active ?? true} /> Active service</label>
    <input type="hidden" name="redirectTo" value="/services" />
    <div className="md:col-span-3"><SubmitButton>{service ? "Save service changes" : "Save service pricing"}</SubmitButton></div>
  </form>;
}

export function AssignLinkedTaskForm({ entityType, leadId, clientId, users, redirectTo }: { entityType: "Lead" | "Client"; leadId?: string; clientId?: string; users: UserOption[]; redirectTo: string }) {
  return <form action={assignLinkedTask} className="grid gap-4 md:grid-cols-2">
    <SubmissionInput scope="linked-task" />
    <input type="hidden" name="entityType" value={entityType} />
    <input type="hidden" name="leadId" value={leadId ?? ""} />
    <input type="hidden" name="clientId" value={clientId ?? ""} />
    <input type="hidden" name="redirectTo" value={redirectTo} />
    <Field label="Task title"><input className={inputClass} name="title" required /></Field>
    <Field label="Due date/time"><input className={inputClass} name="dueDate" type="datetime-local" /></Field>
    <Field label="Assign to"><select className={inputClass} name="assignedToId"><option value="">Unassigned</option>{users.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}</select></Field>
    <Field label="Task info"><textarea className={inputClass} name="description" placeholder="Instructions, context, files needed, links, etc." /></Field>
    <div className="md:col-span-2"><SubmitButton pendingLabel="Assigning task…">Assign task</SubmitButton></div>
  </form>;
}

export function InteractionEventForm({ entityType, leadId, clientId, users, tasks = [], redirectTo }: { entityType: "Lead" | "Client"; leadId?: string; clientId?: string; users: UserOption[]; tasks?: Task[]; redirectTo: string }) {
  const entityId = entityType === "Lead" ? leadId : clientId;
  return <div className="grid gap-4"><div className="flex flex-wrap gap-2"><ModalPanel title="Book event" triggerLabel="Book event" variant="ghost"><BookEventForm entityType={entityType} leadId={leadId} clientId={clientId} defaultTitle={entityType === "Lead" ? "Call with lead" : "Meeting with client"} users={users} redirectTo={redirectTo} /></ModalPanel><ModalPanel title="Upload file" triggerLabel="Upload file" variant="ghost"><FileRecordForm entityType={entityType} entityId={entityId ?? ""} clientId={clientId} redirectTo={redirectTo} /></ModalPanel><ModalPanel title="Assign task" triggerLabel="Assign task" variant="ghost"><AssignLinkedTaskForm entityType={entityType} leadId={leadId} clientId={clientId} users={users} redirectTo={redirectTo} /></ModalPanel></div><form action={logInteractionEvent} className="grid gap-4">
    <SubmissionInput scope="interaction-event" />
    <input type="hidden" name="entityType" value={entityType} />
    <input type="hidden" name="leadId" value={leadId ?? ""} />
    <input type="hidden" name="clientId" value={clientId ?? ""} />
    <input type="hidden" name="redirectTo" value={redirectTo} />
    <div className="grid gap-4 md:grid-cols-3">
      <Field label="Event type"><select className={inputClass} name="eventType"><option value="CALL">Call</option><option value="EMAIL">Email</option><option value="MESSAGE">Message</option><option value="TASK">Task completed</option><option value="OTHER">Other</option></select></Field>
      <Field label="Direction"><select className={inputClass} name="direction"><option value="OUTBOUND">Outbound</option><option value="RECEIVED">Received</option><option value="INTERNAL">Internal note</option></select></Field>
      <Field label="Outcome"><input className={inputClass} name="outcome" placeholder="Interested / No answer / Sent info" /></Field>
    </div>
    <Field label="Related task"><select className={inputClass} name="taskId"><option value="">No task</option>{tasks.map((task) => <option key={task.id} value={task.id}>{task.title}</option>)}</select></Field>
    <Field label="What happened?"><textarea className={inputClass} name="summary" placeholder="Log the call, email, message or other interaction." required /></Field>
    <Field label="Objections / important replies"><textarea className={inputClass} name="objections" placeholder="Price, timing, decision maker, message received, blockers, etc." /></Field>
        <SubmitButton pendingLabel="Logging event…">Log event</SubmitButton>
  </form></div>;
}

export function BookEventForm({ entityType, leadId, clientId, defaultTitle, users, redirectTo }: { entityType: "Lead" | "Client"; leadId?: string; clientId?: string; defaultTitle: string; users: UserOption[]; redirectTo: string }) {
  return <form action={bookEvent} className="grid gap-4 md:grid-cols-2">
    <SubmissionInput scope="book-event" />
    <input type="hidden" name="entityType" value={entityType} />
    <input type="hidden" name="leadId" value={leadId ?? ""} />
    <input type="hidden" name="clientId" value={clientId ?? ""} />
    <input type="hidden" name="redirectTo" value={redirectTo} />
    <Field label="Event type"><select className={inputClass} name="eventType"><option value="CALL">Call</option><option value="MEETING">Meeting</option><option value="FOLLOW_UP">Follow-up</option><option value="OTHER">Other</option></select></Field>
    <Field label="Event title"><input className={inputClass} name="title" defaultValue={defaultTitle} required /></Field>
    <Field label="Date and time"><input className={inputClass} name="eventAt" type="datetime-local" required /></Field>
    <Field label="Owner"><select className={inputClass} name="assignedToId"><option value="">Unassigned</option>{users.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}</select></Field>
    <Field label="Notes"><textarea className={inputClass} name="notes" placeholder="Agenda, context, joining link, or preparation notes." /></Field>
    <div className="md:col-span-2"><SubmitButton pendingLabel="Booking event…">Book event</SubmitButton></div>
  </form>;
}

export function LeadCallForm({ leadId, users, redirectTo }: { leadId: string; users: UserOption[]; redirectTo: string }) {
  return <form action={logLeadCall} className="grid gap-4">
    <SubmissionInput scope="lead-call" />
    <input type="hidden" name="leadId" value={leadId} />
    <input type="hidden" name="redirectTo" value={redirectTo} />
    <Field label="What happened on the call?"><textarea className={inputClass} name="callSummary" placeholder="Summarize what they said, needs, budget, timing, and context." required /></Field>
    <Field label="Objections / blockers"><textarea className={inputClass} name="objections" placeholder="Price, timing, decision maker, trust, scope, etc." /></Field>
    <div className="grid gap-4 md:grid-cols-3">
      <Field label="Outcome"><input className={inputClass} name="outcome" placeholder="Booked discovery / Follow up / Not interested" required /></Field>
      <Field label="Booked/follow-up date"><input className={inputClass} name="bookedCallAt" type="datetime-local" /></Field>
      <Field label="Assign next task"><select className={inputClass} name="assignedToId"><option value="">Unassigned</option>{users.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}</select></Field>
    </div>
    <Field label="Next action"><input className={inputClass} name="nextAction" placeholder="Send proposal, WhatsApp tomorrow, prepare demo..." /></Field>
    <SubmitButton pendingLabel="Logging call…">Log call / next step</SubmitButton>
  </form>;
}

export function CompanySettingsForm({ settings }: { settings?: import("@/lib/types").CompanySettings | null }) {
  return <form action={upsertCompanySettings} className="grid gap-4 md:grid-cols-2">
    <Field label="Company name"><input className={inputClass} name="companyName" defaultValue={settings?.company_name ?? "Rapid Rise AI (Pty) Ltd"} required /></Field>
    <Field label="Billing email"><input className={inputClass} name="billingEmail" type="email" defaultValue={settings?.billing_email ?? ""} /></Field>
    <Field label="Bank name"><input className={inputClass} name="bankName" defaultValue={settings?.bank_name ?? ""} /></Field>
    <Field label="Account name"><input className={inputClass} name="bankAccountName" defaultValue={settings?.bank_account_name ?? ""} /></Field>
    <Field label="Account number"><input className={inputClass} name="bankAccountNumber" defaultValue={settings?.bank_account_number ?? ""} /></Field>
    <Field label="Branch code"><input className={inputClass} name="bankBranchCode" defaultValue={settings?.bank_branch_code ?? ""} /></Field>
    <Field label="Payment terms"><textarea className={inputClass} name="paymentTerms" defaultValue={settings?.payment_terms ?? ""} /></Field>
    <Field label="Quote footer"><textarea className={inputClass} name="quoteFooter" defaultValue={settings?.quote_footer ?? ""} /></Field>
    <Field label="Invoice footer"><textarea className={inputClass} name="invoiceFooter" defaultValue={settings?.invoice_footer ?? ""} /></Field>
    <div className="md:col-span-2"><SubmitButton>Save billing/document settings</SubmitButton></div>
  </form>;
}

export function DocumentTemplateForm() {
  return <form action={createDocumentTemplate} className="grid gap-4">
    <Field label="Template name"><input className={inputClass} name="name" required /></Field>
    <Field label="Type"><select className={inputClass} name="type"><option value="QUOTE">Quote</option><option value="INVOICE">Invoice</option><option value="PROPOSAL">Proposal</option><option value="HANDOVER">Handover</option></select></Field>
    <Field label="Template content"><textarea className={`${inputClass} min-h-32`} name="content" placeholder="Use placeholders like {{client_name}}, {{quote_title}}, {{amount}}" required /></Field>
    <label className="flex items-center gap-3 text-sm text-slate-300"><input name="isDefault" type="checkbox" /> Make default</label>
    <SubmitButton>Add document template</SubmitButton>
  </form>;
}
