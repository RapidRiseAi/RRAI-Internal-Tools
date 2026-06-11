# Rapid Rise OS Implementation Plan

## Uploaded production document summary

Source inspected: `Rapid_Rise_OS_Production_Build_Plan.docx`.

The uploaded plan specifies a private desktop-focused internal operating system for Rapid Rise AI called **Rapid Rise OS**. It must centralize CRM, clients, quotes, projects, SOP checklists, tasks, billing, retainers, support tickets, affiliates/referrals, marketing/outreach, knowledge base, files, notes, activity history, reports, notifications, and later AI-assisted workflows.

Core expectations from the plan:

- Next.js App Router, TypeScript, Tailwind CSS, Supabase/PostgreSQL-compatible architecture, server-side validation, and production-quality structure.
- Premium dark SaaS dashboard with electric blue highlights, desktop-first sidebar/topbar shell, command/search affordances, reusable tables, badges, cards, detail pages, notes, files, timelines, and empty/loading/error states.
- Multiple internal users with role-based access control across Owner/Admin, Manager, Sales, Project Manager, Developer/Designer, Support, Finance, Affiliate/Partner, and Read-only roles.
- Database-backed records with `id`, timestamps, ownership/assignment where practical, status fields, activity logging, and safe archive/delete behavior.
- Real workflows for lead follow-up, lead-to-client conversion, quotes, quote-to-project conversion, project checklists/tasks, payment tracking, support resolution, and commission payment readiness.

## What already exists in the repo

- `Rapid_Rise_OS_Production_Build_Plan.docx` containing the production brief.
- `index.html`, a static placeholder page for Vercel.
- No `package.json` existed before this implementation.
- No existing app routes, components, database files, config files, Tailwind setup, or styling system existed before this implementation.

## What will be built first

Phase 1 foundation and the first working operating-system slice:

- Next.js + TypeScript app structure.
- Prisma data model with a PostgreSQL-compatible schema and local SQLite-friendly development default.
- Authentication/session structure using hashed passwords and secure HTTP-only cookies.
- User, role, and permission model with admin-managed employees.
- Protected app shell with desktop sidebar, top bar, dashboard cards, and reusable UI components.
- Database-backed CRUD screens/actions for key Phase 1/2 records: users, leads, clients, tasks, services, and settings.
- Core operational views for dashboard, leads, clients, quotes, projects, tasks, billing, retainers, support, affiliates, marketing, knowledge base, reports, and settings.
- Activity logging for important actions.
- Validation of required fields and status values in server-side actions.

## What will be deferred

Deferred to later production phases after this foundational build:

- Supabase Auth/Storage wiring and production file upload storage.
- Full PDF proposal generation.
- Kanban drag-and-drop interactions.
- Advanced notification delivery via email/WhatsApp.
- Affiliate self-service portal.
- AI-assisted internal workflows.
- Fully granular row-level policy enforcement in Supabase.
- Rich text SOP editor and full-text search infrastructure.

## Assumptions

- Because the repository was effectively empty, the app will use Next.js App Router, TypeScript, Tailwind CSS, Prisma, and a relational schema.
- Local development will default to SQLite for fast setup, while the Prisma schema and environment variable pattern can be switched to PostgreSQL for production.
- A seeded owner user will be used for first login, and the password must be changed before production use.
- File records are modeled now, but binary file storage will be connected later through Supabase Storage or another private object store.
- The first implementation prioritizes a complete foundation and working CRUD for the most critical business objects instead of shallow placeholder-only pages.

## Missing environment variables / services required

Required for local/dev:

- `DATABASE_URL` - defaults can use `file:./dev.db` for local SQLite.
- `SESSION_SECRET` - long random secret used to sign session cookies.
- `SEED_OWNER_EMAIL` - initial owner login email for `prisma db seed`.
- `SEED_OWNER_PASSWORD` - initial owner login password for `prisma db seed`.

Recommended for production:

- PostgreSQL `DATABASE_URL` from Supabase or another hosted Postgres provider.
- Supabase project URL and service/storage keys when file uploads and Supabase Auth are enabled.
- Email provider credentials for invites, reminders, and notifications.
- WhatsApp/API credentials only when advanced messaging integrations are implemented.
