-- "Like" a daily quote (BRU-9). A user can heart a quote; we persist the like
-- (quotes are identified by their stable kebab-case id from the shared list).
-- Used later for personalisation / a favourites view. Idempotent + RLS-scoped.
CREATE TABLE IF NOT EXISTS quote_likes (
  user_id    uuid NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  quote_id   text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, quote_id)
);

ALTER TABLE quote_likes ENABLE ROW LEVEL SECURITY;

-- FOR ALL USING also serves as the INSERT WITH CHECK (Postgres defaults the
-- check to the USING expression), so users only ever touch their own rows.
CREATE POLICY "quote_likes_all_own" ON quote_likes
  FOR ALL USING (auth.uid() = user_id);
