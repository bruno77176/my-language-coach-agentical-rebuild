CREATE TABLE session_feedback (
  conversation_id uuid PRIMARY KEY REFERENCES conversations(id) ON DELETE CASCADE,
  highlights      jsonb NOT NULL DEFAULT '[]'::jsonb,
  corrections     jsonb NOT NULL DEFAULT '[]'::jsonb,
  vocab           jsonb NOT NULL DEFAULT '[]'::jsonb,
  status          text NOT NULL DEFAULT 'pending',
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE session_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "session_feedback_all_own" ON session_feedback
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = session_feedback.conversation_id AND c.user_id = auth.uid()
    )
  );

ALTER TABLE session_feedback
  ADD CONSTRAINT session_feedback_status_check
  CHECK (status IN ('pending', 'ready', 'failed'));
