-- Global coach-memory consent.
--
-- Consent moves from a per-(user, language) `coach_memory.opted_out` flag to a
-- single per-user `profiles.memory_enabled` flag. One switch now governs whether
-- ANY coach remembers the user, across every language.

ALTER TABLE profiles
  ADD COLUMN memory_enabled boolean NOT NULL DEFAULT true;

-- Preserve existing intent: anyone who had opted out of memory for ANY language
-- is migrated to globally disabled. Everyone else stays enabled (the default).
UPDATE profiles p
SET memory_enabled = false
WHERE EXISTS (
  SELECT 1 FROM coach_memory cm
  WHERE cm.user_id = p.user_id AND cm.opted_out = true
);

-- The per-language flag is now redundant; coach_memory holds only memory content.
ALTER TABLE coach_memory
  DROP COLUMN opted_out;
