-- Add a per-word "starred" flag so users can mark important vocab and review
-- only those. Additive + idempotent: safe to run against existing data; the
-- existing vocab_items_all_own RLS policy already covers reads/writes.
ALTER TABLE vocab_items
  ADD COLUMN IF NOT EXISTS starred boolean NOT NULL DEFAULT false;
