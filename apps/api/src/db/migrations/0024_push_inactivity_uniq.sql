-- Backstop the inactivity-reminder sweep's read-then-write against concurrent
-- runs (e.g. two Fly machines during a rolling deploy both boot-tick): at most
-- one PENDING inactivity reminder per user. The sweep inserts with
-- onConflictDoNothing, so the loser is a silent no-op instead of a duplicate
-- "come back" push. Partial so it never constrains sent/cancelled rows or the
-- onboarding kinds.
CREATE UNIQUE INDEX IF NOT EXISTS push_schedule_pending_inactivity_uniq
  ON push_schedule (user_id)
  WHERE kind = 'inactivity-reminder' AND sent_at IS NULL AND cancelled_at IS NULL;
