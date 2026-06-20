# Rapid Rise OS — Complete Functions, Workflows, and Integration Map

Last reviewed: 2026-06-20. This document is the canonical operating map for the current codebase. It describes every shipped module, page, data connection, server action, form, important branch, and known gap so future changes can be made without rediscovering the application.

## 1. Product scope

Rapid Rise OS is a Supabase-backed internal operating system for Rapid Rise AI. It covers:

- CRM: leads, clients, contacts, activities, follow-ups, files, and notes.
- Sales: services, quotes, quote PDFs, quote acceptance, and conversion into delivery/finance records.
- Delivery: projects, project checklists, project files, linked tasks, and task detail workspaces.
- Finance: invoices, invoice items, invoice PDFs, payments, retainers, vendors, expenses, recurring costs, and payroll expense visibility.
- People: users/employees, roles, permissions, payroll runs, and payroll items.
- Support: support tickets with client/project links, priority, status, assignment, and resolution notes.
- Growth: campaigns, content items, affiliates, referrals, and commissions.
- Knowledge: SOP/articles plus linked files.
- Administration: company settings, document templates, service catalogue, checklist templates, permissions, login details, and global app styling.

## 2. Architecture and execution model

### 2.1 App framework

- The app is a Next.js App Router application using server components for pages and server actions for mutations.
- `app/layout.tsx` mounts global CSS, navigation feedback, and the global date-picker activator.
- `components/app-shell.tsx` is the authenticated application chrome. It loads the current user, filters navigation by permissions, and renders app navigation, quick links, and logout.
- `components/modal-panel.tsx` is the standard action container. Most create/update workflows open in modal dialogs instead of separate pages.
- `components/ui.tsx` defines shared cards, buttons, status badges, fields, input class styling, empty states, and page headers.
- `components/submit-button.tsx` displays pending labels for server-action submits.
- `components/date-picker-activator.tsx` calls browser picker APIs for date/datetime fields; `app/globals.css` styles date/datetime picker indicators white for the dark UI.

### 2.2 Data layer

- `lib/supabase.ts` creates the Supabase admin client from environment variables and exposes `hasSupabaseConfig()` for safe local/dev fallbacks.
- `lib/data.ts` contains server-only read helpers. Pages use these helpers directly and often load data in parallel with `Promise.all`.
- `lib/actions.ts` contains all server-side mutation workflows. Actions commonly:
  1. Require the correct permission.
  2. Normalize `FormData`.
  3. Validate with `lib/validation.ts` Zod schemas.
  4. Reserve a submission key for create flows when applicable.
  5. Insert/update/delete Supabase records.
  6. Attach files when supported.
  7. Write activity logs for important workflow events.
  8. Revalidate affected paths.
  9. Redirect to the correct workspace.
- `lib/action-utils.ts` standardizes form action state and converts validation errors into field/form errors for `useActionState` forms.
- `lib/types.ts` mirrors the Supabase tables used by pages and forms.
- `lib/constants.ts` is the source of application statuses, role names, permission names, role-permission defaults, and `labelize()` display formatting.
- `lib/business-rules.ts` holds pure business logic tested by Vitest: commission status transitions, commission calculations, and quote-item-to-invoice-item conversion.
- `lib/pdf.ts` builds simple branded PDF payloads for quote and invoice PDF routes.
- `lib/format.ts` formats money, Rand inputs, short dates, and date/time values.

### 2.3 Authentication and authorization

- Login uses `loginAction`, `bcryptjs`, and the `users.password_hash` column.
- Sessions are created and destroyed in `lib/auth.ts` using encrypted cookies/JWT helpers.
- Pages call `requirePagePermission(permission)`.
- Server actions call `requirePermission(permission)` or `requireUser()`.
- Permission values live in `permissions` and cover dashboard, leads, clients, quotes, projects, tasks, billing, payroll, support, marketing, and settings.
- Roles are records in `roles` and store permission arrays. Seeded roles include Owner/Admin, Manager, Sales, Project Manager, Developer/Designer, Support, Finance, Affiliate/Partner, and Read-only.
- Settings admins can edit permission arrays through `RolePermissionForm` and `updateRolePermissions`.

## 3. Database and record graph

### 3.1 Core identity and access

- `roles`: name, description, permissions, timestamps.
- `users`: name, email, password hash, role, title, status, login timestamp, employee/payroll fields, and timestamps.
- User relationships:
  - `leads.assigned_to` and `leads.created_by` reference users.
  - `tasks.assigned_to` and `tasks.created_by` reference users.
  - `projects.assigned_to` references users.
  - `support_tickets.assigned_to` references users.
  - `activity_logs.actor_id` references users.
  - `payroll_runs.created_by` and `payroll_items.user_id` reference users.
  - `form_submissions.user_id` references users.

### 3.2 CRM and sales graph

- `leads`: pre-client sales opportunities. A lead can be assigned to a user and can later link to `converted_client_id`.
- `clients`: customer accounts. Client detail aggregates projects, quotes, invoices, retainers, tickets, notes, files, and activity.
- `contacts`: client contacts. Lead conversion creates a primary contact when lead contact data exists.
- `services`: service catalogue reused by quote line items.
- `packages`: service-related packages.
- `quotes`: sales proposals linked to a lead or a client.
- `quote_items`: quote line items; each belongs to a quote and can reference a service.

### 3.3 Delivery graph

- `projects`: delivery records linked to a client and optionally a quote and assignee.
- `checklist_templates`: reusable delivery checklist templates, optionally tied to a service.
- `checklist_items`: ordered template rows for checklist templates.
- `project_checklists`: copied or custom checklist rows on projects.
- `tasks`: work records that can link to client/project, assignee, due date/time, instructions, expected outcome, and status.

### 3.4 Finance graph

- `invoices`: client invoices, optionally tied to quotes, with status, amount, due date, and issued timestamp.
- `invoice_items`: invoice line detail rows.
- `payments`: payments against invoices.
- `retainers`: client recurring revenue records.
- `vendors`: vendor catalogue used by the expense form dropdown.
- `expenses`: costs with vendor name, category, `expense_type`, amount, status, date, recurrence, next due date, notes, optional client/project links, and creator.
- Finance relationships:
  - Payments update invoices.
  - Quote acceptance may create invoices/retainers.
  - Employee creation/update can create or update Payroll expenses.
  - Expense file uploads save file records with `entity_type = Expense` and `entity_id = expense.id`.

### 3.5 Support, marketing, affiliate, and knowledge graph

- `support_tickets`: tickets tied to clients/projects and assigned users.
- `affiliates`: partner records.
- `referrals`: referrals tied to affiliates and optionally leads/clients.
- `commissions`: commission records tied to affiliates and optionally quotes/projects/payments.
- `campaigns`: marketing outreach metrics.
- `content_items`: content planning/performance records.
- `knowledge_base_items`: SOPs/articles.
- `files`: typed file/link records for leads, clients, projects, knowledge base items, tasks, expenses, and activity logs.
- `notes`: typed notes for leads, clients, projects, and generic entity IDs.
- `activity_logs`: canonical audit/activity stream across the app.
- `notifications`: seeded table for future notification workflows; currently not heavily surfaced.
- `form_submissions`: idempotency table for create flows.

## 4. Pages and routes

### 4.1 Public/auth routes

- `/login`: employee login page. Submits to `loginAction`.
- `/unauthorized`: shown when a user lacks the required permission.
- `/`: entry route that redirects users into the app flow.

### 4.2 Dashboard and reporting

- `/dashboard` requires `dashboard:view` and loads leads, quotes, projects, tasks, support tickets, retainers, invoices, and recent activity.
- Dashboard metrics intentionally use `listLeads()`, which excludes archived and converted leads because it is an operational snapshot.
- `/reports` requires dashboard permission and uses `listAllLeadsForReporting()` so historical funnel metrics include archived and converted leads.
- Reports show conversion rate, average quote, active projects, completed tasks, total quoted, closed revenue, active MRR, and outstanding invoices.

### 4.3 Leads

- `/leads` requires `leads:read`, lists active unconverted leads, and links to lead detail.
- `/leads/new` requires `leads:read`, loads users, and renders `LeadForm`.
- `/leads/[id]` requires `leads:read`, loads the lead, users, notes, files, clients, leads, services, and tasks.
- Lead detail actions include edit lead, create quote, convert to client, archive lead, add lead task, add lead note, and upload lead file.

### 4.4 Clients

- `/clients` requires `clients:read` and lists clients.
- `/clients/new` requires `clients:read` and renders `ClientForm`.
- `/clients/[id]` requires `clients:read`, loads the client and related projects, quotes, invoices, retainers, tickets, notes, files, users, tasks, services, and checklist templates.
- Client detail actions include edit client, create quote, create support ticket, create project, add client task, add note, and upload file.

### 4.5 Quotes

- `/quotes` requires `quotes:read`, loads quotes, clients, leads, and services.
- Quote creation uses `QuoteForm` with browser-side line-item totals and server-side recalculation.
- `/quotes/[id]/pdf` renders a branded quote PDF.

### 4.6 Projects

- `/projects` requires `projects:read`, loads projects, tasks, clients, quotes, users, and checklist templates.
- `/projects/[id]` requires `projects:read`, loads the project, clients, quotes, users, tasks, checklist rows, notes, and files.
- Project detail actions include edit project, create linked task, add note, upload file/link, and update checklist item status.

### 4.7 Tasks and calendar

- `/tasks` requires `tasks:read`, loads tasks, users, projects, and clients.
- `/tasks/[id]` requires `tasks:read`, loads one task, users, clients, projects, and files linked by `entity_id`.
- Task detail actions include update task, complete/scrap/block task, and upload task files or links.
- `/calendar` requires `tasks:read`, loads tasks, clients, projects, invoices, retainers, and expenses, calculates the displayed week, and shows all operational calendar items by due date/hour. It includes normal tasks, materialized recurring tasks, projected weekly/monthly recurring task occurrences, project deadlines, unpaid invoice due dates, active retainer billing dates, and unpaid expense due dates.

### 4.8 Billing, retainers, and PDFs

- `/billing` requires `billing:read`, loads invoices, clients, payments, quotes, quote items, retainers, expenses, projects, and vendors.
- Billing actions include create invoice, record payment, create retainer, add vendor, record expense, update expense, remove expense, and mark expense paid.
- `/billing/[id]/pdf` renders a branded invoice PDF.
- `/retainers` requires `billing:read` and provides a focused retainer workspace.

### 4.9 Payroll and employees

- `/payroll` requires `payroll:read`, loads users, roles, payroll runs, and payroll items.
- Payroll actions include add employee, edit employee, create payroll run, and add payroll item.
- Employee records are users; adding an employee is not a separate table workflow.

### 4.10 Support

- `/support` requires `support:read`, loads tickets, clients, projects, and users.
- Actions include create support ticket and update support ticket.

### 4.11 Marketing, affiliates, services, knowledge, and settings

- `/marketing` requires `marketing:read`, loads campaigns and content items, and supports campaign/content creation.
- `/affiliates` loads affiliates, referrals, leads, clients, quotes, projects, payments, and commissions, and supports affiliate/referral/commission creation.
- `/services` requires `settings:manage`, lists services, and supports service creation/update.
- `/knowledge-base` requires dashboard permission, lists articles and files, supports article creation and knowledge file upload.
- `/settings` requires `settings:manage`, loads users, roles, services, checklist templates/items, company settings, and document templates.
- Settings actions include company settings update, login update, add/edit employee, add/edit document template, add/edit checklist template/items, edit role permissions, and link to Services.

## 5. Forms and workflow entry points

### 5.1 Shared patterns

- Most forms submit directly to server actions through the `action` prop.
- `SubmissionInput` creates a unique submission key for create workflows.
- `FormError` and `FieldError` are used by `useActionState` forms to show validation feedback.
- File-capable forms use `AttachmentButtonFields` or `FileRecordForm`.
- Modal workflows should be placed in the same page section where the resulting record appears.

### 5.2 Form-to-action map

| Form/component              | Server action(s)                     | Primary records                                                   |
| --------------------------- | ------------------------------------ | ----------------------------------------------------------------- |
| `LeadForm`                  | `upsertLead`                         | `leads`, `activity_logs`                                          |
| `ClientForm`                | `upsertClient`                       | `clients`, `activity_logs`                                        |
| `TaskForm`                  | `upsertTask`                         | `tasks`, optional `files`, `activity_logs`                        |
| `AccountLoginForm`          | `updateOwnLoginDetails`              | `users`, session continuity                                       |
| `RolePermissionForm`        | `updateRolePermissions`              | `roles`                                                           |
| `UserForm`                  | `upsertUser`                         | `users`, payroll `expenses`                                       |
| `QuoteForm`                 | `upsertQuote`                        | `quotes`, `quote_items`, `activity_logs`                          |
| `AcceptQuoteButton`         | `acceptQuote`                        | clients/projects/invoices/retainers/activity, depending on branch |
| `ProjectForm`               | `upsertProject`                      | `projects`, `project_checklists`, `activity_logs`                 |
| `PaymentForm`               | `recordPayment`                      | `payments`, `invoices`, `activity_logs`                           |
| `VendorForm`                | `upsertVendor`                       | `vendors`, `activity_logs`                                        |
| `ExpenseForm`               | `recordExpense`, `updateExpense`     | `expenses`, `vendors`, optional `files`, `activity_logs`          |
| `DeleteExpenseForm`         | `deleteExpense`                      | removes `expenses`, logs activity                                 |
| `RetainerForm`              | `upsertRetainer`                     | `retainers`, `activity_logs`                                      |
| `SupportTicketForm`         | `upsertSupportTicket`                | `support_tickets`, `activity_logs`                                |
| `AffiliateForm`             | `upsertAffiliate`                    | `affiliates`, `activity_logs`                                     |
| `ReferralCommissionForms`   | `createReferral`, `createCommission` | `referrals`, `commissions`, `activity_logs`                       |
| `CampaignForm`              | `upsertCampaign`                     | `campaigns`, `activity_logs`                                      |
| `ContentItemForm`           | `upsertContentItem`                  | `content_items`, `activity_logs`                                  |
| `KnowledgeBaseForm`         | `upsertKnowledgeBaseItem`            | `knowledge_base_items`, `activity_logs`                           |
| `ActivityWorkflowForm`      | `upsertActivityWorkflow`             | `activity_logs`, optional `files`                                 |
| `NoteForm`                  | `addNote`                            | `notes`, `activity_logs`                                          |
| `FileRecordForm`            | `addFileRecord`                      | `files`, `activity_logs`                                          |
| `ChecklistTemplateForm`     | `createChecklistTemplate`            | `checklist_templates`                                             |
| `ChecklistTemplateEditForm` | `createChecklistTemplate`            | `checklist_templates`                                             |
| `ChecklistItemEditForm`     | `createChecklistItem`                | `checklist_items`                                                 |
| `ServiceForm`               | `upsertService`                      | `services`                                                        |
| `AssignLinkedTaskForm`      | `assignLinkedTask`                   | `activity_logs`, `tasks` link context                             |
| `InteractionEventForm`      | `logInteractionEvent`                | `activity_logs`                                                   |
| `BookEventForm`             | `bookEvent`                          | `tasks` calendar/event records, activity                          |
| `LeadCallForm`              | `logLeadCall`                        | `activity_logs`, lead follow-up state                             |
| `PayrollRunForm`            | `createPayrollRun`                   | `payroll_runs`                                                    |
| `PayrollItemForm`           | `addPayrollItem`                     | `payroll_items`, payroll `expenses`                               |
| `DocumentTemplateForm`      | `createDocumentTemplate`             | `document_templates`                                              |

## 6. Server actions and branches

### 6.1 Login and account

- `loginAction(previousState, formData)` validates email/password, fetches the user by email, compares `password_hash`, rejects inactive/invalid users, creates the session, updates `last_login_at`, and redirects to `/dashboard`.
- `logoutAction()` destroys the session and redirects to `/login`.
- `updateOwnLoginDetails(formData)` requires a logged-in user, verifies current password, updates name/email, optionally updates password hash, revalidates settings, and redirects.

### 6.2 Leads

- `upsertLead(previousState, formData)` requires `leads:write`. Branches:
  - New lead: reserves `lead:create`, inserts `leads`, logs `LEAD_CREATED`.
  - Existing lead: updates `leads`, logs `LEAD_UPDATED`.
  - Follow-up date is stored as an ISO value from date/datetime input.
- `archiveLead(formData)` requires `leads:write`, sets `archived_at`, logs activity, and redirects to `/leads`.
- `convertLeadToClient(formData)` requires `clients:write`, converts with an atomic database function when available. Branches:
  - Success: client/contact created, lead linked to converted client, activity logged, redirect to new client.
  - Database function unavailable/error: action throws instead of partial conversion.

### 6.3 Clients

- `upsertClient(previousState, formData)` requires `clients:write`. Branches:
  - New client: reserves `client:create`, inserts client, logs `CLIENT_CREATED`.
  - Existing client: updates client, logs `CLIENT_UPDATED`.

### 6.4 Tasks and calendar work

- `upsertTask(formData)` requires `tasks:write`. Branches:
  - New task: reserves `task:create`, inserts task.
  - Existing task: updates task.
  - If status is `DONE`, sets/completes completion fields and logs `TASK_COMPLETED`; otherwise logs create/update.
  - Recurrence branch: supports `NONE`, `WEEKLY`, and `MONTHLY`, stores interval/day metadata, calculates `recurrence_next_due_at`, and uses the due date or first recurrence date as the scheduled task date.
  - Optional uploaded files and supporting links are saved to `files` with `entity_type = Task`.
- `updateTaskStatus(formData)` requires `tasks:write`. Branches:
  - `DONE`: requires outcome notes, sets `completed_at`, logs completion, and automatically creates the next weekly/monthly task occurrence with the same core fields, assignee, client, and project.
  - `SCRAPPED`: stores scrap reason/outcome, logs cancellation.
  - `BLOCKED` or other statuses: updates status and logs status change.
- `bookEvent(formData)` creates a task-like scheduled calendar/work item and logs it.
- Calendar display is read-only; updates happen through task, project, billing, retainer, and expense actions.

### 6.5 Quotes

- `upsertQuote(previousState, formData)` requires `quotes:write`. Branches:
  - New quote: reserves `quote:create`, generates quote number, inserts quote and line items.
  - Existing quote: updates quote, deletes/replaces line items.
  - Line item totals are recalculated server-side.
  - Logs `QUOTE_CREATED` or `QUOTE_UPDATED`.
- `acceptQuote(formData)` requires `quotes:write` and calls an atomic acceptance/conversion database function. Branches inside the database workflow include:
  - Lead-only quote can first create or find a client from the lead.
  - Quote can create a project.
  - Once-off total can create an invoice.
  - Monthly total can create a retainer.
  - Activity links quote, lead, client, and project where available.

### 6.6 Projects and checklists

- `upsertProject(formData)` requires `projects:write`. Branches:
  - New project: reserves `project:create`, inserts project, optionally seeds checklist from selected template.
  - Existing project: updates project fields.
  - If checklist seeding is requested and template items exist, inserts project checklist rows.
  - Logs create/update activity.
- `updateProjectChecklist(formData)` requires `projects:write`, updates checklist row status, sets `completed_at` when done, clears it when reopened, logs activity, and redirects back to the project.
- `createChecklistTemplate(formData)` creates or updates a template depending on whether an ID is present.
- `createChecklistItem(formData)` creates or updates a template item depending on whether an ID is present.

### 6.7 Invoices and payments

- `upsertInvoice(formData)` requires `billing:write`. Branches:
  - New invoice: reserves `invoice:create`, generates invoice number when not provided, inserts invoice and optional invoice items.
  - If quote line items are provided, once-off quote items can seed invoice rows through `buildOnceOffInvoiceItemsFromQuoteItems`.
  - Existing invoice updates are not the main UI path currently, but the action supports upsert-style payload construction.
  - Logs invoice activity.
- `recordPayment(formData)` requires `billing:write`. Branches:
  - Inserts payment.
  - If payment status is `PAID`, sets invoice status to `PAID` and `paid_at` on the payment.
  - Logs payment activity.

### 6.8 Vendors and expenses

- `upsertVendor(formData)` requires `billing:write`, inserts a vendor, logs `VENDOR_CREATED`, and redirects to Billing.
- `recordExpense(formData)` requires `billing:write`. Branches:
  - Existing vendor branch: uses the selected vendor name from the dropdown.
  - Other vendor branch: uses `newVendor`, calls `ensureVendor`, and creates the vendor if not already present.
  - Inserts expense with category, `expense_type`, amount, status, date, recurrence, next due date, notes, client/project links, and creator.
  - Recurrence branch: `NONE` stores `next_due_date = null`; weekly/monthly/quarterly/annual use the expense date as the first schedule anchor.
  - Optional receipt/invoice files are attached to the expense.
  - Logs `EXPENSE_RECORDED`.
- `updateExpense(formData)` requires `billing:write`. Branches mirror `recordExpense`, but update the existing expense and log `EXPENSE_UPDATED`.
- `deleteExpense(formData)` requires `billing:write`, fetches the expense for logging context, deletes it, logs `EXPENSE_REMOVED`, and redirects.
- `markExpensePaid(formData)` requires `billing:write`. Branches:
  - One-time expense: status becomes `PAID`.
  - Recurring expense: status is reset to `PENDING`, `expense_date` and `next_due_date` roll forward by weekly/monthly/quarterly/annual recurrence, and activity explains the next due date.

### 6.9 Retainers

- `upsertRetainer(formData)` requires `billing:write`, inserts a retainer, logs `RETAINER_CREATED`, revalidates Billing and Retainers, and redirects.
- Retainers can be created from Billing, Retainers, and client detail.
- Active retainers feed MRR cards in Dashboard, Billing, Reports, and Retainers.

### 6.10 Payroll and employee pay

- `upsertUser(previousState, formData)` requires `settings:manage`. Branches:
  - New user/employee: requires a password, inserts user, stores employee profile fields, and the user immediately appears in the users list.
  - Existing user/employee: updates user and preserves password when no new password is submitted.
  - If `pay_rate_cents > 0`, creates or updates a finance expense with `expense_type = PAYROLL`, `category = Payroll`, vendor equal to employee name, amount equal to pay rate, and recurrence monthly unless pay type is hourly.
  - Revalidates Settings, Payroll, and Billing.
- `createPayrollRun(formData)` requires `payroll:write`, creates a payroll period with status and notes.
- `addPayrollItem(formData)` requires `payroll:write`, calculates net pay as gross minus deductions, stores role snapshot/user, and creates a pending Payroll expense for the pay item so payroll appears in finance expenses.

### 6.11 Support

- `upsertSupportTicket(formData)` requires `support:write`. Branches:
  - New ticket: reserves `support-ticket:create`, inserts ticket, logs create.
  - Existing ticket: updates ticket, logs update.
  - Resolution fields can be populated when status moves to resolved/closed.

### 6.12 Affiliate and marketing

- `upsertAffiliate(formData)` requires `marketing:write`, inserts affiliate and generates a tracking code when one is not supplied.
- `createReferral(formData)` requires `marketing:write`, links affiliate to lead/client and logs referral activity.
- `createCommission(formData)` requires `marketing:write`, inserts commission against affiliate and optional quote/project/payment.
- `upsertCampaign(formData)` requires `marketing:write`, creates or updates campaign performance metrics.
- `upsertContentItem(formData)` requires `marketing:write`, creates or updates content item status/performance.
- `nextCommissionStatus()` provides pure business logic for commission state transitions based on payment status.

### 6.13 Knowledge, notes, files, and activity

- `upsertKnowledgeBaseItem(formData)` requires dashboard access, creates an SOP/article, and logs activity.
- `addNote(formData)` requires a user, writes a typed note against lead/client/project/entity context, logs `NOTE_ADDED`, and redirects to the supplied target.
- `addFileRecord(previousState, formData)` requires a user. Branches:
  - Upload branch: validates each selected file, uploads to Supabase Storage, creates signed URLs, inserts `files` records.
  - External URL branch: inserts a file/link record with URL and optional MIME type.
  - Both branches support typed lead/client/project/knowledge/entity links.
- `upsertActivityWorkflow(formData)` logs a typed activity event and can attach files.
- `assignLinkedTask(formData)` logs an activity event connected to a task.
- `logInteractionEvent(formData)` logs call/email/message/meeting-style interactions.
- `logLeadCall(formData)` logs lead-call outcomes and can update lead follow-up fields.

### 6.14 Settings, services, and documents

- `upsertCompanySettings(formData)` requires settings management and updates singleton company settings.
- `updateRolePermissions(formData)` requires settings management and overwrites role permission arrays.
- `upsertService(formData)` requires settings management. Branches:
  - New service: inserts service.
  - Existing service: updates service.
- `createDocumentTemplate(formData)` requires settings management. Branches:
  - New template: inserts document template.
  - Existing template: updates template.
  - If marked default, intended behavior is to use the selected default for its document type in future document generation workflows.

## 7. File and attachment rules

- Allowed upload entity types are defined in `allowedFileEntityTypes` and include core CRM, project, task, expense, activity, and knowledge contexts.
- Allowed MIME types include PDFs, common image types, text/CSV, Word, and Excel formats.
- Max upload size is 10 MB per file.
- Storage path pattern is `<entityType>/<entityId>/<uuid>-<safe filename>`.
- Uploaded files receive long-lived signed URLs before `files` records are inserted.
- External links are stored as file records without a storage upload.
- Current file workflow does not include delete/archive/version controls.

## 8. Status, branch, and state reference

### 8.1 Lead stages

`NEW_LEAD`, `CONTACTED`, `REPLIED`, `DISCOVERY_NEEDED`, `DISCOVERY_COMPLETED`, `QUOTE_NEEDED`, `QUOTE_SENT`, `NEGOTIATING`, `WON`, `LOST`, `FOLLOW_UP_LATER`.

### 8.2 Client statuses

`ACTIVE`, `PAUSED`, `COMPLETED`, `CANCELLED`.

### 8.3 Quote statuses

`DRAFT`, `SENT`, `VIEWED`, `FOLLOW_UP_DUE`, `ACCEPTED`, `REJECTED`, `EXPIRED`.

### 8.4 Project statuses

`NOT_STARTED`, `WAITING_FOR_CLIENT_INFO`, `PLANNING`, `DESIGN`, `DEVELOPMENT`, `INTEGRATION`, `TESTING`, `CLIENT_REVIEW`, `REVISIONS`, `READY_TO_LAUNCH`, `LAUNCHED`, `MAINTENANCE`, `COMPLETED`.

### 8.5 Task statuses and branches

- Open/work states: `TO_DO`, `IN_PROGRESS`, `WAITING_FOR_CLIENT`, `WAITING_INTERNALLY`, `BLOCKED`, `REVIEW_NEEDED`.
- Closed states: `DONE`, `SCRAPPED`.
- `DONE` sets completion metadata.
- `SCRAPPED` records why work was cancelled/invalid.
- `BLOCKED` preserves task as open but indicates inability to proceed.

### 8.6 Finance states

- Invoice statuses: `DRAFT`, `SENT`, `PART_PAID`, `PAID`, `OVERDUE`, `REFUNDED`, `CANCELLED`.
- Payment statuses: `PENDING`, `PAID`, `FAILED`, `REFUNDED`, `CANCELLED`.
- Retainer statuses: `ACTIVE`, `PAUSED`, `CANCELLED`, `OVERDUE`, `TRIAL`, `UPGRADE_PENDING`.
- Task types include sales, discovery, quote, design, development, integration, testing, client revision, support, admin, billing, content, and `OTHER`.
- Task recurrence: `NONE`, `WEEKLY`, `MONTHLY`.
- Expense statuses: `PENDING`, `APPROVED`, `PAID`, `REJECTED`.
- Expense recurrence: `NONE`, `WEEKLY`, `MONTHLY`, `QUARTERLY`, `ANNUAL`.
- Expense type examples currently offered in the UI: `SUBSCRIPTION`, `PAYROLL`, `SOFTWARE`, `CONTRACTOR`, `HOSTING`, `MARKETING`, `OFFICE`, `GENERAL`.

### 8.7 Support, marketing, payroll, and templates

- Ticket categories: `BUG`, `CHANGE_REQUEST`, `QUESTION`, `TRAINING`, `HOSTING`, `BILLING`, `OTHER`.
- Ticket statuses: `NEW`, `IN_REVIEW`, `IN_PROGRESS`, `WAITING_FOR_CLIENT`, `RESOLVED`, `CLOSED`.
- Affiliate statuses: `ACTIVE`, `PAUSED`, `INACTIVE`.
- Commission statuses: `PENDING`, `APPROVED`, `PAYABLE`, `PAID`, `CANCELLED`, `DISPUTED`.
- Content statuses: `IDEA`, `DRAFT`, `SCHEDULED`, `PUBLISHED`, `ARCHIVED`.
- Employment types: `FULL_TIME`, `PART_TIME`, `CONTRACTOR`, `INTERN`.
- Pay types: `SALARY`, `HOURLY`, `CONTRACT`.
- Payroll run statuses: `DRAFT`, `APPROVED`, `PAID`, `CANCELLED`.
- Document template types: `QUOTE`, `INVOICE`, `PROPOSAL`, `HANDOVER`.

## 9. Operational workflow maps

### 9.1 Lead-to-cash workflow

1. Lead is created and assigned.
2. Team logs calls/messages, notes, follow-up dates, tasks, and lead files.
3. Quote is created from the lead or client.
4. Quote line items can be custom or service-catalogue-driven.
5. Quote PDF can be generated.
6. Quote acceptance can create/find client, create project, create invoice for once-off revenue, create retainer for monthly revenue, and log activity.
7. Invoice is sent/managed from Billing.
8. Payment is recorded and can mark invoice paid.
9. Reports and dashboard reflect revenue, MRR, and conversion metrics.

### 9.2 Client delivery workflow

1. Client exists through direct creation or lead conversion.
2. Project is created from client detail or Projects.
3. Optional checklist template seeds delivery checklist rows.
4. Tasks are created against the client/project.
5. Files, URLs, notes, and activity events are attached during delivery.
6. Checklist items move through statuses and record completion timestamps.
7. Project status/progress/blocker/assignee are updated as work moves forward.

### 9.3 Task execution workflow

1. Task is created with title, type, priority, due date/time, client/project links, assignee, instructions, expected outcome, attachments, and links.
2. Task appears in Tasks and Calendar if due date/time exists; weekly/monthly recurring tasks also project upcoming occurrences into the calendar even before the next task record is materialized.
3. Assignee opens task detail.
4. Assignee can upload/add links, update task data, complete, scrap, or block task.
5. Completion/scrap/block events create activity logs.
6. Completing a recurring task creates the next occurrence and keeps the calendar populated across future weeks.

### 9.4 Expense and monthly-cost workflow

1. Finance opens Billing and selects Add expense.
2. Vendor is selected from saved vendors or `Other / add new vendor` is used.
3. New vendor branch creates the vendor inline before inserting the expense.
4. Expense type identifies subscriptions, payroll, software, contractors, hosting, marketing, office, or general costs.
5. Recurrence determines one-time vs weekly/monthly/quarterly/annual schedule behavior.
6. Expense can be edited when amount/type/status/vendor/recurrence changes.
7. Expense can be removed if it should no longer exist.
8. Expense can be marked paid.
9. Recurring paid expenses roll forward to the next due date instead of closing permanently.

### 9.5 Employee and payroll-to-finance workflow

1. Admin creates employee through Settings or Payroll using `UserForm`.
2. Employee is inserted into `users`, assigned a role, and immediately appears in user selectors and user lists.
3. If a pay rate is present, finance receives a Payroll expense.
4. Payroll runs define a period.
5. Payroll items attach employees to payroll runs and calculate net pay.
6. Payroll item creation also creates pending Payroll expense visibility.
7. Billing expense reports now include payroll costs alongside subscriptions and vendor expenses.

### 9.6 Support workflow

1. Ticket is created from Support or client detail.
2. Ticket can link to client/project and assignee.
3. Ticket status/priority/category guide support triage.
4. Ticket can be updated with internal notes, client update notes, resolution notes, and resolution timestamp.
5. Ticket status feeds support counts and overdue/triage views.

### 9.7 Marketing and affiliate workflow

1. Marketing campaigns track outreach volume and funnel outcomes.
2. Content items track platform/status/performance/leads generated.
3. Affiliates are created with tracking/default commission rules.
4. Referrals link affiliates to leads/clients.
5. Commissions link affiliates to quotes/projects/payments and move through payable/paid/disputed states.

### 9.8 Knowledge workflow

1. Article/SOP is created in Knowledge Base.
2. Files can be uploaded and linked to the article.
3. Knowledge files are listed in the Knowledge Base file section.
4. Knowledge articles can be viewed in modal dialogs.

### 9.9 Administration workflow

1. Company settings control shared billing/document details.
2. Document templates store reusable content for quotes/invoices/proposals/handover docs.
3. Services power service selection in quote forms.
4. Checklist templates/items power project checklist seeding.
5. Role permission cards control application access.
6. Login details form updates the current admin profile/password.

## 10. Known limitations and improvement backlog

These are current limitations identified from the codebase, not requested behavior:

1. Expenses still store vendor names on the expense record; there is no `vendor_id` foreign key yet.
2. Payroll expenses generated from employees are matched by employee name and `expense_type = PAYROLL`; renaming an employee can create a second payroll expense instead of updating by stable employee ID.
3. Recurring expenses roll forward only when marked paid; there is no background job that automatically creates future expense instances or sends reminders.
4. Many create workflows exist, but delete/archive workflows are not universal for notes, files, vendors, payroll runs, payroll items, document templates, checklist templates, services, and support tickets.
5. File records do not have versioning, categories, delete/archive controls, or upload progress UI.
6. Invoice editing and retainer editing are limited compared with creation workflows.
7. Payments do not currently calculate partial-paid totals across multiple payments; a paid payment marks the invoice paid.
8. Commission automation is limited; commission status business rules exist but are not automatically triggered from every payment branch.
9. Notifications table exists, but notification rules/reminders are not fully implemented.
10. Audit logging exists through `activity_logs`, but there is no dedicated audit detail page for sensitive changes.
11. Contacts beyond conversion-created primary contacts are not fully surfaced as a standalone CRM workflow.
12. Document templates are stored but quote/invoice PDF generation is still mostly code-driven.
13. Calendar is task/date driven and does not have drag-and-drop rescheduling.
14. Knowledge base has view/upload workflows but not full edit/delete/article version history.
15. Role permission editing exists, but role creation/deletion UI is not currently documented as available.

## 11. Development and verification commands

- `npm run typecheck`: TypeScript verification.
- `npm run lint`: ESLint verification.
- `npm test`: Vitest unit tests, currently covering business rules.
- `npm run dev`: local development server.
- `npm run build`: production build verification.

## 12. Documentation maintenance rules

- Update this file whenever a page, server action, form, table relationship, workflow branch, or status set changes.
- If a workflow adds a new action button, document the entry page, form component, server action, records touched, activity log branch, and redirect/revalidation behavior.
- If a table gains a column that affects workflow behavior, update the database graph, relevant workflow map, status/reference sections, and limitations/backlog if needed.
- If a limitation is resolved, remove it from the backlog and add the new behavior to the relevant workflow section.
