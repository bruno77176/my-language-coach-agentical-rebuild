-- 0022_coach_memory_agentic.sql
-- Agentic coach memory L1: semantic memory items + durable digest queue.

CREATE EXTENSION IF NOT EXISTS vector;

-- Curated, embedded memory units (one row per atomic fact/mistake/etc.).
CREATE TABLE memory_items (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              uuid NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  language_code        text NOT NULL,
  type                 text NOT NULL CHECK (type IN ('fact','mistake','preference','goal','persona_detail')),
  content              text NOT NULL,
  embedding            vector(1536),
  salience             real NOT NULL DEFAULT 0.5,
  status               text NOT NULL DEFAULT 'active' CHECK (status IN ('active','archived')),
  source_conversation_id uuid REFERENCES conversations(id) ON DELETE SET NULL,
  due_at               timestamptz,
  sr_interval_days     integer,
  sr_ease              real,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  last_seen_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX memory_items_owner_idx ON memory_items (user_id, language_code, status);
CREATE INDEX memory_items_due_idx   ON memory_items (user_id, language_code, due_at);
CREATE INDEX memory_items_embedding_idx ON memory_items
  USING hnsw (embedding vector_cosine_ops);

ALTER TABLE memory_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "memory_items_select_own" ON memory_items
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "memory_items_insert_own" ON memory_items
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "memory_items_update_own" ON memory_items
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "memory_items_delete_own" ON memory_items
  FOR DELETE USING (auth.uid() = user_id);

-- Durable between-session digest queue.
CREATE TABLE digest_jobs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL UNIQUE REFERENCES conversations(id) ON DELETE CASCADE,
  language_code   text NOT NULL,
  status          text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','running','done','failed')),
  attempts        integer NOT NULL DEFAULT 0,
  last_error      text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX digest_jobs_pending_idx ON digest_jobs (status, created_at);

ALTER TABLE digest_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "digest_jobs_select_own" ON digest_jobs
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "digest_jobs_insert_own" ON digest_jobs
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "digest_jobs_update_own" ON digest_jobs
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "digest_jobs_delete_own" ON digest_jobs
  FOR DELETE USING (auth.uid() = user_id);

-- Next-lesson plan (the "brain" output) lives on the existing profile row.
ALTER TABLE coach_memory ADD COLUMN next_plan jsonb;
ALTER TABLE coach_memory ADD COLUMN next_plan_generated_at timestamptz;
