CREATE TABLE coach_memory (
  user_id              uuid NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  language_code        text NOT NULL,
  proficiency_level    text,
  recent_topics        jsonb NOT NULL DEFAULT '[]'::jsonb,
  weak_areas           jsonb NOT NULL DEFAULT '[]'::jsonb,
  personal_context     jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_session_summary text,
  opted_out            boolean NOT NULL DEFAULT false,
  updated_at           timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, language_code)
);

ALTER TABLE coach_memory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "coach_memory_select_own" ON coach_memory
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "coach_memory_insert_own" ON coach_memory
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "coach_memory_update_own" ON coach_memory
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "coach_memory_delete_own" ON coach_memory
  FOR DELETE USING (auth.uid() = user_id);
