CREATE TABLE push_schedule (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  kind         text NOT NULL,
  send_at      timestamptz NOT NULL,
  sent_at      timestamptz,
  cancelled_at timestamptz,
  payload      jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX push_schedule_send_at_idx ON push_schedule (send_at)
  WHERE sent_at IS NULL AND cancelled_at IS NULL;

ALTER TABLE push_schedule ENABLE ROW LEVEL SECURITY;
CREATE POLICY "push_schedule_select_own" ON push_schedule
  FOR SELECT USING (auth.uid() = user_id);
-- Writes are service-role only (no RLS policy for insert/update/delete).
