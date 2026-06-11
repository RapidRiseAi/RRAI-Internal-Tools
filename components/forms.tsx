import { upsertClient, upsertLead, upsertTask, upsertUser } from "@/lib/actions";
import { clientStatuses, labelize, leadStages, priorities, taskStatuses, taskTypes } from "@/lib/constants";
import type { Client, Lead } from "@/lib/types";
import { Button, Field, inputClass } from "./ui";

type UserOption = { id: string; name: string };
type ProjectOption = { id: string; name: string };
type RoleOption = { id: string; name: string };

function dateInput(value?: string | null) {
  return value ? value.slice(0, 10) : "";
}

export function LeadForm({ lead, users }: { lead?: Lead; users: UserOption[] }) {
  return (
    <form action={upsertLead} className="grid gap-4 md:grid-cols-2">
      {lead?.id ? <input type="hidden" name="id" value={lead.id} /> : null}
      <Field label="Company"><input className={inputClass} name="companyName" defaultValue={lead?.company_name ?? ""} required /></Field>
      <Field label="Contact"><input className={inputClass} name="contactName" defaultValue={lead?.contact_name ?? ""} required /></Field>
      <Field label="Email"><input className={inputClass} name="email" type="email" defaultValue={lead?.email ?? ""} /></Field>
      <Field label="Phone"><input className={inputClass} name="phone" defaultValue={lead?.phone ?? ""} /></Field>
      <Field label="Source"><input className={inputClass} name="source" defaultValue={lead?.source ?? "Referral"} required /></Field>
      <Field label="Service interest"><input className={inputClass} name="serviceInterest" defaultValue={lead?.service_interest ?? "Website development"} required /></Field>
      <Field label="Stage"><select className={inputClass} name="stage" defaultValue={lead?.stage ?? "NEW_LEAD"}>{leadStages.map((stage) => <option key={stage} value={stage}>{labelize(stage)}</option>)}</select></Field>
      <Field label="Lead score"><input className={inputClass} name="score" type="number" min="0" max="100" defaultValue={lead?.score ?? 50} /></Field>
      <Field label="Follow-up date"><input className={inputClass} name="followUpDate" type="date" defaultValue={dateInput(lead?.follow_up_date)} /></Field>
      <Field label="Assigned to"><select className={inputClass} name="assignedToId" defaultValue={lead?.assigned_to ?? ""}><option value="">Unassigned</option>{users.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}</select></Field>
      <Field label="Next action"><input className={inputClass} name="nextAction" defaultValue={lead?.next_action ?? ""} /></Field>
      <Field label="Pain points"><textarea className={inputClass} name="painPoints" defaultValue={lead?.pain_points ?? ""} /></Field>
      <div className="md:col-span-2"><Button>Save lead</Button></div>
    </form>
  );
}

export function ClientForm({ client }: { client?: Client }) {
  return (
    <form action={upsertClient} className="grid gap-4 md:grid-cols-2">
      {client?.id ? <input type="hidden" name="id" value={client.id} /> : null}
      <Field label="Company"><input className={inputClass} name="companyName" defaultValue={client?.company_name ?? ""} required /></Field>
      <Field label="Status"><select className={inputClass} name="accountStatus" defaultValue={client?.account_status ?? "ACTIVE"}>{clientStatuses.map((status) => <option key={status} value={status}>{labelize(status)}</option>)}</select></Field>
      <Field label="Industry"><input className={inputClass} name="industry" defaultValue={client?.industry ?? ""} /></Field>
      <Field label="Website"><input className={inputClass} name="website" defaultValue={client?.website ?? ""} /></Field>
      <Field label="Primary email"><input className={inputClass} name="primaryEmail" type="email" defaultValue={client?.primary_email ?? ""} /></Field>
      <Field label="Primary phone"><input className={inputClass} name="primaryPhone" defaultValue={client?.primary_phone ?? ""} /></Field>
      <Field label="MRR cents"><input className={inputClass} name="mrrCents" type="number" min="0" defaultValue={client?.mrr_cents ?? 0} /></Field>
      <Field label="Next action"><input className={inputClass} name="nextAction" defaultValue={client?.next_action ?? ""} /></Field>
      <div className="md:col-span-2"><Button>Save client</Button></div>
    </form>
  );
}

export function TaskForm({ users, projects }: { users: UserOption[]; projects: ProjectOption[] }) {
  return (
    <form action={upsertTask} className="grid gap-4 md:grid-cols-3">
      <Field label="Title"><input className={inputClass} name="title" required /></Field>
      <Field label="Type"><select className={inputClass} name="type">{taskTypes.map((type) => <option key={type} value={type}>{labelize(type)}</option>)}</select></Field>
      <Field label="Status"><select className={inputClass} name="status">{taskStatuses.map((status) => <option key={status} value={status}>{labelize(status)}</option>)}</select></Field>
      <Field label="Priority"><select className={inputClass} name="priority">{priorities.map((priority) => <option key={priority} value={priority}>{labelize(priority)}</option>)}</select></Field>
      <Field label="Due date"><input className={inputClass} type="date" name="dueDate" /></Field>
      <Field label="Assignee"><select className={inputClass} name="assignedToId"><option value="">Unassigned</option>{users.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}</select></Field>
      <Field label="Project"><select className={inputClass} name="projectId"><option value="">No project</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></Field>
      <Field label="Description"><textarea className={inputClass} name="description" /></Field>
      <div className="flex items-end"><Button>Create task</Button></div>
    </form>
  );
}

export function UserForm({ roles }: { roles: RoleOption[] }) {
  return (
    <form action={upsertUser} className="grid gap-4 md:grid-cols-3">
      <Field label="Name"><input className={inputClass} name="name" required /></Field>
      <Field label="Email"><input className={inputClass} name="email" type="email" required /></Field>
      <Field label="Temporary password"><input className={inputClass} name="password" type="password" minLength={10} required /></Field>
      <Field label="Role"><select className={inputClass} name="roleId">{roles.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}</select></Field>
      <Field label="Title"><input className={inputClass} name="title" /></Field>
      <Field label="Phone"><input className={inputClass} name="phone" /></Field>
      <input type="hidden" name="status" value="ACTIVE" />
      <div className="md:col-span-3"><Button>Add employee</Button></div>
    </form>
  );
}
