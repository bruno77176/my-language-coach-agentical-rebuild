-- complete_onboarding: atomic insert of profile + default entitlement
CREATE OR REPLACE FUNCTION complete_onboarding(
  p_display_name text,
  p_native_lang text,
  p_target_lang text,
  p_daily_goal_minutes int,
  p_timezone text
) RETURNS profiles AS $$
DECLARE
  v_user_id uuid;
  v_profile profiles;
  v_reset_at timestamptz;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  v_reset_at := date_trunc('month', (now() AT TIME ZONE p_timezone) + interval '1 month')
                AT TIME ZONE p_timezone;

  INSERT INTO profiles (user_id, display_name, native_lang, target_lang, daily_goal_minutes, timezone)
  VALUES (v_user_id, p_display_name, p_native_lang, p_target_lang, p_daily_goal_minutes, p_timezone)
  RETURNING * INTO v_profile;

  INSERT INTO entitlements (user_id, plan, monthly_voice_seconds_used, monthly_voice_seconds_reset_at)
  VALUES (v_user_id, 'free', 0, v_reset_at);

  RETURN v_profile;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION complete_onboarding(text, text, text, int, text) TO authenticated;

-- current_streak: count consecutive goal-reached days ending today or yesterday
CREATE OR REPLACE FUNCTION current_streak() RETURNS int AS $$
DECLARE
  v_user_id uuid;
  v_today date;
  v_yesterday date;
  v_streak int := 0;
  v_check_date date;
  v_user_tz text;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT timezone INTO v_user_tz FROM profiles WHERE user_id = v_user_id;
  IF v_user_tz IS NULL THEN
    RETURN 0;
  END IF;

  v_today := (now() AT TIME ZONE v_user_tz)::date;
  v_yesterday := v_today - interval '1 day';

  IF EXISTS (SELECT 1 FROM streak_days WHERE user_id = v_user_id AND date = v_today AND goal_reached) THEN
    v_check_date := v_today;
  ELSIF EXISTS (SELECT 1 FROM streak_days WHERE user_id = v_user_id AND date = v_yesterday AND goal_reached) THEN
    v_check_date := v_yesterday;
  ELSE
    RETURN 0;
  END IF;

  WHILE EXISTS (SELECT 1 FROM streak_days WHERE user_id = v_user_id AND date = v_check_date AND goal_reached) LOOP
    v_streak := v_streak + 1;
    v_check_date := v_check_date - interval '1 day';
  END LOOP;

  RETURN v_streak;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION current_streak() TO authenticated;
