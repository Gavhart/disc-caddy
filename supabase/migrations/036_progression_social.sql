-- Disc Caddy 036: Profile progression, playing today check-ins, round highlights

-- ---------- Badge definitions ----------

create table if not exists public.badge_definitions (
  slug text primary key,
  title text not null,
  description text not null,
  icon text not null default '🏅',
  sort_order integer not null default 0
);

create table if not exists public.player_badges (
  user_id uuid not null references public.profiles(id) on delete cascade,
  badge_slug text not null references public.badge_definitions(slug) on delete cascade,
  earned_at timestamptz not null default now(),
  primary key (user_id, badge_slug)
);

create index if not exists player_badges_user_idx on public.player_badges (user_id, earned_at desc);

alter table public.badge_definitions enable row level security;
alter table public.player_badges enable row level security;

drop policy if exists "badge_definitions_select" on public.badge_definitions;
create policy "badge_definitions_select" on public.badge_definitions
  for select using (true);

drop policy if exists "player_badges_select" on public.player_badges;
create policy "player_badges_select" on public.player_badges
  for select using (true);

insert into public.badge_definitions (slug, title, description, icon, sort_order) values
  ('first_round', 'First round', 'Completed your first scored round.', '🥏', 10),
  ('round_regular', 'Regular', 'Completed 5 rounds.', '📋', 20),
  ('round_veteran', 'Veteran', 'Completed 25 rounds.', '🏌️', 30),
  ('birdie_collector', 'Birdie collector', 'Recorded 10 birdies.', '🐦', 40),
  ('eagle_eye', 'Eagle eye', 'Recorded an eagle.', '🦅', 50),
  ('group_round', 'Group round', 'Played a round with 3 or more players.', '👥', 60),
  ('league_member', 'League member', 'Joined a league.', '🏆', 70),
  ('league_contributor', 'League contributor', 'Submitted 5 rounds to leagues.', '📊', 80),
  ('challenge_finisher', 'Challenge finisher', 'Completed a weekly challenge.', '✅', 90),
  ('hot_streak', 'Hot streak', 'Logged rounds on 3 different days in the last 7 days.', '🔥', 100),
  ('highlight_sharer', 'Highlight sharer', 'Shared a round highlight photo.', '📸', 110),
  ('playing_today', 'On the course', 'Checked in as playing today.', '📍', 120)
on conflict (slug) do nothing;

-- ---------- Course check-ins (playing today) ----------

create table if not exists public.course_checkins (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  note text,
  checked_in_at timestamptz not null default now()
);

create index if not exists course_checkins_course_idx on public.course_checkins (course_id, checked_in_at desc);
create index if not exists course_checkins_time_idx on public.course_checkins (checked_in_at desc);

alter table public.course_checkins enable row level security;

drop policy if exists "course_checkins_select" on public.course_checkins;
create policy "course_checkins_select" on public.course_checkins
  for select using (true);

drop policy if exists "course_checkins_own" on public.course_checkins;
create policy "course_checkins_own" on public.course_checkins
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------- Round highlights ----------

create table if not exists public.round_highlights (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references public.rounds(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  storage_path text not null,
  caption text,
  created_at timestamptz not null default now()
);

create index if not exists round_highlights_round_idx on public.round_highlights (round_id, created_at desc);
create index if not exists round_highlights_user_idx on public.round_highlights (user_id, created_at desc);

alter table public.round_highlights enable row level security;

drop policy if exists "round_highlights_select" on public.round_highlights;
create policy "round_highlights_select" on public.round_highlights
  for select using (
    user_id = auth.uid()
    or exists (
      select 1 from public.friend_requests fr
      where fr.status = 'accepted'
        and auth.uid() in (fr.from_user_id, fr.to_user_id)
        and user_id in (fr.from_user_id, fr.to_user_id)
    )
  );

drop policy if exists "round_highlights_own" on public.round_highlights;
create policy "round_highlights_own" on public.round_highlights
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------- Stats summary ----------

create or replace function public.get_player_stats_summary(p_user_id uuid default auth.uid())
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  uid uuid := coalesce(p_user_id, auth.uid());
  rounds_completed integer := 0;
  birdies integer := 0;
  eagles integer := 0;
  best_to_par integer := null;
  league_rounds integer := 0;
  league_count integer := 0;
  group_rounds integer := 0;
  challenges_done integer := 0;
  active_days_7 integer := 0;
  highlight_count integer := 0;
begin
  if uid is null then raise exception 'Not authenticated'; end if;

  select count(*)::int into rounds_completed
  from public.round_player_totals pt
  where pt.user_id = uid and pt.round_status = 'completed' and pt.holes_scored >= 9;

  select count(*)::int into birdies
  from public.round_scores rs
  join public.round_players rp on rp.id = rs.round_player_id
  where rp.user_id = uid and rs.par is not null and rs.strokes = rs.par - 1;

  select count(*)::int into eagles
  from public.round_scores rs
  join public.round_players rp on rp.id = rs.round_player_id
  where rp.user_id = uid and rs.par is not null and rs.strokes <= rs.par - 2;

  select min(pt.score_to_par)::int into best_to_par
  from public.round_player_totals pt
  where pt.user_id = uid and pt.round_status = 'completed' and pt.holes_scored >= 9;

  select count(*)::int into league_rounds
  from public.league_round_submissions lrs
  where lrs.submitted_by = uid;

  select count(*)::int into league_count
  from public.league_members lm
  where lm.user_id = uid;

  select count(*)::int into group_rounds
  from public.rounds r
  where r.user_id = uid and r.status = 'completed'
    and (select count(*) from public.round_players rp where rp.round_id = r.id) >= 3;

  select count(*)::int into challenges_done
  from public.challenge_progress cp
  where cp.user_id = uid and cp.completed_at is not null;

  select count(distinct date(pt.ended_at))::int into active_days_7
  from public.round_player_totals pt
  where pt.user_id = uid and pt.round_status = 'completed'
    and pt.ended_at >= now() - interval '7 days';

  select count(*)::int into highlight_count
  from public.round_highlights rh
  where rh.user_id = uid;

  return jsonb_build_object(
    'rounds_completed', rounds_completed,
    'birdies', birdies,
    'eagles', eagles,
    'best_score_to_par', best_to_par,
    'league_rounds', league_rounds,
    'league_count', league_count,
    'group_rounds', group_rounds,
    'challenges_completed', challenges_done,
    'active_days_last_7', active_days_7,
    'highlight_count', highlight_count
  );
end;
$$;

-- ---------- Badge refresh ----------

create or replace function public.award_badge(p_user_id uuid, p_slug text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.player_badges (user_id, badge_slug)
  values (p_user_id, p_slug)
  on conflict do nothing;
end;
$$;

create or replace function public.refresh_player_badges(p_user_id uuid default auth.uid())
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := coalesce(p_user_id, auth.uid());
  stats jsonb;
  rounds_completed integer;
  birdies integer;
  eagles integer;
  league_rounds integer;
  league_count integer;
  group_rounds integer;
  challenges_done integer;
  active_days_7 integer;
  highlight_count integer;
  before_count integer;
  after_count integer;
begin
  if uid is null then raise exception 'Not authenticated'; end if;

  select count(*) into before_count from public.player_badges where user_id = uid;

  stats := public.get_player_stats_summary(uid);
  rounds_completed := coalesce((stats->>'rounds_completed')::int, 0);
  birdies := coalesce((stats->>'birdies')::int, 0);
  eagles := coalesce((stats->>'eagles')::int, 0);
  league_rounds := coalesce((stats->>'league_rounds')::int, 0);
  league_count := coalesce((stats->>'league_count')::int, 0);
  group_rounds := coalesce((stats->>'group_rounds')::int, 0);
  challenges_done := coalesce((stats->>'challenges_completed')::int, 0);
  active_days_7 := coalesce((stats->>'active_days_last_7')::int, 0);
  highlight_count := coalesce((stats->>'highlight_count')::int, 0);

  if rounds_completed >= 1 then perform public.award_badge(uid, 'first_round'); end if;
  if rounds_completed >= 5 then perform public.award_badge(uid, 'round_regular'); end if;
  if rounds_completed >= 25 then perform public.award_badge(uid, 'round_veteran'); end if;
  if birdies >= 10 then perform public.award_badge(uid, 'birdie_collector'); end if;
  if eagles >= 1 then perform public.award_badge(uid, 'eagle_eye'); end if;
  if group_rounds >= 1 then perform public.award_badge(uid, 'group_round'); end if;
  if league_count >= 1 then perform public.award_badge(uid, 'league_member'); end if;
  if league_rounds >= 5 then perform public.award_badge(uid, 'league_contributor'); end if;
  if challenges_done >= 1 then perform public.award_badge(uid, 'challenge_finisher'); end if;
  if active_days_7 >= 3 then perform public.award_badge(uid, 'hot_streak'); end if;
  if highlight_count >= 1 then perform public.award_badge(uid, 'highlight_sharer'); end if;
  if exists (
    select 1 from public.course_checkins cc
    where cc.user_id = uid and cc.checked_in_at >= now() - interval '14 hours'
  ) then
    perform public.award_badge(uid, 'playing_today');
  end if;

  select count(*) into after_count from public.player_badges where user_id = uid;
  return after_count - before_count;
end;
$$;

create or replace function public.list_player_badges(p_user_id uuid default auth.uid())
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  uid uuid := coalesce(p_user_id, auth.uid());
begin
  if uid is null then raise exception 'Not authenticated'; end if;
  return coalesce((
    select jsonb_agg(row_to_json(b) order by b.sort_order, b.earned_at desc)
    from (
      select
        bd.slug,
        bd.title,
        bd.description,
        bd.icon,
        bd.sort_order,
        pb.earned_at
      from public.player_badges pb
      join public.badge_definitions bd on bd.slug = pb.badge_slug
      where pb.user_id = uid
    ) b
  ), '[]'::jsonb);
end;
$$;

-- ---------- Check-ins ----------

create or replace function public.check_in_course(p_course_id uuid, p_note text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Not authenticated'; end if;
  if not exists (select 1 from public.courses where id = p_course_id) then
    raise exception 'Course not found';
  end if;
  insert into public.course_checkins (user_id, course_id, note, checked_in_at)
  values (uid, p_course_id, nullif(trim(p_note), ''), now())
  on conflict (user_id) do update set
    course_id = excluded.course_id,
    note = excluded.note,
    checked_in_at = now();
  perform public.award_badge(uid, 'playing_today');
end;
$$;

create or replace function public.clear_course_checkin()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  delete from public.course_checkins where user_id = auth.uid();
end;
$$;

create or replace function public.get_my_course_checkin()
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
  return (
    select jsonb_build_object(
      'course_id', cc.course_id,
      'course_name', c.name,
      'course_locality', c.locality,
      'note', cc.note,
      'checked_in_at', cc.checked_in_at
    )
    from public.course_checkins cc
    join public.courses c on c.id = cc.course_id
    where cc.user_id = uid
      and cc.checked_in_at >= now() - interval '14 hours'
  );
end;
$$;

create or replace function public.list_playing_today(p_limit integer default 30)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  return coalesce((
    select jsonb_agg(row_to_json(x) order by x.checked_in_at desc)
    from (
      select
        cc.user_id,
        coalesce(nullif(trim(p.display_name), ''), split_part(p.email, '@', 1)) as display_name,
        cc.course_id,
        c.name as course_name,
        c.locality as course_locality,
        cc.note,
        cc.checked_in_at
      from public.course_checkins cc
      join public.profiles p on p.id = cc.user_id
      join public.courses c on c.id = cc.course_id
      where cc.checked_in_at >= now() - interval '14 hours'
        and p.community_visible = true
      order by cc.checked_in_at desc
      limit greatest(1, least(coalesce(p_limit, 30), 100))
    ) x
  ), '[]'::jsonb);
end;
$$;

-- ---------- Round highlights ----------

create or replace function public.add_round_highlight(
  p_round_id uuid,
  p_storage_path text,
  p_caption text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  hid uuid;
begin
  if uid is null then raise exception 'Not authenticated'; end if;
  if not exists (
    select 1 from public.rounds r
    where r.id = p_round_id and r.user_id = uid and r.status = 'completed'
  ) then
    raise exception 'Round not found or not completed';
  end if;
  if (select count(*) from public.round_highlights where round_id = p_round_id and user_id = uid) >= 4 then
    raise exception 'Maximum 4 highlights per round';
  end if;
  insert into public.round_highlights (round_id, user_id, storage_path, caption)
  values (p_round_id, uid, p_storage_path, nullif(trim(p_caption), ''))
  returning id into hid;
  perform public.award_badge(uid, 'highlight_sharer');
  return hid;
end;
$$;

create or replace function public.delete_round_highlight(p_highlight_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  delete from public.round_highlights
  where id = p_highlight_id and user_id = auth.uid();
end;
$$;

create or replace function public.list_round_highlights(p_round_id uuid)
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
    select jsonb_agg(row_to_json(h) order by h.created_at)
    from (
      select rh.id, rh.storage_path, rh.caption, rh.created_at, rh.user_id
      from public.round_highlights rh
      where rh.round_id = p_round_id
        and (
          rh.user_id = uid
          or exists (
            select 1 from public.friend_requests fr
            where fr.status = 'accepted'
              and uid in (fr.from_user_id, fr.to_user_id)
              and rh.user_id in (fr.from_user_id, fr.to_user_id)
          )
        )
    ) h
  ), '[]'::jsonb);
end;
$$;

-- Extend friend activity with optional highlight

drop function if exists public.list_friend_activity(integer);

create or replace function public.list_friend_activity(p_limit integer default 15)
returns table (
  user_id uuid,
  display_name text,
  course_name text,
  course_locality text,
  score_to_par integer,
  total_strokes integer,
  played_at timestamptz,
  round_id uuid,
  highlight_path text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    return;
  end if;

  return query
  with friends as (
    select case
      when fr.from_user_id = uid then fr.to_user_id
      else fr.from_user_id
    end as friend_id
    from public.friend_requests fr
    where fr.status = 'accepted'
      and uid in (fr.from_user_id, fr.to_user_id)
  )
  select
    f.friend_id,
    coalesce(nullif(trim(p.display_name), ''), split_part(p.email, '@', 1)),
    c.name,
    c.locality,
    t.score_to_par::int,
    t.total_strokes::int,
    t.ended_at,
    t.round_id,
    (
      select rh.storage_path
      from public.round_highlights rh
      where rh.round_id = t.round_id and rh.user_id = f.friend_id
      order by rh.created_at desc
      limit 1
    )
  from friends f
  join public.round_player_totals t on t.user_id = f.friend_id
  join public.profiles p on p.id = f.friend_id
  left join public.courses c on c.id = t.course_id
  where t.round_status = 'completed'
    and t.holes_scored >= 1
  order by t.ended_at desc nulls last
  limit greatest(1, least(coalesce(p_limit, 15), 50));
end;
$$;

grant execute on function public.get_player_stats_summary(uuid) to authenticated;
grant execute on function public.refresh_player_badges(uuid) to authenticated;
grant execute on function public.list_player_badges(uuid) to authenticated;
grant execute on function public.check_in_course(uuid, text) to authenticated;
grant execute on function public.clear_course_checkin() to authenticated;
grant execute on function public.get_my_course_checkin() to authenticated;
grant execute on function public.list_playing_today(integer) to authenticated;
grant execute on function public.add_round_highlight(uuid, text, text) to authenticated;
grant execute on function public.delete_round_highlight(uuid) to authenticated;
grant execute on function public.list_round_highlights(uuid) to authenticated;
grant execute on function public.list_friend_activity(integer) to authenticated;
