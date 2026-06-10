-- Daily wall-clock cap milestone (2026-06-10).
-- Track rewarded-ad "+3 min" extensions consumed in the current local day.
-- Reset lazily in app code by the same local-day-key comparison used for
-- daily_voice_seconds_used (no cron). Backfills existing rows to 0.
ALTER TABLE entitlements
  ADD COLUMN IF NOT EXISTS daily_ad_extensions integer NOT NULL DEFAULT 0;
