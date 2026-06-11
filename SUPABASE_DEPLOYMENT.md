# Supabase deployment and login setup

This repository is set up for the **Supabase GitHub Integration**, not a custom GitHub Actions migration runner.

Because your Supabase project is already connected to GitHub, you do **not** need `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_ID`, or `SUPABASE_DB_PASSWORD` in GitHub Actions just to deploy the SQL migrations in this repo. Those secrets were only required by the custom GitHub Action that has now been removed.

## How this database deploys

Supabase reads the committed `supabase/` directory from GitHub. When the Supabase dashboard integration is configured for this repository, Supabase automatically applies migration files from `supabase/migrations`.

For this repository, use these Supabase dashboard settings:

- **GitHub repository:** `RapidRiseAi/RRAI-Internal-Tools`
- **Working directory:** `.` because the `supabase/` folder is at the repository root.
- **Production branch:** `main`
- **Deploy to production:** turn this on if you want Supabase to apply migrations automatically when `main` is updated.

Your earlier screenshot showed the repository connection and working directory correctly, but **Deploy to production** was off. With that toggle off, pushing to GitHub will not automatically apply the production database migration.

## What exists in this repo

The production schema is already committed at:

- `supabase/migrations/20260611203000_rapid_rise_os_core.sql`

That migration creates the core Rapid Rise OS database tables, indexes, roles, services, demo lead, update triggers, and the first owner user.

## First owner login

After the migration has been applied to Supabase, the seeded owner login is:

- Email: `owner@rapidrise.ai`
- Password: `ChangeMe123!`

Change this password immediately after the first successful login. If the migration has not run yet, this user will not exist and the app will show `Invalid login details.`

## Vercel app environment variables

Your Vercel screenshot uses the correct variable names for this app. Keep these names exactly as shown in Vercel for both Production and Preview:

- `SUPABASE_SERVICE_ROLE_KEY` — required by `lib/supabase.ts` for server-side database access.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — safe publishable Supabase anon key for browser-compatible Supabase clients.
- `NEXT_PUBLIC_SUPABASE_URL` — your Supabase project URL, for example `https://lakisdthcuejvazgsbxz.supabase.co`.

The current login and internal data access code reads `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` on the server. Do not rename these to `SUPABASE_URL`, `SUPABASE_KEY`, or `SUPABASE_ANON_KEY`, because the app will not find them.

`SESSION_SECRET` should also be set in Vercel before production use so login sessions are signed with your own stable secret instead of the development fallback.

## Important difference: Vercel vs Supabase migration deployment

Vercel variables make the deployed web app connect to Supabase at runtime.

Supabase database migrations are deployed by the Supabase GitHub Integration reading the committed `supabase/migrations` files from GitHub. That is why the repo does not need a separate `.github/workflows/supabase-migrations.yml` workflow when the Supabase integration is already connected.
