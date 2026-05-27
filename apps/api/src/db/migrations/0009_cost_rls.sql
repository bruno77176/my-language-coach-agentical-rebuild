-- Lock down cost tables. Service role bypasses RLS (used by the API).
-- Admins read via service role + requireAdmin middleware — no direct client access.

ALTER TABLE usage_events     ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_cards       ENABLE ROW LEVEL SECURITY;
ALTER TABLE fixed_costs      ENABLE ROW LEVEL SECURITY;
ALTER TABLE upfront_costs    ENABLE ROW LEVEL SECURITY;
ALTER TABLE revenue_events   ENABLE ROW LEVEL SECURITY;

-- Default deny: with RLS enabled and no policies, nothing matches → all rows hidden
-- from authenticated/anon roles. Service role (the API) bypasses RLS entirely, which
-- is what we want.

-- No policies needed; we intentionally restrict to service role only.
