-- Fix Supabase Security Advisor error "RLS Disabled in Public" on public.__app_migrations.
--
-- The migration runner (src/db/run-migrations.ts) bootstraps this tracking table with a
-- bare CREATE TABLE, so it landed in the `public` schema with no RLS — meaning it was
-- exposed read/write over the PostgREST Data API to the anon/authenticated roles.
--
-- The table is only ever touched by the runner over DATABASE_URL (the Postgres role, which
-- bypasses RLS). Enabling RLS with no policies follows the same default-deny pattern as
-- 0009_cost_rls.sql: nothing matches for anon/authenticated → all rows hidden from the API,
-- while the runner is unaffected.

ALTER TABLE __app_migrations ENABLE ROW LEVEL SECURITY;

-- No policies: intentionally restrict to the bypassing Postgres/service role only.
