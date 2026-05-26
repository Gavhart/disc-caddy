-- Disc Caddy 025: stats, formats, playbook, challenges, scheduled rounds, leagues

-- ---------- Round formats & teams ----------

alter table public.rounds
  add column if not exists format text not null default 'stroke'
    check (format in ('stroke', 'stableford', 'skins', 'best_ball'));

alter table public.rounds
  add column if not exists format_config jsonb not null default '{}'::jsonb;

comment on column public.rounds.format is
  'Scoring format: stroke (default), stableford, skins, or best_ball.';

create table if not exists public.round_teams (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references public.rounds(id) on delete cascade,
  name text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists round_teams_round_idx on public.round_teams (round_id);

alter table public.round_players
  add column if not exists team_id uuid references public.round_teams(id) on delete set null;

-- ---------- Course playbook (structured strategy) ----------

create table if not exists public.course_playbook_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  hole_number integer not null check (hole_number > 0),
  bag_disc_id uuid references public.bag_discs(id) on delete set null,
  throw_style text check (throw_style is null or throw_style in ('backhand', 'forehand')),
  aim_notes text,
  wind_notes text,
  strategy text,
  source_round_id uuid references public.rounds(id) on delete set null,
  updated_at timestamptz not null default now(),
  unique (user_id, course_id, hole_number)
);

create index if not exists course_playbook_user_course_idx
  on public.course_playbook_entries (user_id, course_id, hole_number);

alter table public.course_playbook_entries enable row level security;

drop policy if exists "playbook_select_own" on public.course_playbook_entries;
create policy "playbook_select_own" on public.course_playbook_entries
  for select using (auth.uid() = user_id);

drop policy if exists "playbook_write_own" on public.course_playbook_entries;
create policy "playbook_write_own" on public.course_playbook_entries
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ---------- Weekly challenges ----------

create table if not exists public.challenges (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  description text not null,
  kind text not null check (kind in ('birdies', 'rounds_played', 'under_par_holes', 'eagles', 'play_with_friends')),
  target_value integer not null check (target_value > 0),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists public.challenge_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  challenge_id uuid not null references public.challenges(id) on delete cascade,
  progress integer not null default 0 check (progress >= 0),
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (user_id, challenge_id)
);

create index if not exists challenge_progress_user_idx
  on public.challenge_progress (user_id, challenge_id);

alter table public.challenges enable row level security;
alter table public.challenge_progress enable row level security;

drop policy if exists "challenges_select_all" on public.challenges;
create policy "challenges_select_all" on public.challenges for select using (true);

drop policy if exists "challenge_progress_own" on public.challenge_progress;
create policy "challenge_progress_own" on public.challenge_progress
  for select using (auth.uid() = user_id);

-- ---------- Scheduled community rounds ----------

create table if not exists public.scheduled_rounds (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references public.profiles(id) on delete cascade,
  course_id uuid references public.courses(id) on delete set null,
  scheduled_at timestamptz not null,
  max_players integer not null default 4 check (max_players between 2 and 8),
  visibility text not null default 'community'
    check (visibility in ('friends', 'community')),
  status text not null default 'open'
    check (status in ('open', 'full', 'cancelled', 'completed')),
  notes text,
  round_id uuid references public.rounds(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.scheduled_round_rsvps (
  id uuid primary key default gen_random_uuid(),
  scheduled_round_id uuid not null references public.scheduled_rounds(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'going'
    check (status in ('going', 'maybe', 'declined')),
  created_at timestamptz not null default now(),
  unique (scheduled_round_id, user_id)
);

create index if not exists scheduled_rounds_host_idx on public.scheduled_rounds (host_id, scheduled_at);
create index if not exists scheduled_rounds_when_idx on public.scheduled_rounds (scheduled_at, status);

alter table public.scheduled_rounds enable row level security;
alter table public.scheduled_round_rsvps enable row level security;

drop policy if exists "scheduled_rounds_select" on public.scheduled_rounds;
create policy "scheduled_rounds_select" on public.scheduled_rounds
  for select using (
    auth.uid() = host_id
    or visibility = 'community'
    or (
      visibility = 'friends'
      and exists (
        select 1 from public.friend_requests fr
        where fr.status = 'accepted'
          and (
            (fr.from_user_id = host_id and fr.to_user_id = auth.uid())
            or (fr.to_user_id = host_id and fr.from_user_id = auth.uid())
          )
      )
    )
  );

drop policy if exists "scheduled_rsvps_select" on public.scheduled_round_rsvps;
create policy "scheduled_rsvps_select" on public.scheduled_round_rsvps
  for select using (
    auth.uid() = user_id
    or exists (
      select 1 from public.scheduled_rounds sr
      where sr.id = scheduled_round_id and sr.host_id = auth.uid()
    )
  );

-- ---------- Leagues ----------

create table if not exists public.leagues (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid not null references public.profiles(id) on delete cascade,
  season_start date not null,
  season_end date not null,
  format text not null default 'stroke'
    check (format in ('stroke', 'stableford')),
  settings jsonb not null default '{}'::jsonb,
  invite_code text not null unique default encode(gen_random_bytes(6), 'hex'),
  created_at timestamptz not null default now()
);

create table if not exists public.league_members (
  league_id uuid not null references public.leagues(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('admin', 'member')),
  joined_at timestamptz not null default now(),
  primary key (league_id, user_id)
);

create table if not exists public.league_round_submissions (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  round_id uuid not null references public.rounds(id) on delete cascade,
  submitted_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (league_id, round_id)
);

alter table public.leagues enable row level security;
alter table public.league_members enable row level security;
alter table public.league_round_submissions enable row level security;

drop policy if exists "leagues_select_member" on public.leagues;
create policy "leagues_select_member" on public.leagues
  for select using (
    exists (
      select 1 from public.league_members lm
      where lm.league_id = id and lm.user_id = auth.uid()
    )
  );

drop policy if exists "league_members_select" on public.league_members;
create policy "league_members_select" on public.league_members
  for select using (
    user_id = auth.uid()
    or exists (
      select 1 from public.league_members lm
      where lm.league_id = league_members.league_id and lm.user_id = auth.uid()
    )
  );

drop policy if exists "league_submissions_select" on public.league_round_submissions;
create policy "league_submissions_select" on public.league_round_submissions
  for select using (
    exists (
      select 1 from public.league_members lm
      where lm.league_id = league_id and lm.user_id = auth.uid()
    )
  );

-- ---------- Web push subscriptions ----------

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now(),
  unique (user_id, endpoint)
);

alter table public.push_subscriptions enable row level security;

drop policy if exists "push_subs_own" on public.push_subscriptions;
create policy "push_subs_own" on public.push_subscriptions
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Extend notification kinds
alter table public.user_notifications drop constraint if exists user_notifications_kind_check;
alter table public.user_notifications add constraint user_notifications_kind_check
  check (kind in (
    'scorecard_invite', 'community_message', 'friend_activity', 'round_invite',
    'scheduled_round', 'challenge_complete', 'league_update'
  ));

-- ---------- Helpers ----------

create or replace function public.stableford_points(p_strokes integer, p_par integer)
returns integer
language sql
immutable
as $$
  select case
    when p_par is null then 0
    when p_strokes <= p_par - 3 then 5
    when p_strokes = p_par - 2 then 4
    when p_strokes = p_par - 1 then 3
    when p_strokes = p_par then 2
    when p_strokes = p_par + 1 then 1
    else 0
  end;
$$;

-- Seed rolling weekly challenges (idempotent by slug + week)
insert into public.challenges (slug, title, description, kind, target_value, starts_at, ends_at)
select
  'birdies-' || to_char(date_trunc('week', now()), 'IYYY-IW'),
  'Birdie hunter',
  'Score 3 birdies this week across any rounds.',
  'birdies',
  3,
  date_trunc('week', now()),
  date_trunc('week', now()) + interval '7 days'
where not exists (
  select 1 from public.challenges c
  where c.slug = 'birdies-' || to_char(date_trunc('week', now()), 'IYYY-IW')
);

insert into public.challenges (slug, title, description, kind, target_value, starts_at, ends_at)
select
  'rounds-' || to_char(date_trunc('week', now()), 'IYYY-IW'),
  'Get out there',
  'Complete 2 rounds this week.',
  'rounds_played',
  2,
  date_trunc('week', now()),
  date_trunc('week', now()) + interval '7 days'
where not exists (
  select 1 from public.challenges c
  where c.slug = 'rounds-' || to_char(date_trunc('week', now()), 'IYYY-IW')
);

insert into public.challenges (slug, title, description, kind, target_value, starts_at, ends_at)
select
  'friends-' || to_char(date_trunc('week', now()), 'IYYY-IW'),
  'Squad goals',
  'Play a round with at least 2 other players on your scorecard.',
  'play_with_friends',
  1,
  date_trunc('week', now()),
  date_trunc('week', now()) + interval '7 days'
where not exists (
  select 1 from public.challenges c
  where c.slug = 'friends-' || to_char(date_trunc('week', now()), 'IYYY-IW')
);

-- ---------- RPCs ----------

create or replace function public.set_round_format(
  p_round_id uuid,
  p_format text,
  p_config jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if not public.is_round_host(p_round_id) then
    raise exception 'Only the host can change format';
  end if;
  if p_format not in ('stroke', 'stableford', 'skins', 'best_ball') then
    raise exception 'Invalid format';
  end if;
  update public.rounds
  set format = p_format, format_config = coalesce(p_config, '{}'::jsonb)
  where id = p_round_id;
end;
$$;

create or replace function public.get_round_format_standings(p_round_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  fmt text;
  result jsonb := '[]'::jsonb;
  skins_carry integer := 0;
  rec record;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if not public.is_round_participant(p_round_id) then
    raise exception 'Not a participant';
  end if;

  select r.format into fmt from public.rounds r where r.id = p_round_id;

  if fmt = 'stroke' or fmt is null then
    select coalesce(jsonb_agg(row_to_json(t) order by t.rank), '[]'::jsonb)
    into result
    from (
      select
        rp.id as player_id,
        rp.display_name,
        pt.total_strokes,
        pt.score_to_par,
        row_number() over (order by pt.score_to_par, pt.total_strokes) as rank,
        pt.total_strokes as display_score,
        'strokes' as unit
      from public.round_player_totals pt
      join public.round_players rp on rp.id = pt.round_player_id
      where pt.round_id = p_round_id and pt.holes_scored > 0
    ) t;
    return jsonb_build_object('format', coalesce(fmt, 'stroke'), 'standings', result);
  end if;

  if fmt = 'stableford' then
    select coalesce(jsonb_agg(row_to_json(t) order by t.rank), '[]'::jsonb)
    into result
    from (
      select
        rp.id as player_id,
        rp.display_name,
        coalesce(sum(public.stableford_points(rs.strokes, rs.par)), 0) as display_score,
        coalesce(sum(public.stableford_points(rs.strokes, rs.par)), 0) as stableford_points,
        row_number() over (
          order by coalesce(sum(public.stableford_points(rs.strokes, rs.par)), 0) desc
        ) as rank,
        'pts' as unit
      from public.round_players rp
      left join public.round_scores rs on rs.round_player_id = rp.id
      where rp.round_id = p_round_id
      group by rp.id, rp.display_name
      having coalesce(sum(public.stableford_points(rs.strokes, rs.par)), 0) > 0
    ) t;
    return jsonb_build_object('format', fmt, 'standings', result);
  end if;

  if fmt = 'skins' then
    -- Simplified: count holes where player had unique low score
    select coalesce(jsonb_agg(row_to_json(t) order by t.rank), '[]'::jsonb)
    into result
    from (
      select
        rp.id as player_id,
        rp.display_name,
        count(*) filter (where w.winner_id = rp.id) as display_score,
        count(*) filter (where w.winner_id = rp.id) as skins_won,
        row_number() over (
          order by count(*) filter (where w.winner_id = rp.id) desc
        ) as rank,
        'skins' as unit
      from public.round_players rp
      left join lateral (
        select hole_number,
          (select rp2.id
           from public.round_scores rs2
           join public.round_players rp2 on rp2.id = rs2.round_player_id
           where rs2.round_id = p_round_id and rs2.hole_number = rs.hole_number
           order by rs2.strokes
           limit 1) as winner_id,
          (select count(distinct rs2.strokes)
           from public.round_scores rs2
           where rs2.round_id = p_round_id and rs2.hole_number = rs.hole_number) as distinct_scores
        from public.round_scores rs
        where rs.round_id = p_round_id
        group by hole_number
      ) w on w.winner_id = rp.id and w.distinct_scores = 1
      where rp.round_id = p_round_id
      group by rp.id, rp.display_name
    ) t;
    return jsonb_build_object('format', fmt, 'standings', result);
  end if;

  if fmt = 'best_ball' then
    select coalesce(jsonb_agg(row_to_json(t) order by t.rank), '[]'::jsonb)
    into result
    from (
      select
        rt.id as team_id,
        rt.name as display_name,
        coalesce(sum(hole_best.best_strokes), 0) as display_score,
        coalesce(sum(hole_best.best_strokes - hole_best.par), 0) as score_to_par,
        row_number() over (order by coalesce(sum(hole_best.best_strokes - hole_best.par), 0)) as rank,
        'strokes' as unit
      from public.round_teams rt
      left join lateral (
        select rs.hole_number, min(rs.strokes) as best_strokes, max(rs.par) as par
        from public.round_scores rs
        join public.round_players rp on rp.id = rs.round_player_id
        where rs.round_id = p_round_id and rp.team_id = rt.id
        group by rs.hole_number
      ) hole_best on true
      where rt.round_id = p_round_id
      group by rt.id, rt.name
    ) t;
    return jsonb_build_object('format', fmt, 'standings', result);
  end if;

  return jsonb_build_object('format', fmt, 'standings', '[]'::jsonb);
end;
$$;

create or replace function public.create_round_team(
  p_round_id uuid,
  p_name text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  tid uuid;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if not public.is_round_host(p_round_id) then raise exception 'Host only'; end if;
  insert into public.round_teams (round_id, name, sort_order)
  values (p_round_id, trim(p_name), (select count(*) from public.round_teams where round_id = p_round_id))
  returning id into tid;
  return tid;
end;
$$;

create or replace function public.assign_player_team(
  p_round_player_id uuid,
  p_team_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  rid uuid;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  select round_id into rid from public.round_players where id = p_round_player_id;
  if not public.is_round_host(rid) then raise exception 'Host only'; end if;
  update public.round_players set team_id = p_team_id where id = p_round_player_id;
end;
$$;

create or replace function public.get_player_stats_dashboard()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  stats jsonb;
begin
  if uid is null then raise exception 'Not authenticated'; end if;

  select jsonb_build_object(
    'rounds_played', count(*) filter (where pt.holes_scored >= 9),
    'avg_score_to_par', round(avg(pt.score_to_par) filter (where pt.holes_scored >= 9), 1),
    'best_score_to_par', min(pt.score_to_par) filter (where pt.holes_scored >= 9),
    'worst_score_to_par', max(pt.score_to_par) filter (where pt.holes_scored >= 9),
    'total_birdies', coalesce((
      select count(*)
      from public.round_scores rs
      join public.round_players rp on rp.id = rs.round_player_id
      where rp.user_id = uid and rs.par is not null and rs.strokes = rs.par - 1
    ), 0),
    'avg_putts', round(avg(rs.putts) filter (where rs.putts is not null), 1),
    'rounds_last_30d', count(*) filter (
      where pt.holes_scored >= 9 and pt.ended_at >= now() - interval '30 days'
    ),
    'recent_rounds', coalesce((
      select jsonb_agg(row_to_json(r) order by r.played_at desc)
      from (
        select pt.round_id, pt.score_to_par, pt.total_strokes, pt.holes_scored,
          pt.ended_at as played_at, c.name as course_name
        from public.round_player_totals pt
        left join public.courses c on c.id = pt.course_id
        where pt.user_id = uid and pt.round_status = 'completed' and pt.holes_scored >= 9
        order by pt.ended_at desc nulls last
        limit 10
      ) r
    ), '[]'::jsonb)
  )
  into stats
  from public.round_player_totals pt
  where pt.user_id = uid and pt.round_status = 'completed';

  return coalesce(stats, '{}'::jsonb);
end;
$$;

create or replace function public.get_disc_performance_stats()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Not authenticated'; end if;

  return coalesce((
    select jsonb_agg(row_to_json(d) order by d.throws desc)
    from (
      select
        rt.disc_name,
        rt.throw_style,
        count(*) as throws,
        round(avg(rs.strokes), 1) as avg_strokes,
        round(avg(rs.strokes - rs.par), 1) as avg_to_par
      from public.round_throws rt
      join public.rounds r on r.id = rt.round_id and r.user_id = uid and r.status = 'completed'
      left join public.round_players rp on rp.round_id = r.id and rp.is_host
      left join public.round_scores rs
        on rs.round_player_id = rp.id and rs.hole_number = rt.hole_number
      where rs.strokes is not null
      group by rt.disc_name, rt.throw_style
      having count(*) >= 3
      order by count(*) desc
      limit 15
    ) d
  ), '[]'::jsonb);
end;
$$;

create or replace function public.get_course_playbook(p_course_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Not authenticated'; end if;

  return coalesce((
    select jsonb_agg(row_to_json(x) order by x.hole_number)
    from (
      select
        ch.number as hole_number,
        ch.par,
        ch.distance,
        cpe.bag_disc_id,
        cpe.throw_style,
        cpe.aim_notes,
        cpe.wind_notes,
        cpe.strategy,
        chn.note as hole_note,
        coalesce((
          select jsonb_agg(jsonb_build_object(
            'strokes', rs.strokes, 'par', rs.par, 'played_at', r.ended_at
          ) order by r.ended_at desc)
          from public.rounds r
          join public.round_players rp on rp.round_id = r.id and rp.user_id = uid and rp.is_host
          join public.round_scores rs on rs.round_player_id = rp.id and rs.hole_number = ch.number
          where r.course_id = p_course_id and r.status = 'completed'
          limit 3
        ), '[]'::jsonb) as recent_scores
      from public.course_holes ch
      left join public.course_playbook_entries cpe
        on cpe.course_id = ch.course_id and cpe.hole_number = ch.number and cpe.user_id = uid
      left join public.course_hole_notes chn
        on chn.course_id = ch.course_id and chn.hole_number = ch.number and chn.user_id = uid
      where ch.course_id = p_course_id
    ) x
  ), '[]'::jsonb);
end;
$$;

create or replace function public.upsert_playbook_entry(
  p_course_id uuid,
  p_hole_number integer,
  p_bag_disc_id uuid,
  p_throw_style text,
  p_aim_notes text,
  p_wind_notes text,
  p_strategy text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Not authenticated'; end if;
  insert into public.course_playbook_entries (
    user_id, course_id, hole_number, bag_disc_id, throw_style,
    aim_notes, wind_notes, strategy, updated_at
  ) values (
    uid, p_course_id, p_hole_number, p_bag_disc_id, p_throw_style,
    nullif(trim(p_aim_notes), ''), nullif(trim(p_wind_notes), ''), nullif(trim(p_strategy), ''), now()
  )
  on conflict (user_id, course_id, hole_number) do update set
    bag_disc_id = excluded.bag_disc_id,
    throw_style = excluded.throw_style,
    aim_notes = excluded.aim_notes,
    wind_notes = excluded.wind_notes,
    strategy = excluded.strategy,
    updated_at = now();
end;
$$;

create or replace function public.list_active_challenges()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Not authenticated'; end if;

  return coalesce((
    select jsonb_agg(row_to_json(c) order by c.ends_at)
    from (
      select
        ch.id,
        ch.slug,
        ch.title,
        ch.description,
        ch.kind,
        ch.target_value,
        ch.starts_at,
        ch.ends_at,
        coalesce(cp.progress, 0) as progress,
        cp.completed_at
      from public.challenges ch
      left join public.challenge_progress cp
        on cp.challenge_id = ch.id and cp.user_id = uid
      where ch.starts_at <= now() and ch.ends_at > now()
    ) c
  ), '[]'::jsonb);
end;
$$;

create or replace function public.refresh_challenge_progress()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  ch record;
  prog integer;
begin
  if uid is null then raise exception 'Not authenticated'; end if;

  for ch in
    select * from public.challenges
    where starts_at <= now() and ends_at > now()
  loop
    prog := 0;
    if ch.kind = 'birdies' then
      select count(*) into prog
      from public.round_scores rs
      join public.round_players rp on rp.id = rs.round_player_id
      where rp.user_id = uid and rs.par is not null and rs.strokes = rs.par - 1
        and rs.updated_at >= ch.starts_at and rs.updated_at < ch.ends_at;
    elsif ch.kind = 'rounds_played' then
      select count(distinct pt.round_id) into prog
      from public.round_player_totals pt
      where pt.user_id = uid and pt.round_status = 'completed'
        and pt.holes_scored >= 9
        and pt.ended_at >= ch.starts_at and pt.ended_at < ch.ends_at;
    elsif ch.kind = 'play_with_friends' then
      select count(*) into prog
      from public.rounds r
      where r.user_id = uid and r.status = 'completed'
        and r.ended_at >= ch.starts_at and r.ended_at < ch.ends_at
        and (select count(*) from public.round_players rp where rp.round_id = r.id) >= 3;
    elsif ch.kind = 'under_par_holes' then
      select count(*) into prog
      from public.round_scores rs
      join public.round_players rp on rp.id = rs.round_player_id
      where rp.user_id = uid and rs.par is not null and rs.strokes < rs.par
        and rs.updated_at >= ch.starts_at and rs.updated_at < ch.ends_at;
    elsif ch.kind = 'eagles' then
      select count(*) into prog
      from public.round_scores rs
      join public.round_players rp on rp.id = rs.round_player_id
      where rp.user_id = uid and rs.par is not null and rs.strokes <= rs.par - 2
        and rs.updated_at >= ch.starts_at and rs.updated_at < ch.ends_at;
    end if;

    insert into public.challenge_progress (user_id, challenge_id, progress, completed_at, updated_at)
    values (
      uid, ch.id, prog,
      case when prog >= ch.target_value then now() else null end,
      now()
    )
    on conflict (user_id, challenge_id) do update set
      progress = excluded.progress,
      completed_at = case
        when excluded.progress >= ch.target_value then coalesce(challenge_progress.completed_at, now())
        else null
      end,
      updated_at = now();
  end loop;
end;
$$;

create or replace function public.create_scheduled_round(
  p_course_id uuid,
  p_scheduled_at timestamptz,
  p_max_players integer,
  p_visibility text,
  p_notes text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  sid uuid;
  course_name text;
begin
  if uid is null then raise exception 'Not authenticated'; end if;
  insert into public.scheduled_rounds (host_id, course_id, scheduled_at, max_players, visibility, notes)
  values (uid, p_course_id, p_scheduled_at, coalesce(p_max_players, 4), coalesce(p_visibility, 'community'), nullif(trim(p_notes), ''))
  returning id into sid;

  insert into public.scheduled_round_rsvps (scheduled_round_id, user_id, status)
  values (sid, uid, 'going');

  select c.name into course_name from public.courses c where c.id = p_course_id;

  perform public.create_user_notification(
    uid,
    'scheduled_round',
    'Round scheduled',
    'Your round' || case when course_name is not null then ' at ' || course_name else '' end
      || ' is on the calendar.',
    '/community/scheduled',
    jsonb_build_object('scheduled_round_id', sid)
  );

  return sid;
end;
$$;

create or replace function public.list_scheduled_rounds(p_limit integer default 20)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;

  return coalesce((
    select jsonb_agg(row_to_json(s) order by s.scheduled_at)
    from (
      select
        sr.id,
        sr.host_id,
        coalesce(nullif(trim(p.display_name), ''), split_part(p.email, '@', 1)) as host_name,
        sr.course_id,
        c.name as course_name,
        c.locality as course_locality,
        sr.scheduled_at,
        sr.max_players,
        sr.visibility,
        sr.status,
        sr.notes,
        sr.round_id,
        (select count(*) from public.scheduled_round_rsvps r
         where r.scheduled_round_id = sr.id and r.status = 'going') as going_count,
        (select r.status from public.scheduled_round_rsvps r
         where r.scheduled_round_id = sr.id and r.user_id = auth.uid()) as my_rsvp
      from public.scheduled_rounds sr
      join public.profiles p on p.id = sr.host_id
      left join public.courses c on c.id = sr.course_id
      where sr.status = 'open' and sr.scheduled_at > now() - interval '1 day'
      order by sr.scheduled_at
      limit p_limit
    ) s
  ), '[]'::jsonb);
end;
$$;

create or replace function public.rsvp_scheduled_round(
  p_scheduled_round_id uuid,
  p_status text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if p_status not in ('going', 'maybe', 'declined') then
    raise exception 'Invalid RSVP status';
  end if;
  insert into public.scheduled_round_rsvps (scheduled_round_id, user_id, status)
  values (p_scheduled_round_id, auth.uid(), p_status)
  on conflict (scheduled_round_id, user_id) do update set status = excluded.status;
end;
$$;

create or replace function public.create_league(
  p_name text,
  p_season_start date,
  p_season_end date,
  p_format text default 'stroke'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  lid uuid;
  code text;
begin
  if uid is null then raise exception 'Not authenticated'; end if;
  insert into public.leagues (name, created_by, season_start, season_end, format)
  values (trim(p_name), uid, p_season_start, p_season_end, coalesce(p_format, 'stroke'))
  returning id, invite_code into lid, code;
  insert into public.league_members (league_id, user_id, role) values (lid, uid, 'admin');
  return jsonb_build_object('id', lid, 'invite_code', code);
end;
$$;

create or replace function public.join_league(p_invite_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  lid uuid;
begin
  if uid is null then raise exception 'Not authenticated'; end if;
  select id into lid from public.leagues where invite_code = lower(trim(p_invite_code));
  if lid is null then raise exception 'Invalid invite code'; end if;
  insert into public.league_members (league_id, user_id, role)
  values (lid, uid, 'member')
  on conflict do nothing;
  return lid;
end;
$$;

create or replace function public.list_my_leagues()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  return coalesce((
    select jsonb_agg(row_to_json(l) order by l.season_end desc)
    from (
      select lg.id, lg.name, lg.season_start, lg.season_end, lg.format, lg.invite_code,
        (select count(*) from public.league_members lm where lm.league_id = lg.id) as member_count
      from public.leagues lg
      join public.league_members lm on lm.league_id = lg.id and lm.user_id = auth.uid()
    ) l
  ), '[]'::jsonb);
end;
$$;

create or replace function public.get_league_standings(p_league_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if not exists (
    select 1 from public.league_members where league_id = p_league_id and user_id = auth.uid()
  ) then
    raise exception 'Not a league member';
  end if;

  return coalesce((
    select jsonb_agg(row_to_json(s) order by s.rank)
    from (
      select
        lm.user_id,
        coalesce(nullif(trim(p.display_name), ''), split_part(p.email, '@', 1)) as display_name,
        count(lrs.id) as rounds_submitted,
        round(avg(pt.score_to_par), 1) as avg_score_to_par,
        min(pt.score_to_par) as best_score_to_par,
        row_number() over (order by avg(pt.score_to_par) nulls last, min(pt.score_to_par)) as rank
      from public.league_members lm
      join public.profiles p on p.id = lm.user_id
      left join public.league_round_submissions lrs on lrs.league_id = lm.league_id and lrs.submitted_by = lm.user_id
      left join public.round_player_totals pt on pt.round_id = lrs.round_id and pt.user_id = lm.user_id
      where lm.league_id = p_league_id
      group by lm.user_id, p.display_name, p.email
    ) s
  ), '[]'::jsonb);
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
begin
  if uid is null then raise exception 'Not authenticated'; end if;
  if not exists (
    select 1 from public.league_members where league_id = p_league_id and user_id = uid
  ) then raise exception 'Not a league member'; end if;
  if not exists (
    select 1 from public.rounds r
    where r.id = p_round_id and r.status = 'completed'
      and (r.user_id = uid or exists (
        select 1 from public.round_players rp where rp.round_id = p_round_id and rp.user_id = uid
      ))
  ) then raise exception 'Invalid round'; end if;

  insert into public.league_round_submissions (league_id, round_id, submitted_by)
  values (p_league_id, p_round_id, uid)
  on conflict (league_id, round_id) do nothing;
end;
$$;

create or replace function public.get_friend_head_to_head(p_friend_user_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Not authenticated'; end if;
  if not public.are_friends(uid, p_friend_user_id) then
    raise exception 'Not friends with that player';
  end if;

  return jsonb_build_object(
    'you', coalesce((
      select jsonb_build_object(
        'rounds', count(*),
        'avg_score_to_par', round(avg(score_to_par), 1),
        'best_score_to_par', min(score_to_par)
      )
      from public.round_player_totals
      where user_id = uid and round_status = 'completed' and holes_scored >= 9
    ), '{}'::jsonb),
    'friend', coalesce((
      select jsonb_build_object(
        'rounds', count(*),
        'avg_score_to_par', round(avg(score_to_par), 1),
        'best_score_to_par', min(score_to_par)
      )
      from public.round_player_totals
      where user_id = p_friend_user_id and round_status = 'completed' and holes_scored >= 9
    ), '{}'::jsonb),
    'shared_courses', coalesce((
      select jsonb_agg(row_to_json(sc))
      from (
        select
          c.id as course_id,
          c.name as course_name,
          (select round(avg(pt.score_to_par), 1) from public.round_player_totals pt
           where pt.user_id = uid and pt.course_id = c.id and pt.holes_scored >= 9) as your_avg,
          (select round(avg(pt.score_to_par), 1) from public.round_player_totals pt
           where pt.user_id = p_friend_user_id and pt.course_id = c.id and pt.holes_scored >= 9) as friend_avg
        from public.courses c
        where exists (
          select 1 from public.round_player_totals a
          where a.user_id = uid and a.course_id = c.id and a.holes_scored >= 9
        )
        and exists (
          select 1 from public.round_player_totals b
          where b.user_id = p_friend_user_id and b.course_id = c.id and b.holes_scored >= 9
        )
        limit 10
      ) sc
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.list_courses_near_me(p_radius_miles integer default 50)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Not authenticated'; end if;

  return coalesce((
    select jsonb_agg(row_to_json(n) order by n.distance_miles nulls last, n.name)
    from (
      select
        c.id,
        c.name,
        c.locality,
        c.region_code,
        c.lat,
        c.lon,
        (
          select min(
            3959 * acos(
              least(1, greatest(-1,
                cos(radians(hc.latitude)) * cos(radians(c.lat))
                * cos(radians(c.lon) - radians(hc.longitude))
                + sin(radians(hc.latitude)) * sin(radians(c.lat))
              ))
            )
          )
          from public.profile_home_cities hc
          where hc.user_id = uid and hc.latitude is not null and hc.longitude is not null
            and c.lat is not null and c.lon is not null
        ) as distance_miles,
        (select count(distinct pt.user_id)
         from public.round_player_totals pt
         where pt.course_id = c.id and pt.round_status = 'completed') as rounds_logged
      from public.courses c
      where c.lat is not null and c.lon is not null
    ) n
    where n.distance_miles is null or n.distance_miles <= coalesce(p_radius_miles, 50)
  ), '[]'::jsonb);
end;
$$;

create or replace function public.get_bag_insights(p_bag_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Not authenticated'; end if;
  if not exists (
    select 1 from public.bags b where b.id = p_bag_id and b.user_id = uid
  ) then raise exception 'Bag not found'; end if;

  return jsonb_build_object(
    'unused_discs', coalesce((
      select jsonb_agg(jsonb_build_object('id', bd.id, 'disc_name', bd.disc_name))
      from public.bag_discs bd
      where bd.bag_id = p_bag_id
        and not exists (
          select 1 from public.round_throws rt
          join public.rounds r on r.id = rt.round_id and r.bag_id = p_bag_id and r.user_id = uid
          where rt.bag_disc_id = bd.id
        )
    ), '[]'::jsonb),
    'top_discs', coalesce((
      select jsonb_agg(row_to_json(t) order by t.throws desc)
      from (
        select rt.disc_name, count(*) as throws
        from public.round_throws rt
        join public.rounds r on r.id = rt.round_id and r.bag_id = p_bag_id and r.user_id = uid
        group by rt.disc_name
        order by count(*) desc
        limit 5
      ) t
    ), '[]'::jsonb),
    'disc_count', (select count(*) from public.bag_discs where bag_id = p_bag_id)
  );
end;
$$;

create or replace function public.save_push_subscription(
  p_endpoint text,
  p_p256dh text,
  p_auth text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  insert into public.push_subscriptions (user_id, endpoint, p256dh, auth)
  values (auth.uid(), p_endpoint, p_p256dh, p_auth)
  on conflict (user_id, endpoint) do update set p256dh = excluded.p256dh, auth = excluded.auth;
end;
$$;

-- Grants
grant execute on function public.set_round_format(uuid, text, jsonb) to authenticated;
grant execute on function public.get_round_format_standings(uuid) to authenticated;
grant execute on function public.create_round_team(uuid, text) to authenticated;
grant execute on function public.assign_player_team(uuid, uuid) to authenticated;
grant execute on function public.get_player_stats_dashboard() to authenticated;
grant execute on function public.get_disc_performance_stats() to authenticated;
grant execute on function public.get_course_playbook(uuid) to authenticated;
grant execute on function public.upsert_playbook_entry(uuid, integer, uuid, text, text, text, text) to authenticated;
grant execute on function public.list_active_challenges() to authenticated;
grant execute on function public.refresh_challenge_progress() to authenticated;
grant execute on function public.create_scheduled_round(uuid, timestamptz, integer, text, text) to authenticated;
grant execute on function public.list_scheduled_rounds(integer) to authenticated;
grant execute on function public.rsvp_scheduled_round(uuid, text) to authenticated;
grant execute on function public.create_league(text, date, date, text) to authenticated;
grant execute on function public.join_league(text) to authenticated;
grant execute on function public.list_my_leagues() to authenticated;
grant execute on function public.get_league_standings(uuid) to authenticated;
grant execute on function public.submit_round_to_league(uuid, uuid) to authenticated;
grant execute on function public.get_friend_head_to_head(uuid) to authenticated;
grant execute on function public.list_courses_near_me(integer) to authenticated;
grant execute on function public.get_bag_insights(uuid) to authenticated;
grant execute on function public.save_push_subscription(text, text, text) to authenticated;
