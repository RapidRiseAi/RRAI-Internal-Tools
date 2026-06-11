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

## App environment variables

The web app must have these runtime environment variables configured wherever it is hosted:

- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SESSION_SECRET`

`NEXT_PUBLIC_SUPABASE_ANON_KEY` is kept in `.env.example` for Supabase client compatibility, but the current server-side app login uses the service role key.
