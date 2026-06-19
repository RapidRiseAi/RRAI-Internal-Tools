# Rapid Rise OS — Functions and Workflows Map

This document is the operational map for the app. It explains what each module does, how records connect, what actions are available, and which gaps remain so future work can be prioritized without rediscovering the codebase.

## Core architecture

- **UI shell and navigation:** `components/app-shell.tsx` renders the authenticated app layout, permission-filtered navigation, quick lead/task links, and logout.
- **Data reads:** `lib/data.ts` contains server-only list/get helpers. Most pages call these helpers in parallel with `Promise.all`.
- **Writes and workflows:** `lib/actions.ts` contains server actions for create/update workflows. Actions validate input, check permissions, reserve submission keys, write to Supabase, log activity where useful, revalidate paths, and redirect.
- **Validation:** `lib/validation.ts` contains Zod schemas for form input.
- **Reusable forms:** `components/forms.tsx`, `components/quote-form.tsx`, and `components/invoice-form.tsx` provide modal-based workflows.
- **Files:** files upload to the `internal-files` storage bucket and save signed URLs in the `files` table with typed links to leads, clients, projects, knowledge base items, expenses, tasks, and activity logs.
- **Activity logs:** important workflow events write `activity_logs` entries so entity timelines can show what happened.

## Permissions and roles

- Roles are seeded in the `roles` table and mapped in `rolePermissionMap`.
- Pages call `requirePagePermission(...)`; server actions call `requirePermission(...)`.
- Key permissions include dashboard, leads, clients, quotes, projects, tasks, billing, payroll, support, marketing, and settings.
- Settings now shows users and role permission cards as clickable modals so admins can inspect users and permission coverage.

## Leads workflow

1. Leads are created or edited with `LeadForm`.
2. A lead tracks company, contact, email, phone, source, service interest, stage, score, follow-up date, next action, pain points, and owner.
3. Lead detail page actions include edit lead, create quote, convert to client, and archive.
4. The duplicate top Activity button was removed; the Quick actions card remains the place to log notes, assign tasks, book events, or attach workflow files.
5. The Files card now has its own Upload file button directly above the file list for fast standalone uploads.
6. Lead notes, files, and activity history are displayed on the lead detail page.
7. Lead-to-client conversion creates a client and links the lead to the converted client.

## Clients workflow

1. Clients are created or edited with `ClientForm`.
2. A client tracks company status, industry, website, primary email/phone, next action, and MRR.
3. Client detail actions include edit client, create quote, create project, and create support ticket.
4. The duplicate top Activity button was removed; Quick actions remains the consolidated note/task/event/file workflow.
5. The Files card now has its own Upload file button directly above the client file list.
6. Client detail aggregates projects, notes, files, invoices, tickets, retainers, quotes, and timeline activity.

## Quotes workflow

1. Quotes are created with `QuoteForm` from the Quotes page, lead detail, or client detail.
2. Quote line items can be custom or populated from the services catalogue.
3. Totals are calculated in the browser and recalculated server-side before saving.
4. `upsertQuote` inserts or updates the quote, replaces quote line items, checks line-item insert errors, logs activity, and redirects.
5. Quote PDFs render from the quote PDF route.
6. Accepting a quote can create downstream project/invoice records according to business rules.

## Projects workflow

1. Projects are created from Projects or client detail.
2. Projects track client, quote, status, stage, priority, deadline, progress, blocker, assignee, and optional seeded checklist template.
3. Project list cards link to project detail.
4. Project detail supports editing, linked tasks, notes, checklists, file uploads, and activity review.
5. Project files are intended to be standalone resources for delivery assets, URLs, credentials, and handover documents.

## Tasks workflow

1. Tasks are created from Tasks, project detail, or activity workflow.
2. Tasks track title, description, type, status, priority, due date, client, project, assignee, creator, and completion state.
3. Task rows currently allow status and assignee updates from an Update modal.
4. Future improvement: add a dedicated task detail page or full edit modal everywhere tasks are listed, including notes and files.

## Billing workflow

### Invoices

1. Invoices are created with `InvoiceForm`.
2. Invoices can reference a quote and seed line items from quote items.
3. Invoice totals are stored on the invoice record; detailed rows are stored in `invoice_items`.
4. Invoice PDFs render from the billing PDF route.

### Payments

1. Payments are recorded against invoices.
2. A paid payment updates the invoice status to paid.
3. Payment activity is logged.

### Retainers

1. Retainers track client, type, status, monthly amount, and next billing date.
2. Active retainers feed Billing MRR summary cards.

### Expenses

1. The first field is now expense type: one-time, weekly recurring, monthly recurring, quarterly recurring, or annual recurring.
2. One-time expenses only show expense date.
3. Recurring expenses show first due date and optional next due date.
4. Expense records track vendor name, category, amount, status, notes, client/project links, recurrence, and attachments.
5. Recurring expense scheduling stores recurrence metadata; automated creation of future expense instances remains a future improvement.

### Vendors

1. Vendors are added from Billing.
2. Vendors track name, category, contact, email, phone, website, and notes.
3. Billing shows vendor count and vendor contact cards.
4. Future improvement: add `vendor_id` to expenses so expenses can be linked directly to vendor records instead of plain-text vendor names.

## Payroll and employee workflow

1. Payroll is available from the main navigation for users with payroll permission.
2. Employees are managed through the same `users` table, extended with employment type, department, specialties, pay type, pay rate, start date, emergency contact, and employee notes.
3. Adding or editing an employee lets admins assign login role/access, job title, specialties, department, and compensation details in one form.
4. Payroll runs define a pay period, status, notes, creator, and timestamps.
5. Payroll items connect an employee to a payroll run and store pay type, hours, gross pay, deductions, generated net pay, role snapshot, notes, and paid timestamp.
6. Payroll summary cards show active employees, run count, item count, and total net pay.
7. Future improvement: add approval workflows, payslip PDFs, payment exports, tax/benefit deductions, and employee self-service profiles.

## Files and uploads workflow

1. `FileRecordForm` supports multiple file selection.
2. Each selected file is validated, uploaded, signed, inserted into `files`, and typed to the correct entity.
3. Activity workflow attachment uploads also support multiple files.
4. External URL links can still be saved one at a time.
5. Lead and client detail pages now expose dedicated Upload file buttons directly above their Files sections.
6. Future improvement: add file categories, versioning, delete/archive controls, and upload progress UI.

## Settings workflow

1. Company settings manage company name, billing email, bank details, payment terms, quote footer, and invoice footer.
2. Document templates are clickable. Clicking a template opens a modal to view and edit content, type, name, and default status.
3. Checklist templates can be managed from the checklist modal and can seed project delivery checklists.
4. Users are clickable. Clicking a user opens a modal to edit access, role, employee profile, specialties, and pay settings.
5. Role permission cards are clickable and show their permission lists.
6. Services are managed from the dedicated Services page and are reused by quotes.

## Marketing, affiliates, support, and knowledge base

- Marketing stores campaigns and content items with performance metrics.
- Affiliates track partners, referrals, commissions, and commission states.
- Support tickets connect clients/projects to issue categories, priorities, statuses, assignments, and resolution notes.
- Knowledge base items store SOPs/articles and can have uploaded knowledge files.

## Missing connections and improvement opportunities

1. Link expenses to vendor IDs, not only vendor names.
2. Add automated recurring expense generation and reminders.
3. Add full CRUD/detail pages for tasks, notes, files, templates, payroll runs, and payroll items.
4. Add delete/archive flows for files, notes, vendors, payroll runs, and document templates.
5. Add payroll approvals, payslip PDFs, payment export files, tax/benefit fields, and contractor invoice matching.
6. Add project notes/files inline editing and richer project health dashboards.
7. Add dashboard global search that links directly to leads, clients, projects, tasks, files, templates, and employees.
8. Add notification rules for overdue follow-ups, due tasks, quote expiry, unpaid invoices, support SLA breaches, and payroll approval deadlines.
9. Add audit trail detail pages to inspect who changed high-risk records such as payroll, permissions, invoices, and quotes.
10. Add CRM contact records per client/lead so multiple stakeholders can be tracked.
11. Add role editing UI for custom permission sets instead of only static role permission map display.
12. Add document template preview with sample data before generating PDFs.

## Task and activity logging update

- Entity pages should place action buttons inside the section where the record will appear: project creation in Projects, task creation in Tasks, note creation in Notes, and uploads in Files.
- The Activity workflow is now a pure log workflow. It records calls, messages, emails, or task outcomes and can optionally link the log to an existing task.
- Task creation is handled by Task sections and the Tasks page, not by the Activity workflow.
- Tasks now capture instructions, expected outcome, schedule/due dates, attachments, and multiple supporting links so the assignee has the information needed to complete the task.
- Task close-out happens from the Tasks page or the task log flow. Completing or scrapping a task requires logging what happened, and scrapping can include a reason.
- `SCRAPPED` is a task status so cancelled/invalid work can be separated from completed work.

## Task detail workspace update

- Every task row/card should link to `/tasks/[id]` so the user can open the task itself instead of only jumping to the Tasks list.
- The task detail page is the working panel for a task: it shows status, priority, due date, assignee, instructions, expected outcome text, files, links, client/project context, and timestamps.
- Task detail includes an **Update task** action for changing the task data and a **Complete task** action for logging the outcome, scrapping it, or marking it blocked.
- Task detail includes an **Upload / add link** action using the file workflow so files and external links can be added while the task is being completed.

## Calendar, permission, expense, and payroll expense update

- Date and datetime fields use a global picker activator so focusing or clicking the field opens the browser calendar/time picker, and calendar picker icons are styled white for dark UI contrast.
- Role permission cards in Settings are editable: admins can select/deselect individual permissions and save them back to the role record.
- Recurring expenses now use the expense date as the schedule anchor. Weekly, monthly, quarterly, and annual expenses no longer ask for a separate next-due field.
- Expense rows can be marked paid. One-time expenses become paid; recurring expenses log the payment and roll their next pending date forward based on recurrence.
- Payroll items also create pending Payroll expenses so employee pay is visible in the expense workflow.
