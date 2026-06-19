# Functions and Workflows

This document maps the current Rapid Rise OS workflows so missing connections can be found quickly before future improvements.

## Global patterns

- Most create/update workflows are implemented as server actions in `lib/actions.ts` and validate form input with schemas in `lib/validation.ts`.
- List/detail pages fetch database records through helpers in `lib/data.ts`.
- Modal-based forms in `components/forms.tsx`, `components/quote-form.tsx`, and `components/invoice-form.tsx` keep the main pages focused on summary cards and lists.
- Each mutating workflow checks permissions in `lib/auth.ts`, reserves a submission key when needed, writes to Supabase, logs activity where appropriate, revalidates the impacted route, and redirects or returns an action-state error.
- File records can be attached to leads, clients, projects, knowledge base items, tasks, expenses, and activity logs. Uploaded files are stored in the `internal-files` Supabase storage bucket and linked through the `files` table.

## Leads

1. A user opens the Leads page and creates or edits a lead with `LeadForm`.
2. `upsertLead` validates company/contact details, source, service interest, stage, score, follow-up, next action, pain points, and assignee.
3. Lead detail pages show notes, files, and activity history.
4. The activity workflow can add notes, book events, upload files, and assign tasks linked to a lead.
5. Accepted sales outcomes can convert leads into clients through the quote acceptance workflow.

## Clients

1. A user creates or edits a client with `ClientForm`.
2. `upsertClient` records company status, industry, website, contact details, next action, and MRR.
3. Client detail pages aggregate related projects, notes, files, tasks, and activity.
4. The activity workflow supports quick note, event, file, and task actions for the client.

## Quotes

1. A user creates a quote from the Quotes page with `QuoteForm`.
2. The form supports a quote header plus one or more line items.
3. Line items can be custom or populated from services. Totals are calculated client-side and then recomputed server-side.
4. `upsertQuote` writes the quote, replaces quote line items, logs activity, and now surfaces quote line-item insert errors instead of silently continuing.
5. Users can open a quote PDF route for generated output.
6. Accepting a quote can create follow-on project and invoice records according to business rules.

## Projects

1. A project is created with `ProjectForm`, usually connected to a client and optionally to a quote.
2. Projects track status, stage, priority, deadline, progress, blocker, assignee, and optional seeded checklist templates.
3. Project detail supports creating linked tasks, adding notes, and uploading files.
4. Project checklists can be updated item-by-item as delivery progresses.

## Tasks

1. Tasks are created from the Tasks page, project detail, or activity workflow.
2. `upsertTask` stores title, description, type, status, priority, due date, linked client/project, and assignee.
3. Tasks can be tied to leads or clients indirectly through activity workflow context and activity logs.

## Billing, invoices, payments, retainers, expenses, and vendors

### Invoices and payments

1. A user creates invoices with `InvoiceForm` and can optionally seed invoice line items from quote items.
2. `upsertInvoice` writes invoice totals and related line items.
3. Payments are recorded with `PaymentForm`; paid payments update invoice status to paid.

### Retainers

1. Retainers capture the client, type, status, monthly amount, and next billing date.
2. Active retainers contribute to the finance page MRR summary.

### Expenses

1. The first expense question is now the expense type: one-time, weekly recurring, monthly recurring, quarterly recurring, or annual recurring.
2. For one-time expenses, the form asks only for the expense date.
3. For recurring expenses, the form asks for the first due date and an optional next due date. If next due date is omitted, the server uses the first due date or today.
4. Expense records can include vendor name, category, amount, status, notes, client/project links, and receipt attachments.

### Vendors

1. Vendors can now be added from Billing.
2. A vendor records name, category, contact person, email, phone, website, and notes.
3. The Billing page lists vendor contact details so expenses and supplier relationships can be managed from the finance workspace.

## Files and uploads

1. Detail pages and activity workflows use `FileRecordForm` or the activity workflow upload modal.
2. Upload inputs now accept multiple files in a single submission.
3. Each uploaded file is validated, stored, inserted into the `files` table, and associated with the relevant typed entity IDs.
4. External URL links can still be saved one at a time with optional MIME type metadata.

## Settings

1. Company settings store billing/footer details used by generated documents.
2. Services, document templates, users, roles, workflow automations, and checklist templates are managed from Settings.
3. Checklist templates can seed project delivery checklists.

## Known improvement opportunities

- Vendor records are currently separate from expense vendor names; a future improvement could add `vendor_id` to expenses and auto-fill vendor details.
- Recurring expense scheduling stores recurrence and next due date, but automated generation of the next expense occurrence is not yet implemented.
- File upload progress is browser-native only; a future UI enhancement could add per-file progress and retry states.
- Quote acceptance creates downstream records, but more visual workflow status could make the quote-to-project-to-invoice chain easier to audit.
