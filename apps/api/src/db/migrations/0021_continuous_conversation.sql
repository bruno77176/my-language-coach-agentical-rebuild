-- Continuous conversation ("infinite thread") — schema for per-language threads
-- and feedback/memory checkpoints. See docs/superpowers/specs/2026-07-05-continuous-conversation-design.md
--
-- All changes are ADDITIVE and backward-compatible with the currently-deployed
-- API: the existing /end path keeps writing scenario/legacy rows keyed by
-- conversation_id; new columns default to the legacy shape. Safe to apply before
-- the new code deploys.

-- 1. conversations.kind — mark the single persistent per-language thread row.
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'session';

-- Exactly one thread per (user, language). Partial: only 'thread' rows are unique;
-- legacy/scenario 'session' rows are unconstrained.
CREATE UNIQUE INDEX IF NOT EXISTS conversations_one_thread_per_lang
  ON conversations (user_id, language) WHERE kind = 'thread';

-- 2. session_checkpoints — one "practice segment" of a thread.
CREATE TABLE IF NOT EXISTS session_checkpoints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  language text NOT NULL,
  started_at timestamptz NOT NULL,
  ended_at timestamptz NOT NULL,
  seconds_spoken integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS checkpoints_user_ended_idx ON session_checkpoints (user_id, ended_at DESC);
CREATE INDEX IF NOT EXISTS checkpoints_conv_ended_idx ON session_checkpoints (conversation_id, ended_at DESC);

-- RLS: the API talks to Postgres over DATABASE_URL (bypasses RLS); these policies
-- are defense-in-depth for the PostgREST Data API, matching the owner-scoped
-- pattern used by conversations/messages. Reads/writes are owner-only.
ALTER TABLE session_checkpoints ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS session_checkpoints_select_own ON session_checkpoints;
CREATE POLICY session_checkpoints_select_own ON session_checkpoints
  FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS session_checkpoints_insert_own ON session_checkpoints;
CREATE POLICY session_checkpoints_insert_own ON session_checkpoints
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 3. session_feedback — was PK(conversation_id) (1:1 per conversation). A thread
-- has many checkpoints, each with its own feedback row (same conversation_id,
-- distinct checkpoint_id). Drop the PK; dedup via partial unique indexes.
ALTER TABLE session_feedback DROP CONSTRAINT IF EXISTS session_feedback_pkey;
ALTER TABLE session_feedback ADD COLUMN IF NOT EXISTS checkpoint_id uuid REFERENCES session_checkpoints(id) ON DELETE CASCADE;
-- scenario/legacy rows (checkpoint_id NULL): still 1:1 on conversation_id.
CREATE UNIQUE INDEX IF NOT EXISTS session_feedback_conversation_uniq
  ON session_feedback (conversation_id) WHERE checkpoint_id IS NULL;
-- thread rows: 1:1 on checkpoint_id.
CREATE UNIQUE INDEX IF NOT EXISTS session_feedback_checkpoint_uniq
  ON session_feedback (checkpoint_id) WHERE checkpoint_id IS NOT NULL;

-- 4. digest_jobs — drop the column-level UNIQUE(conversation_id) (a thread
-- enqueues one digest per checkpoint, so conversation_id repeats). Replace with
-- partial uniques mirroring session_feedback.
ALTER TABLE digest_jobs DROP CONSTRAINT IF EXISTS digest_jobs_conversation_id_unique;
ALTER TABLE digest_jobs DROP CONSTRAINT IF EXISTS digest_jobs_conversation_id_key;
ALTER TABLE digest_jobs ADD COLUMN IF NOT EXISTS checkpoint_id uuid REFERENCES session_checkpoints(id) ON DELETE CASCADE;
CREATE UNIQUE INDEX IF NOT EXISTS digest_jobs_conversation_uniq
  ON digest_jobs (conversation_id) WHERE checkpoint_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS digest_jobs_checkpoint_uniq
  ON digest_jobs (checkpoint_id) WHERE checkpoint_id IS NOT NULL;
