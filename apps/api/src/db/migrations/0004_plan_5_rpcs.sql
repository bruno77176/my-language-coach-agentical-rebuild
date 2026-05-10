-- Plan 5 RPCs: progress summary + translation cache reset.
-- All functions are SECURITY INVOKER and scope by auth.uid() so RLS-equivalent
-- isolation holds even when called via supabase.rpc().

-- Helper: longest streak across all of a user's history.
-- Idempotent re-create.
create or replace function longest_streak(p_user_id uuid)
returns int
language sql
stable
security invoker
as $$
  with goal_days as (
    select date
    from streak_days
    where user_id = p_user_id and goal_reached = true
    order by date
  ),
  groups as (
    select date, date - (row_number() over (order by date))::int as grp
    from goal_days
  ),
  runs as (
    select count(*)::int as len from groups group by grp
  )
  select coalesce(max(len), 0) from runs;
$$;

-- Main RPC: returns the heatmap window + aggregate stats in one call.
create or replace function get_progress_summary()
returns jsonb
language plpgsql
stable
security invoker
as $$
declare
  v_user uuid := auth.uid();
  v_tz text;
  v_today date;
  v_window_start date;
begin
  if v_user is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  select timezone into v_tz from profiles where user_id = v_user;
  if v_tz is null then v_tz := 'UTC'; end if;

  v_today := (now() at time zone v_tz)::date;
  v_window_start := v_today - interval '83 days';

  return jsonb_build_object(
    'current_streak', (select current_streak()),
    'longest_streak', longest_streak(v_user),
    'total_minutes', coalesce(
      (select (sum(seconds_spoken) / 60)::int from streak_days where user_id = v_user),
      0
    ),
    'week_minutes', coalesce(
      (select (sum(seconds_spoken) / 60)::int
       from streak_days
       where user_id = v_user and date >= v_today - interval '6 days'),
      0
    ),
    'total_sessions', (
      select count(*)::int from conversations
      where user_id = v_user and ended_at is not null
    ),
    'days', coalesce(
      (select jsonb_agg(jsonb_build_object(
        'date', to_char(date, 'YYYY-MM-DD'),
        'seconds_spoken', seconds_spoken,
        'goal_reached', goal_reached
      ) order by date)
      from streak_days
      where user_id = v_user and date >= v_window_start),
      '[]'::jsonb
    )
  );
end;
$$;

-- Wipe cached translations on a user's messages. Used when native_lang changes.
create or replace function clear_my_translations()
returns void
language plpgsql
security invoker
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  update messages
  set translation = null
  from conversations
  where messages.conversation_id = conversations.id
    and conversations.user_id = v_user
    and messages.translation is not null;
end;
$$;
