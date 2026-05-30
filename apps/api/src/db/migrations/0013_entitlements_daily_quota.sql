ALTER TABLE entitlements
  ADD COLUMN daily_voice_seconds_used integer NOT NULL DEFAULT 0,
  ADD COLUMN daily_reset_at timestamptz NOT NULL DEFAULT now();
