-- Spaced-repetition scheduling for the vocab deck (BRU-30).
--   srs_box          — Leitner box 1..6 (higher = longer interval / better known)
--   due_at           — when the word is next due; NULL = new, not yet introduced
--   last_reviewed_at — timestamp of the last review
-- Additive + idempotent; the existing vocab_items_all_own RLS policy covers it.
ALTER TABLE vocab_items
  ADD COLUMN IF NOT EXISTS srs_box integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS due_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_reviewed_at timestamptz;

-- Seed the box from the legacy 0-3 mastery counter so existing progress isn't
-- lost (mastery 0→box1, 1→box2, 2→box3, 3→box4). due_at stays NULL so the
-- existing words re-enter gradually as "new" via the daily fill — no day-one
-- pile of 100 due cards.
UPDATE vocab_items
  SET srs_box = LEAST(mastery + 1, 4)
  WHERE mastery > 0;

-- Due-queue lookups filter by (user_id, language) and order by due_at.
CREATE INDEX IF NOT EXISTS vocab_items_due_idx
  ON vocab_items (user_id, language, due_at);
