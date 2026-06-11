import { randomUUID } from "crypto";
import { acceptQuote, addFileRecord, addNote, createChecklistItem, createChecklistTemplate, createCommission, createReferral, recordPayment, upsertAffiliate, upsertCampaign, upsertClient, upsertContentItem, upsertInvoice, upsertKnowledgeBaseItem, upsertLead, upsertProject, upsertQuote, upsertRetainer, upsertSupportTicket, upsertTask, upsertUser } from "@/lib/actions";
import { affiliateStatuses, clientStatuses, commissionStatuses, contentStatuses, invoiceStatuses, knowledgeCategories, labelize, leadStages, paymentStatuses, priorities, projectStatuses, quoteStatuses, retainerStatuses, taskStatuses, taskTypes, ticketCategories, ticketStatuses } from "@/lib/constants";
import type { Affiliate, Client, Lead, Payment, Project, Quote, Service, SupportTicket } from "@/lib/types";
import { Card, Field, inputClass } from "./ui";
import { SubmitButton } from "./submit-button";

export type UserOption = { id: string; name: string };
export type ProjectOption = { id: string; name: string; client_id?: string };
export type RoleOption = { id: string; name: string };
export type ClientOption = { id: string; company_name: string };
export type LeadOption = { id: string; company_name: string };
export type QuoteOption = { id: string; title: string; client_id: string | null };
export type InvoiceOption = { id: string; invoice_number: string; amount_cents: number };
export type ServiceOption = Pick<Service, "id" | "name" | "base_once_off_cents" | "base_monthly_cents">;

function dateInput(value?: string | null) {
  return value ? value.slice(0, 10) : "";
}

function Options({ values }: { values: readonly string[] }) {
  return values.map((value) => <option key={value} value={value}>{labelize(value)}</option>);
}

function SubmissionInput({ scope }: { scope: string }) {
  return <input type="hidden" name="submissionKey" value={`${scope}:${randomUUID()}`} />;
}

export function LeadForm({ lead, users }: { lead?: Lead; users: UserOption[] }) {
  return (
    <form action={upsertLead} className="grid gap-4 md:grid-cols-2"><SubmissionInput scope="upsert-lead" />
      {lead?.id ? <input type="hidden" name="id" value={lead.id} /> : null}
      <Field label="Company"><input className={inputClass} name="companyName" defaultValue={lead?.company_name ?? ""} required /></Field>
      <Field label="Contact"><input className={inputClass} name="contactName" defaultValue={lead?.contact_name ?? ""} required /></Field>
      <Field label="Email"><input className={inputClass} name="email" type="email" defaultValue={lead?.email ?? ""} /></Field>
      <Field label="Phone"><input className={inputClass} name="phone" defaultValue={lead?.phone ?? ""} /></Field>
      <Field label="Source"><input className={inputClass} name="source" defaultValue={lead?.source ?? "Referral"} required /></Field>
      <Field label="Service interest"><input className={inputClass} name="serviceInterest" defaultValue={lead?.service_interest ?? "Website development"} required /></Field>
      <Field label="Stage"><select className={inputClass} name="stage" defaultValue={lead?.stage ?? "NEW_LEAD"}><Options values={leadStages} /></select></Field>
      <Field label="Lead score"><input className={inputClass} name="score" type="number" min="0" max="100" defaultValue={lead?.score ?? 50} /></Field>
      <Field label="Follow-up date"><input className={inputClass} name="followUpDate" type="date" defaultValue={dateInput(lead?.follow_up_date)} /></Field>
      <Field label="Assigned to"><select className={inputClass} name="assignedToId" defaultValue={lead?.assigned_to ?? ""}><option value="">Unassigned</option>{users.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}</select></Field>
      <Field label="Next action"><input className={inputClass} name="nextAction" defaultValue={lead?.next_action ?? ""} /></Field>
      <Field label="Pain points"><textarea className={inputClass} name="painPoints" defaultValue={lead?.pain_points ?? ""} /></Field>
      <div className="md:col-span-2"><SubmitButton>Save lead</SubmitButton></div>
    </form>
  );
}

export function ClientForm({ client }: { client?: Client }) {
  return (
    <form action={upsertClient} className="grid gap-4 md:grid-cols-2"><SubmissionInput scope="upsert-client" />
      {client?.id ? <input type="hidden" name="id" value={client.id} /> : null}
      <Field label="Company"><input className={inputClass} name="companyName" defaultValue={client?.company_name ?? ""} required /></Field>
      <Field label="Status"><select className={inputClass} name="accountStatus" defaultValue={client?.account_status ?? "ACTIVE"}><Options values={clientStatuses} /></select></Field>
      <Field label="Industry"><input className={inputClass} name="industry" defaultValue={client?.industry ?? ""} /></Field>
      <Field label="Website"><input className={inputClass} name="website" defaultValue={client?.website ?? ""} /></Field>
      <Field label="Primary email"><input className={inputClass} name="primaryEmail" type="email" defaultValue={client?.primary_email ?? ""} /></Field>
      <Field label="Primary phone"><input className={inputClass} name="primaryPhone" defaultValue={client?.primary_phone ?? ""} /></Field>
      <Field label="MRR cents"><input className={inputClass} name="mrrCents" type="number" min="0" defaultValue={client?.mrr_cents ?? 0} /></Field>
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
      <Field label="Due date"><input className={inputClass} type="date" name="dueDate" /></Field>
      <Field label="Assignee"><select className={inputClass} name="assignedToId"><option value="">Unassigned</option>{users.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}</select></Field>
      <Field label="Client"><select className={inputClass} name="clientId"><option value="">No client</option>{clients?.map((client) => <option key={client.id} value={client.id}>{client.company_name}</option>)}</select></Field>
      <Field label="Project"><select className={inputClass} name="projectId"><option value="">No project</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></Field>
      <Field label="Description"><textarea className={inputClass} name="description" /></Field>
      <div className="flex items-end"><SubmitButton>Create task</SubmitButton></div>
    </form>
  );
}

export function UserForm({ roles }: { roles: RoleOption[] }) {
  return (
    <form action={upsertUser} className="grid gap-4 md:grid-cols-3"><SubmissionInput scope="upsert-user" />
      <Field label="Name"><input className={inputClass} name="name" required /></Field>
      <Field label="Email"><input className={inputClass} name="email" type="email" required /></Field>
      <Field label="Temporary password"><input className={inputClass} name="password" type="password" minLength={10} required /></Field>
      <Field label="Role"><select className={inputClass} name="roleId">{roles.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}</select></Field>
      <Field label="Title"><input className={inputClass} name="title" /></Field>
      <Field label="Phone"><input className={inputClass} name="phone" /></Field>
      <input type="hidden" name="status" value="ACTIVE" />
      <div className="md:col-span-3"><SubmitButton>Add employee</SubmitButton></div>
    </form>
  );
}

export function QuoteForm({ clients, leads, services }: { clients: ClientOption[]; leads: LeadOption[]; services: ServiceOption[] }) {
  return <form action={upsertQuote} className="grid gap-4 md:grid-cols-3"><SubmissionInput scope="upsert-quote" />
    <Field label="Title"><input className={inputClass} name="title" required /></Field>
    <Field label="Status"><select className={inputClass} name="status" defaultValue="DRAFT"><Options values={quoteStatuses} /></select></Field>
    <Field label="Valid until"><input className={inputClass} type="date" name="validUntil" /></Field>
    <Field label="Client"><select className={inputClass} name="clientId"><option value="">No client yet</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.company_name}</option>)}</select></Field>
    <Field label="Lead"><select className={inputClass} name="leadId"><option value="">No lead</option>{leads.map((lead) => <option key={lead.id} value={lead.id}>{lead.company_name}</option>)}</select></Field>
    <Field label="Service"><select className={inputClass} name="serviceId"><option value="">Custom item</option>{services.map((service) => <option key={service.id} value={service.id}>{service.name}</option>)}</select></Field>
    <Field label="Line item description"><input className={inputClass} name="itemDescription" defaultValue="Rapid Rise AI implementation package" required /></Field>
    <Field label="Quantity"><input className={inputClass} type="number" name="itemQuantity" min="1" defaultValue="1" /></Field>
    <Field label="Once-off cents"><input className={inputClass} type="number" name="itemOnceOffCents" min="0" defaultValue="0" /></Field>
    <Field label="Monthly cents"><input className={inputClass} type="number" name="itemMonthlyCents" min="0" defaultValue="0" /></Field>
    <Field label="Internal notes"><textarea className={inputClass} name="internalNotes" /></Field>
    <div className="flex items-end"><SubmitButton>Create quote</SubmitButton></div>
  </form>;
}

export function AcceptQuoteButton({ quote }: { quote: Quote }) {
  if (quote.status === "ACCEPTED") return null;
  return <form action={acceptQuote}><SubmissionInput scope="accept-quote" /><input type="hidden" name="id" value={quote.id} /><SubmitButton pendingLabel="Creating project…">Accept & create project</SubmitButton></form>;
}

export function ProjectForm({ clients, quotes, project }: { clients: ClientOption[]; quotes: QuoteOption[]; project?: Project }) {
  return <form action={upsertProject} className="grid gap-4 md:grid-cols-3"><SubmissionInput scope="upsert-project" />
    {project?.id ? <input type="hidden" name="id" value={project.id} /> : null}
    <Field label="Project name"><input className={inputClass} name="name" defaultValue={project?.name ?? ""} required /></Field>
    <Field label="Client"><select className={inputClass} name="clientId" defaultValue={project?.client_id ?? ""} required>{clients.map((client) => <option key={client.id} value={client.id}>{client.company_name}</option>)}</select></Field>
    <Field label="Accepted quote"><select className={inputClass} name="quoteId" defaultValue={project?.quote_id ?? ""}><option value="">No quote</option>{quotes.map((quote) => <option key={quote.id} value={quote.id}>{quote.title}</option>)}</select></Field>
    <Field label="Status"><select className={inputClass} name="status" defaultValue={project?.status ?? "NOT_STARTED"}><Options values={projectStatuses} /></select></Field>
    <Field label="Priority"><select className={inputClass} name="priority" defaultValue={project?.priority ?? "MEDIUM"}><Options values={priorities} /></select></Field>
    <Field label="Deadline"><input className={inputClass} name="deadline" type="date" defaultValue={dateInput(project?.deadline)} /></Field>
    <Field label="Stage"><input className={inputClass} name="stage" defaultValue={project?.stage ?? "Kickoff"} /></Field>
    <Field label="Progress"><input className={inputClass} name="progress" type="number" min="0" max="100" defaultValue={project?.progress ?? 0} /></Field>
    <Field label="Blocker"><input className={inputClass} name="blocker" defaultValue={project?.blocker ?? ""} /></Field>
    {!project?.id ? <label className="flex items-center gap-3 text-sm text-slate-300"><input name="seedChecklist" type="checkbox" defaultChecked /> Add starter checklist</label> : null}
    <div className="md:col-span-3"><SubmitButton>{project?.id ? "Save project" : "Create project"}</SubmitButton></div>
  </form>;
}

export function InvoiceForm({ clients }: { clients: ClientOption[] }) {
  return <form action={upsertInvoice} className="grid gap-4 md:grid-cols-4"><SubmissionInput scope="upsert-invoice" /><Field label="Client"><select className={inputClass} name="clientId" required>{clients.map((client) => <option key={client.id} value={client.id}>{client.company_name}</option>)}</select></Field><Field label="Invoice #"><input className={inputClass} name="invoiceNumber" placeholder="Auto if empty" /></Field><Field label="Status"><select className={inputClass} name="status" defaultValue="SENT"><Options values={invoiceStatuses} /></select></Field><Field label="Amount cents"><input className={inputClass} name="amountCents" type="number" min="1" required /></Field><Field label="Due date"><input className={inputClass} name="dueDate" type="date" /></Field><div className="flex items-end"><SubmitButton pendingLabel="Creating invoice…">Create invoice</SubmitButton></div></form>;
}

export function PaymentForm({ invoices }: { invoices: InvoiceOption[] }) {
  return <form action={recordPayment} className="grid gap-4 md:grid-cols-5"><SubmissionInput scope="record-payment" /><Field label="Invoice"><select className={inputClass} name="invoiceId" required>{invoices.map((invoice) => <option key={invoice.id} value={invoice.id}>{invoice.invoice_number}</option>)}</select></Field><Field label="Amount cents"><input className={inputClass} name="amountCents" type="number" min="1" required /></Field><Field label="Status"><select className={inputClass} name="status" defaultValue="PAID"><Options values={paymentStatuses} /></select></Field><Field label="Method"><input className={inputClass} name="method" placeholder="EFT / Card" /></Field><Field label="Reference"><input className={inputClass} name="reference" /></Field><div className="md:col-span-5"><SubmitButton pendingLabel="Recording payment…">Record payment</SubmitButton></div></form>;
}

export function RetainerForm({ clients }: { clients: ClientOption[] }) {
  return <form action={upsertRetainer} className="grid gap-4 md:grid-cols-5"><SubmissionInput scope="upsert-retainer" /><Field label="Client"><select className={inputClass} name="clientId" required>{clients.map((client) => <option key={client.id} value={client.id}>{client.company_name}</option>)}</select></Field><Field label="Type"><input className={inputClass} name="type" defaultValue="Maintenance retainer" required /></Field><Field label="Status"><select className={inputClass} name="status"><Options values={retainerStatuses} /></select></Field><Field label="Monthly cents"><input className={inputClass} name="monthlyAmountCents" type="number" min="1" required /></Field><Field label="Next billing"><input className={inputClass} name="nextBillingDate" type="date" /></Field><div className="md:col-span-5"><SubmitButton>Create retainer</SubmitButton></div></form>;
}

export function SupportTicketForm({ clients, projects, users, ticket }: { clients: ClientOption[]; projects: ProjectOption[]; users: UserOption[]; ticket?: SupportTicket }) {
  return <form action={upsertSupportTicket} className="grid gap-4 md:grid-cols-3"><SubmissionInput scope="upsert-support-ticket" />{ticket?.id ? <input type="hidden" name="id" value={ticket.id} /> : null}<Field label="Title"><input className={inputClass} name="title" defaultValue={ticket?.title ?? ""} required /></Field><Field label="Category"><select className={inputClass} name="category" defaultValue={ticket?.category ?? "OTHER"}><Options values={ticketCategories} /></select></Field><Field label="Priority"><select className={inputClass} name="priority" defaultValue={ticket?.priority ?? "MEDIUM"}><Options values={priorities} /></select></Field><Field label="Status"><select className={inputClass} name="status" defaultValue={ticket?.status ?? "NEW"}><Options values={ticketStatuses} /></select></Field><Field label="Client"><select className={inputClass} name="clientId" defaultValue={ticket?.client_id ?? ""}><option value="">No client</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.company_name}</option>)}</select></Field><Field label="Project"><select className={inputClass} name="projectId" defaultValue={ticket?.project_id ?? ""}><option value="">No project</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></Field><Field label="Assigned to"><select className={inputClass} name="assignedToId" defaultValue={ticket?.assigned_to ?? ""}><option value="">Unassigned</option>{users.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}</select></Field><Field label="Internal notes"><textarea className={inputClass} name="internalNotes" defaultValue={ticket?.internal_notes ?? ""} /></Field><Field label="Resolution notes"><textarea className={inputClass} name="resolutionNotes" defaultValue={ticket?.resolution_notes ?? ""} /></Field><div className="md:col-span-3"><SubmitButton>{ticket?.id ? "Update ticket" : "Create ticket"}</SubmitButton></div></form>;
}

export function AffiliateForm() { return <form action={upsertAffiliate} className="grid gap-4 md:grid-cols-5"><SubmissionInput scope="upsert-affiliate" /><Field label="Name"><input className={inputClass} name="name" required /></Field><Field label="Email"><input className={inputClass} name="email" type="email" required /></Field><Field label="Tracking code"><input className={inputClass} name="trackingCode" placeholder="Auto if empty" /></Field><Field label="Status"><select className={inputClass} name="status"><Options values={affiliateStatuses} /></select></Field><Field label="Commission %"><input className={inputClass} name="defaultCommissionRate" type="number" min="0" max="100" defaultValue="10" /></Field><input type="hidden" name="defaultCommissionType" value="ONCE_OFF" /><div className="md:col-span-5"><SubmitButton pendingLabel="Creating affiliate…">Create affiliate</SubmitButton></div></form>; }

export function ReferralCommissionForms({ affiliates, leads, clients, quotes, projects, payments }: { affiliates: Affiliate[]; leads: LeadOption[]; clients: ClientOption[]; quotes: QuoteOption[]; projects: ProjectOption[]; payments: Payment[] }) { return <div className="grid gap-4 xl:grid-cols-2"><Card><h3 className="mb-4 font-semibold text-white">Link referral</h3><form action={createReferral} className="grid gap-3"><SubmissionInput scope="create-referral" /><Field label="Affiliate"><select className={inputClass} name="affiliateId">{affiliates.map((affiliate) => <option key={affiliate.id} value={affiliate.id}>{affiliate.name}</option>)}</select></Field><Field label="Lead"><select className={inputClass} name="leadId"><option value="">No lead</option>{leads.map((lead) => <option key={lead.id} value={lead.id}>{lead.company_name}</option>)}</select></Field><Field label="Client"><select className={inputClass} name="clientId"><option value="">No client</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.company_name}</option>)}</select></Field><input type="hidden" name="status" value="PENDING" /><SubmitButton>Create referral</SubmitButton></form></Card><Card><h3 className="mb-4 font-semibold text-white">Record commission</h3><form action={createCommission} className="grid gap-3"><SubmissionInput scope="create-commission" /><Field label="Affiliate"><select className={inputClass} name="affiliateId">{affiliates.map((affiliate) => <option key={affiliate.id} value={affiliate.id}>{affiliate.name}</option>)}</select></Field><Field label="Quote"><select className={inputClass} name="quoteId"><option value="">No quote</option>{quotes.map((quote) => <option key={quote.id} value={quote.id}>{quote.title}</option>)}</select></Field><Field label="Project"><select className={inputClass} name="projectId"><option value="">No project</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></Field><Field label="Payment"><select className={inputClass} name="paymentId"><option value="">No payment</option>{payments.map((payment) => <option key={payment.id} value={payment.id}>{payment.reference ?? payment.id} ({payment.status})</option>)}</select></Field><Field label="Status"><select className={inputClass} name="status"><Options values={commissionStatuses} /></select></Field><Field label="Amount cents"><input className={inputClass} name="amountCents" type="number" min="1" required /></Field><input type="hidden" name="commissionType" value="ONCE_OFF" /><SubmitButton>Record commission</SubmitButton></form></Card></div>; }

export function CampaignForm() { return <form action={upsertCampaign} className="grid gap-4 md:grid-cols-4"><SubmissionInput scope="upsert-campaign" /><Field label="Name"><input className={inputClass} name="name" required /></Field><Field label="Platform"><input className={inputClass} name="platform" defaultValue="LinkedIn" /></Field><Field label="Target industry"><input className={inputClass} name="targetIndustry" /></Field><Field label="Offer"><input className={inputClass} name="offerMessage" /></Field>{[["numberContacted", "Contacted"], ["replies", "Replies"], ["callsBooked", "Calls"], ["quotesSent", "Quotes"], ["dealsClosed", "Deals"]].map(([name, label]) => <Field key={name} label={label}><input className={inputClass} name={name} type="number" min="0" defaultValue="0" /></Field>)}<div className="md:col-span-4"><SubmitButton>Create campaign</SubmitButton></div></form>; }
export function ContentItemForm() { return <form action={upsertContentItem} className="grid gap-4 md:grid-cols-4"><SubmissionInput scope="upsert-content-item" /><Field label="Title"><input className={inputClass} name="title" required /></Field><Field label="Status"><select className={inputClass} name="status"><Options values={contentStatuses} /></select></Field><Field label="Platform"><input className={inputClass} name="platform" /></Field><Field label="Post URL"><input className={inputClass} name="postUrl" /></Field><Field label="Leads"><input className={inputClass} name="leadsGenerated" type="number" min="0" defaultValue="0" /></Field><Field label="Performance notes"><textarea className={inputClass} name="performanceNotes" /></Field><div className="md:col-span-4"><SubmitButton>Create content item</SubmitButton></div></form>; }

export function KnowledgeBaseForm() { return <form action={upsertKnowledgeBaseItem} className="grid gap-4"><SubmissionInput scope="upsert-knowledge-base-item" /><div className="grid gap-4 md:grid-cols-3"><Field label="Title"><input className={inputClass} name="title" required /></Field><Field label="Category"><select className={inputClass} name="category"><Options values={knowledgeCategories} /></select></Field><Field label="Visibility"><select className={inputClass} name="visibility"><option value="INTERNAL">Internal</option><option value="TEAM">Team</option><option value="PRIVATE">Private</option></select></Field></div><Field label="Article / SOP body"><textarea className={`${inputClass} min-h-40`} name="body" required /></Field><SubmitButton>Add article</SubmitButton></form>; }

export function NoteForm({ entityType, entityId, clientId, leadId, projectId, redirectTo }: { entityType: string; entityId: string; clientId?: string; leadId?: string; projectId?: string; redirectTo: string }) { return <form action={addNote} className="grid gap-3"><SubmissionInput scope="add-note" /><input type="hidden" name="entityType" value={entityType} /><input type="hidden" name="entityId" value={entityId} /><input type="hidden" name="clientId" value={clientId ?? ""} /><input type="hidden" name="leadId" value={leadId ?? ""} /><input type="hidden" name="projectId" value={projectId ?? ""} /><input type="hidden" name="redirectTo" value={redirectTo} /><Field label="Add note"><textarea className={inputClass} name="body" required /></Field><SubmitButton>Add note</SubmitButton></form>; }
export function FileRecordForm({ entityType, entityId, clientId, projectId, redirectTo }: { entityType: string; entityId: string; clientId?: string; projectId?: string; redirectTo: string }) { return <form action={addFileRecord} className="grid gap-3"><SubmissionInput scope="add-file-record" /><input type="hidden" name="entityType" value={entityType} /><input type="hidden" name="entityId" value={entityId} /><input type="hidden" name="clientId" value={clientId ?? ""} /><input type="hidden" name="projectId" value={projectId ?? ""} /><input type="hidden" name="redirectTo" value={redirectTo} /><Field label="File name"><input className={inputClass} name="filename" required /></Field><Field label="Private storage URL / document link"><input className={inputClass} name="url" type="url" required /></Field><Field label="MIME type"><input className={inputClass} name="mimeType" placeholder="application/pdf" /></Field><SubmitButton>Add file link</SubmitButton></form>; }
export function ChecklistTemplateForm({ services, templates }: { services: ServiceOption[]; templates: { id: string; name: string }[] }) { return <div className="grid gap-4 xl:grid-cols-2"><form action={createChecklistTemplate} className="grid gap-3"><SubmissionInput scope="create-checklist-template" /><h3 className="font-semibold text-white">Create checklist template</h3><Field label="Name"><input className={inputClass} name="name" required /></Field><Field label="Service"><select className={inputClass} name="serviceId"><option value="">General</option>{services.map((service) => <option key={service.id} value={service.id}>{service.name}</option>)}</select></Field><Field label="Description"><textarea className={inputClass} name="description" /></Field><Field label="First item"><input className={inputClass} name="firstItemTitle" /></Field><SubmitButton>Create template</SubmitButton></form><form action={createChecklistItem} className="grid gap-3"><SubmissionInput scope="create-checklist-item" /><h3 className="font-semibold text-white">Add checklist item</h3><Field label="Template"><select className={inputClass} name="templateId">{templates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}</select></Field><Field label="Item title"><input className={inputClass} name="title" required /></Field><Field label="Description"><textarea className={inputClass} name="description" /></Field><Field label="Sort order"><input className={inputClass} name="sortOrder" type="number" min="0" defaultValue="0" /></Field><SubmitButton>Add item</SubmitButton></form></div>; }
