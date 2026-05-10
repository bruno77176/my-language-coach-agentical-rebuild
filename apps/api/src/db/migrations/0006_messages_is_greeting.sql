-- Plan 6: flag greeting messages so we can exclude them from streak counting / analytics later.
ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS is_greeting boolean NOT NULL DEFAULT false;
