-- Self-declared proficiency level (audit §5 follow-up).
--
-- Until now the coach's CEFR level was ONLY ever AI-inferred, after a session
-- (extract-memory). New users started at NULL, so an absolute beginner and a
-- near-fluent speaker got the same first session. This lets users state their
-- level at onboarding and edit it in their profile, so the coach adapts from
-- turn 1. Stored PER target-language (a user can be B2 in Spanish, A1 in
-- Japanese). The AI-inferred coach_memory level still takes precedence once it
-- exists (seed-then-refine); an explicit profile change re-seeds it.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS self_declared_levels jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Extend complete_onboarding with the optional declared level. Drop the old
-- 5-arg signature first so the new default-arg version isn't ambiguous with it
-- (older app builds that omit the arg still resolve to this one via the DEFAULT).
DROP FUNCTION IF EXISTS complete_onboarding(text, text, text, int, text);

CREATE OR REPLACE FUNCTION complete_onboarding(
  p_display_name text,
  p_native_lang text,
  p_target_lang text,
  p_daily_goal_minutes int,
  p_timezone text,
  p_self_declared_level text DEFAULT NULL
) RETURNS profiles AS $$
DECLARE
  v_user_id uuid;
  v_profile profiles;
  v_reset_at timestamptz;
  v_levels jsonb;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  v_reset_at := date_trunc('month', (now() AT TIME ZONE p_timezone) + interval '1 month')
                AT TIME ZONE p_timezone;

  v_levels := CASE
    WHEN p_self_declared_level IS NOT NULL AND p_self_declared_level <> ''
      THEN jsonb_build_object(p_target_lang, p_self_declared_level)
    ELSE '{}'::jsonb
  END;

  INSERT INTO profiles (user_id, display_name, native_lang, target_lang, daily_goal_minutes, timezone, self_declared_levels)
  VALUES (v_user_id, p_display_name, p_native_lang, p_target_lang, p_daily_goal_minutes, p_timezone, v_levels)
  RETURNING * INTO v_profile;

  INSERT INTO entitlements (user_id, plan, monthly_voice_seconds_used, monthly_voice_seconds_reset_at)
  VALUES (v_user_id, 'free', 0, v_reset_at);

  RETURN v_profile;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION complete_onboarding(text, text, text, int, text, text) TO authenticated;

-- set_my_level: user re-asserts their CEFR level for a language from the profile.
-- Updates the per-language declared map AND re-seeds the AI-inferred coach_memory
-- level so the explicit choice takes effect immediately (the AI then refines from
-- there). p_level NULL/'' clears the declaration ("I'm not sure"). SECURITY
-- DEFINER so it can upsert coach_memory (server-owned) on the user's behalf.
CREATE OR REPLACE FUNCTION set_my_level(p_lang text, p_level text)
RETURNS void AS $$
DECLARE
  v_user_id uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_level IS NULL OR p_level = '' THEN
    UPDATE profiles
      SET self_declared_levels = self_declared_levels - p_lang
      WHERE user_id = v_user_id;
  ELSE
    UPDATE profiles
      SET self_declared_levels = self_declared_levels || jsonb_build_object(p_lang, p_level)
      WHERE user_id = v_user_id;

    INSERT INTO coach_memory (user_id, language_code, proficiency_level)
    VALUES (v_user_id, p_lang, p_level)
    ON CONFLICT (user_id, language_code)
    DO UPDATE SET proficiency_level = EXCLUDED.proficiency_level;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION set_my_level(text, text) TO authenticated;
