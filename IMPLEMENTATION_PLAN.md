# Rapid Rise OS Implementation Plan

## Uploaded production document summary

Source inspected: `Rapid_Rise_OS_Production_Build_Plan.docx`.

The uploaded plan specifies a private desktop-focused internal operating system for Rapid Rise AI called **Rapid Rise OS**. It must centralize CRM, clients, quotes, projects, SOP checklists, tasks, billing, retainers, support tickets, affiliates/referrals, marketing/outreach, knowledge base, files, notes, activity history, reports, notifications, and later AI-assisted workflows.

Core expectations from the plan:

- Next.js App Router, TypeScript, Tailwind CSS, Supabase/PostgreSQL-compatible architecture, server-side validation, and production-quality structure.
- Premium dark SaaS dashboard with electric blue highlights, desktop-first sidebar/topbar shell, reusable tables, badges, cards, detail pages, timelines, empty states, and clean spacing.
- Multiple internal users with role-based access control across Owner/Admin, Manager, Sales, Project Manager, Developer/Designer, Support, Finance, Affiliate/Partner, and Read-only roles.
- Database-backed records with `id`, timestamps, ownership/assignment where practical, status fields, activity logging, and safe archive/delete behavior.
- Real workflows for lead follow-up, lead-to-client conversion, quotes, quote-to-project conversion, project checklists/tasks, payment tracking, support resolution, and commission payment readiness.

## What already exists in the repo

- `Rapid_Rise_OS_Production_Build_Plan.docx` containing the production brief.
- The prior scaffold added a Next.js app but incorrectly assumed local Prisma/SQLite and `DATABASE_URL` even though the deployment is Vercel + Supabase environment variables.
- Vercel has the required Supabase variables connected: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`.

## What this revision builds first

Phase 1 foundation and the first working operating-system slice for Vercel deployment:

- Next.js + TypeScript app structure using Supabase directly from server components/actions.
- Versioned Supabase SQL migration in `supabase/migrations` to build the production database schema in the connected Supabase project.
- Authentication/session structure using hashed passwords in the `users` table and secure HTTP-only cookies.
- User, role, and permission model with admin-managed employees.
- Protected app shell with desktop sidebar, top bar, dashboard cards, and reusable UI components.
- Database-backed CRUD screens/actions for key Phase 1/2 records: users, leads, clients, and tasks.
- Operational Supabase-backed views for dashboard, leads, clients, quotes, projects, tasks, billing, retainers, support, affiliates, marketing, knowledge base, reports, services, and settings.
- Activity logging for important actions.
- Server-side validation of required fields and status values.

## What will be deferred

Deferred to later production phases after this Supabase/Vercel foundation:

- Supabase Storage file upload UI and private buckets.
- Full PDF proposal generation.
- Kanban drag-and-drop interactions.
- Advanced notification delivery via email/WhatsApp.
- Affiliate self-service portal.
- AI-assisted internal workflows.
- Rich text SOP editor and full-text search infrastructure.
- Fully granular per-role database RLS policies for direct client-side Supabase usage; the current app uses service-role access only on the server and enforces app-level RBAC.

## Assumptions

- Vercel has `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` configured for Production and Preview.
- Supabase migrations from `supabase/migrations` will be applied to the connected Supabase project before or during deployment.
- The seeded owner defaults to `owner@rapidrise.ai` / `ChangeMe123!` if no custom seed settings are applied in Supabase; this password must be changed before production use.
- File records are modeled now, but binary file storage will be connected later through Supabase Storage.
- The first implementation prioritizes a complete deployed foundation and working CRUD for critical business objects instead of shallow placeholder-only pages.

## Missing environment variables / services required

Required in Vercel:

- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - public anon key, reserved for future client-side Supabase features.
- `SUPABASE_SERVICE_ROLE_KEY` - server-only key used by server components/actions to access Rapid Rise OS tables.
- `SESSION_SECRET` - optional but recommended long random secret used to sign session cookies. If omitted, the app falls back to `SUPABASE_SERVICE_ROLE_KEY` so the three Supabase variables shown in Vercel are enough to deploy.

Recommended later:

- Email provider credentials for invites, reminders, and notifications.
- WhatsApp/API credentials only when advanced messaging integrations are implemented.
- Supabase Storage bucket policies for private client/project files.
