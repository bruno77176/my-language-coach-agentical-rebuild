CREATE MATERIALIZED VIEW IF NOT EXISTS daily_cost_by_user AS
SELECT
  date_trunc('day', created_at) AS day,
  user_id,
  platform,
  provider,
  operation,
  SUM(units)::numeric(20,6)        AS units,
  SUM(cost_usd)::numeric(12,6)     AS cost_usd,
  COUNT(*)::int                    AS event_count
FROM usage_events
GROUP BY 1, 2, 3, 4, 5;

CREATE UNIQUE INDEX IF NOT EXISTS daily_cost_by_user_uniq_idx
  ON daily_cost_by_user (day, user_id, platform, provider, operation);
CREATE INDEX IF NOT EXISTS daily_cost_by_user_day_idx ON daily_cost_by_user (day);
CREATE INDEX IF NOT EXISTS daily_cost_by_user_user_idx ON daily_cost_by_user (user_id, day);
CREATE INDEX IF NOT EXISTS daily_cost_by_user_provider_idx ON daily_cost_by_user (provider, day);
