# Supabase deployment and login setup

This app stores its production schema in `supabase/migrations` and deploys those migrations from GitHub Actions.

## What deploys the database?

The workflow at `.github/workflows/supabase-migrations.yml` runs on every push to `main` that changes the `supabase/` directory. It installs the Supabase CLI, links the project, and runs `supabase db push` so pending migration files are applied to the connected Supabase database.

Required GitHub Actions secrets:

- `SUPABASE_ACCESS_TOKEN` — a Supabase personal access token.
- `SUPABASE_PROJECT_ID` — the Supabase project ref, for example the `abcdefghijklmnopqrst` part in `https://supabase.com/dashboard/project/abcdefghijklmnopqrst`.
- `SUPABASE_DB_PASSWORD` — the database password for the Supabase project.

The workflow can also be run manually from GitHub Actions with **Run workflow**.

## Supabase dashboard integration

Your screenshot shows the repository connected in Supabase, but **Deploy to production** is turned off. You have two valid options:

1. Keep the repository integration connected and turn **Deploy to production** on with production branch `main`.
2. Leave the Supabase dashboard deploy toggle off and let the GitHub Action in this repository deploy migrations.

Do not use both at the same time for the same production database, because two deployment systems can race each other.

## First owner login

The initial migration creates the first owner account if it does not already exist:

- Email: `owner@rapidrise.ai`
- Password: `ChangeMe123!`

Change this password immediately after the first successful login. If you want different first-login credentials before the first production migration runs, edit the owner seed in the migration or create the user manually in Supabase before deploying.

## Vercel app environment variables

Your Vercel screenshot uses the correct variable names for this app. Keep these names exactly as shown in Vercel for both Production and Preview:

- `SUPABASE_SERVICE_ROLE_KEY` — required by `lib/supabase.ts` for server-side database access.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — safe publishable Supabase anon key for browser-compatible Supabase clients.
- `NEXT_PUBLIC_SUPABASE_URL` — your Supabase project URL, for example `https://lakisdthcuejvazgsbxz.supabase.co`.

The current login and internal data access code reads `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` on the server. Do not rename these to `SUPABASE_URL`, `SUPABASE_KEY`, or `SUPABASE_ANON_KEY`, because the app will not find them.

`SESSION_SECRET` should also be set in Vercel before production use so login sessions are signed with your own stable secret instead of the development fallback.

## GitHub Actions secrets are separate from Vercel variables

The Vercel variables above make the deployed web app talk to Supabase. They do not give GitHub Actions permission to run database migrations. The migration workflow still needs these GitHub repository secrets under **GitHub > Settings > Secrets and variables > Actions**:

- `SUPABASE_ACCESS_TOKEN`
- `SUPABASE_PROJECT_ID`
- `SUPABASE_DB_PASSWORD`

You do not need to put `SUPABASE_DB_PASSWORD` in Vercel unless another part of the app starts connecting directly to Postgres. Keep database migration credentials in GitHub Actions only.
