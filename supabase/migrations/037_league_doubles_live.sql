-- Disc Caddy 037: doubles pair shuffle + live team scorecards

-- Doubles leagues need one submission row per player per round.
alter table public.league_round_submissions
  drop constraint if exists league_round_submissions_league_id_round_id_key;

alter table public.league_round_submissions
  drop constraint if exists league_round_submissions_unique;

alter table public.league_round_submissions
  add constraint league_round_submissions_unique
  unique (league_id, round_id, submitted_by);

-- ---------- Shuffle members into random pairs ----------

create or replace function public.shuffle_league_pairs(p_league_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  member_ids uuid[];
  member_count integer;
  i integer;
  pair_id uuid;
  team_idx integer := 0;
  sit_out uuid;
  sit_out_name text;
  pair_names text[] := array[
    'Bag Buzzards', 'Chain Lightning', 'Fore Horsemen', 'Hyzer Heroes',
    'Putt Pirates', 'Tee Titans', 'Disc Dynamos', 'Rough Riders',
    'Ace Seekers', 'Birdie Brigade', 'Mando Mavens', 'Sky Hyzer Crew'
  ];
  a uuid;
  b uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if not public.is_league_admin(p_league_id) then
    raise exception 'Only league admins can shuffle pairs';
  end if;

  select coalesce(array_agg(lm.user_id order by random()), array[]::uuid[])
  into member_ids
  from public.league_members lm
  where lm.league_id = p_league_id;

  member_count := coalesce(array_length(member_ids, 1), 0);
  if member_count < 2 then
    raise exception 'Need at least 2 members to shuffle pairs';
  end if;

  delete from public.league_pairs where league_id = p_league_id;

  i := 1;
  while i < member_count loop
    team_idx := team_idx + 1;
    a := least(member_ids[i], member_ids[i + 1]);
    b := greatest(member_ids[i], member_ids[i + 1]);
    insert into public.league_pairs (league_id, name, player1_id, player2_id)
    values (
      p_league_id,
      pair_names[1 + ((team_idx - 1) % array_length(pair_names, 1))],
      a,
      b
    )
    returning id into pair_id;
    i := i + 2;
  end loop;

  if member_count % 2 = 1 then
    sit_out := member_ids[member_count];
    select coalesce(nullif(trim(p.display_name), ''), split_part(p.email, '@', 1))
    into sit_out_name
    from public.profiles p
    where p.id = sit_out;
  end if;

  return jsonb_build_object(
    'pairs', public.list_league_pairs(p_league_id),
    'sit_out_user_id', sit_out,
    'sit_out_name', sit_out_name
  );
end;
$$;

-- ---------- Start a live doubles scorecard for a pair ----------

create or replace function public.start_league_pair_round(
  p_pair_id uuid,
  p_course_id uuid,
  p_bag_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  pair public.league_pairs%rowtype;
  partner_id uuid;
  rid uuid;
  v_team_id uuid;
  host_rp_id uuid;
  partner_rp_id uuid;
  host_name text;
  partner_name text;
  team_label text;
  course_name text;
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  select * into pair from public.league_pairs where id = p_pair_id;
  if not found then
    raise exception 'Pair not found';
  end if;
  if uid not in (pair.player1_id, pair.player2_id) then
    raise exception 'Only pair members can start a team round';
  end if;
  if not public.is_league_member(pair.league_id) then
    raise exception 'Not a league member';
  end if;
  if not exists (select 1 from public.courses where id = p_course_id) then
    raise exception 'Course not found';
  end if;
  if not exists (select 1 from public.bags where id = p_bag_id and user_id = uid) then
    raise exception 'Select one of your bags to start the round';
  end if;

  partner_id := case
    when uid = pair.player1_id then pair.player2_id
    else pair.player1_id
  end;

  select coalesce(nullif(trim(p.display_name), ''), split_part(p.email, '@', 1))
  into host_name
  from public.profiles p
  where p.id = uid;

  select coalesce(nullif(trim(p.display_name), ''), split_part(p.email, '@', 1))
  into partner_name
  from public.profiles p
  where p.id = partner_id;

  select c.name into course_name from public.courses c where c.id = p_course_id;

  team_label := coalesce(nullif(trim(pair.name), ''), host_name || ' & ' || partner_name);

  insert into public.rounds (
    user_id,
    course_id,
    bag_id,
    status,
    format,
    format_config,
    host_scoring_only
  )
  values (
    uid,
    p_course_id,
    p_bag_id,
    'active',
    'best_ball',
    jsonb_build_object(
      'league_id', pair.league_id,
      'league_pair_id', p_pair_id
    ),
    false
  )
  returning id into rid;

  insert into public.round_players (round_id, user_id, display_name, is_host, sort_order)
  values (rid, uid, host_name, true, 0)
  returning id into host_rp_id;

  insert into public.round_players (round_id, user_id, display_name, is_host, sort_order)
  values (rid, partner_id, partner_name, false, 1)
  returning id into partner_rp_id;

  insert into public.round_teams (round_id, name, sort_order)
  values (rid, team_label, 0)
  returning id into v_team_id;

  update public.round_players
  set team_id = v_team_id
  where id in (host_rp_id, partner_rp_id);

  perform public.create_user_notification(
    partner_id,
    'league_doubles_round',
    host_name || ' started your doubles round',
    'Join the live scorecard for ' || team_label
      || case when course_name is not null then ' at ' || course_name else '' end
      || '. Both partners can update scores.',
    '/',
    jsonb_build_object(
      'round_id', rid,
      'league_id', pair.league_id,
      'pair_id', p_pair_id
    )
  );

  return jsonb_build_object(
    'round_id', rid,
    'course_id', p_course_id,
    'course_name', course_name,
    'team_name', team_label,
    'partner_id', partner_id,
    'partner_name', partner_name
  );
end;
$$;

-- ---------- Auto-submit doubles rounds for both partners ----------

create or replace function public.auto_submit_round_to_leagues(p_round_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  played date;
  r_status text;
  submitted_count integer;
  league_ids jsonb;
  v_league_id uuid;
  v_pair_id uuid;
  partner_id uuid;
begin
  if uid is null then raise exception 'Not authenticated'; end if;

  select r.status, coalesce(r.ended_at, r.started_at)::date
  into r_status, played
  from public.rounds r
  where r.id = p_round_id;

  if r_status is null then raise exception 'Round not found'; end if;
  if r_status <> 'completed' then raise exception 'Round must be completed first'; end if;

  if not exists (
    select 1 from public.round_player_totals pt
    where pt.round_id = p_round_id and pt.user_id = uid and pt.holes_scored >= 9
  ) then
    return jsonb_build_object('submitted', 0, 'league_ids', '[]'::jsonb);
  end if;

  insert into public.league_round_submissions (league_id, round_id, submitted_by)
  select lg.id, p_round_id, uid
  from public.leagues lg
  join public.league_members lm on lm.league_id = lg.id and lm.user_id = uid
  where played between lg.season_start and lg.season_end
  on conflict (league_id, round_id, submitted_by) do nothing;

  select
    nullif(r.format_config ->> 'league_id', '')::uuid,
    nullif(r.format_config ->> 'league_pair_id', '')::uuid
  into v_league_id, v_pair_id
  from public.rounds r
  where r.id = p_round_id;

  if v_league_id is not null and v_pair_id is not null then
    select case
      when lp.player1_id = uid then lp.player2_id
      else lp.player1_id
    end
    into partner_id
    from public.league_pairs lp
    where lp.id = v_pair_id and lp.league_id = v_league_id;

    if partner_id is not null
      and exists (
        select 1 from public.round_players rp
        where rp.round_id = p_round_id and rp.user_id = partner_id
      )
    then
      insert into public.league_round_submissions (league_id, round_id, submitted_by)
      values (v_league_id, p_round_id, partner_id)
      on conflict (league_id, round_id, submitted_by) do nothing;
    end if;
  end if;

  select count(*), coalesce(jsonb_agg(distinct lg.id), '[]'::jsonb)
  into submitted_count, league_ids
  from public.league_round_submissions lrs
  join public.leagues lg on lg.id = lrs.league_id
  where lrs.round_id = p_round_id and lrs.submitted_by = uid;

  return jsonb_build_object('submitted', submitted_count, 'league_ids', league_ids);
end;
$$;

create or replace function public.submit_round_to_league(
  p_league_id uuid,
  p_round_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  hc boolean;
begin
  if uid is null then raise exception 'Not authenticated'; end if;
  if not public.is_league_member(p_league_id) then raise exception 'Not a league member'; end if;
  if not exists (
    select 1 from public.rounds r
    where r.id = p_round_id and r.status = 'completed'
      and (r.user_id = uid or exists (
        select 1 from public.round_players rp where rp.round_id = p_round_id and rp.user_id = uid
      ))
  ) then raise exception 'Invalid round'; end if;

  insert into public.league_round_submissions (league_id, round_id, submitted_by)
  values (p_league_id, p_round_id, uid)
  on conflict (league_id, round_id, submitted_by) do nothing;

  select handicap_enabled into hc from public.leagues where id = p_league_id;
  if hc then
    update public.league_members
    set handicap_index = public.calc_handicap_index(user_id)
    where league_id = p_league_id and user_id = uid;
  end if;
end;
$$;

grant execute on function public.shuffle_league_pairs(uuid) to authenticated;
grant execute on function public.start_league_pair_round(uuid, uuid, uuid) to authenticated;
