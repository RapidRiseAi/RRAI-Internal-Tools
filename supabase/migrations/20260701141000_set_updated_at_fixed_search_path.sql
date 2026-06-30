begin;

-- Advisor lint 0011 (function_search_path_mutable): pin a stable search_path on
-- the core trigger function so it can't be influenced by a caller's search_path.
-- The body only calls now() (pg_catalog, always in scope), so '' is safe.
alter function public.set_updated_at() set search_path = '';

commit;
