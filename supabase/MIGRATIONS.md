# Database migrations — single source of truth

**This repo (`RRAI-Internal-Tools`) is the sole owner of the shared Supabase
database** (`lakisdthcuejvazgsbxz`). All three apps read/write the same database
at runtime, but **only this repo runs `supabase db push`.**

| App | Role for the DB |
| --- | --- |
| **RRAI-Internal-Tools** (this repo) | **Owner.** Holds every migration; the only place schema changes are written and pushed. |
| **Affaliate-system-** (partner portal) | Consumer. Reads/writes data; **no** migrations (see its `supabase/MIGRATIONS.md`). |
| **rrai-website-3d** (marketing site) | Consumer. Reads/writes via service-role RPCs; no migrations. |

## Making a schema change (from any app, any session)

1. Write the new migration file **here**, in `supabase/migrations/`.
2. Apply it (CLI `supabase db push`, or the Supabase MCP `apply_migration`).
3. The other apps use the change immediately — they talk to the same DB. Optionally
   regenerate their types (`supabase gen types typescript`).

Never add migration files to the consumer repos.

## ⚠️ Ordering caveat for a from-scratch rebuild

`0001_affiliate_system.sql` was originally applied from the portal repo under the
version string `0001`, so it is kept with that name here to stay in sync with the
live database's migration history (a plain `db push` is a clean no-op — nothing
re-runs, no repair needed).

However, `0001` sorts **before** the core CRM migration (`20260611203000…`), and it
depends on the CRM tables existing (its preflight aborts otherwise). On the **live
database this is irrelevant** — everything is already applied in the correct
historical order. It only matters if you ever do a fresh `supabase db reset`
(local/staging from zero).

If you need a clean from-scratch rebuild, rename `0001` so it sorts **after** the
CRM core and **before** the admin migration, then realign the live history once:

```bash
# rename the file: 0001_affiliate_system.sql -> 20260623130000_affiliate_portal_integration.sql
supabase migration repair --status reverted 0001
supabase migration repair --status applied  20260623130000
supabase migration list   # confirm local == remote
```

`migration repair` only edits the migration-tracking table; it never touches your
data. Do this only when you actually need fresh-environment reproducibility.
