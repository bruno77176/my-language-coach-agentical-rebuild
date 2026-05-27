-- =============================================================================
-- Supabase pg_cron setup for the cost-and-revenue dashboard.
--
-- Run this ONCE in the Supabase SQL editor (Project → SQL Editor → New query)
-- AFTER setting INTERNAL_CRON_SECRET on Fly (`flyctl secrets set ...`).
--
-- What this does:
--   1. Stores the cron secret on the database so pg_cron jobs can read it
--      without it being hard-coded in pg_cron.job rows (which are visible
--      to anyone with DB access).
--   2. Schedules an HTTP POST to the API's internal refresh endpoint every
--      5 minutes. The endpoint runs `REFRESH MATERIALIZED VIEW CONCURRENTLY
--      daily_cost_by_user`, keeping admin dashboard reads fast.
--
-- Prereqs (one-time, both already enabled on this Supabase project):
--   - pg_cron extension
--   - pg_net extension (for net.http_post)
--
-- Replace the placeholder secret value below with the actual value you set
-- on Fly. Keep them in sync — if you rotate the secret, update both Fly and
-- this database setting.
-- =============================================================================

-- 1. Store the cron secret on the database (only superuser/owner can read it).
ALTER DATABASE postgres SET app.cron_secret = 'paste-INTERNAL_CRON_SECRET-here';

-- 2. Schedule the materialized-view refresh every 5 minutes.
SELECT cron.schedule(
  'refresh-cost-views',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://my-language-coach-agentical-rebuild.fly.dev/admin/internal/refresh-views',
    headers := jsonb_build_object('X-Cron-Secret', current_setting('app.cron_secret'))
  );
  $$
);

-- =============================================================================
-- Useful follow-ups:
--
-- Inspect scheduled jobs:
--   SELECT * FROM cron.job;
--
-- View recent run history:
--   SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 20;
--
-- Unschedule (if you need to disable the refresh):
--   SELECT cron.unschedule('refresh-cost-views');
-- =============================================================================
