-- Fix profiles UPDATE RLS policy: needs WITH CHECK in addition to USING.
-- Without WITH CHECK, Postgres can't validate the new row, so updates
-- silently affect 0 rows even when the caller owns the target row.

DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
CREATE POLICY "profiles_update_own" ON profiles
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
