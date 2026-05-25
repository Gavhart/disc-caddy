-- Disc Caddy 013: scorecard, group rounds, course/hole leaderboards

-- ---------- Tables first (functions below reference these) ----------

create table if not exists public.round_players (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references public.rounds(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  display_name text not null,
  is_host boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  constraint round_players_name_nonempty check (length(trim(display_name)) > 0)
);

create index if not exists round_players_round_id_idx on public.round_players (round_id);
create index if not exists round_players_user_id_idx on public.round_players (user_id);

create unique index if not exists round_players_round_user_uidx
  on public.round_players (round_id, user_id)
  where user_id is not null;

create table if not exists public.round_scores (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references public.rounds(id) on delete cascade,
  round_player_id uuid not null references public.round_players(id) on delete cascade,
  hole_number integer not null check (hole_number > 0),
  strokes integer not null check (strokes >= 1 and strokes <= 20),
  putts integer check (putts is null or (putts >= 0 and putts <= strokes)),
  par integer check (par is null or (par >= 2 and par <= 6)),
  updated_at timestamptz not null default now(),
  unique (round_player_id, hole_number)
);

create index if not exists round_scores_round_id_idx on public.round_scores (round_id);
create index if not exists round_scores_player_hole_idx
  on public.round_scores (round_player_id, hole_number);

-- ---------- Helpers (after tables exist) ----------

create or replace function public.is_round_host(p_round_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.rounds r
    where r.id = p_round_id and r.user_id = auth.uid()
  );
$$;

create or replace function public.is_round_participant(p_round_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_round_host(p_round_id)
    or exists (
      select 1 from public.round_players rp
      where rp.round_id = p_round_id and rp.user_id = auth.uid()
    );
$$;

create or replace function public.search_players(p_query text)
returns table (
  user_id uuid,
  display_name text,
  email text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  q text := lower(trim(p_query));
begin
  if length(q) < 2 then
    return;
  end if;

  return query
  select
    p.id,
    coalesce(nullif(trim(p.display_name), ''), split_part(p.email, '@', 1)),
    p.email
  from public.profiles p
  where p.id <> auth.uid()
    and p.onboarding_complete = true
    and (
      lower(p.email) = q
      or lower(coalesce(p.display_name, '')) like q || '%'
    )
  order by p.display_name nulls last, p.email
  limit 8;
end;
$$;

grant execute on function public.search_players(text) to authenticated;

-- ---------- RLS: broaden round access to participants ----------

drop policy if exists "rounds_all_own" on public.rounds;
drop policy if exists "rounds_select_participant" on public.rounds;
drop policy if exists "rounds_insert_host" on public.rounds;
drop policy if exists "rounds_update_host" on public.rounds;
drop policy if exists "rounds_delete_host" on public.rounds;

create policy "rounds_select_participant" on public.rounds
  for select using (public.is_round_participant(id));

create policy "rounds_insert_host" on public.rounds
  for insert with check (auth.uid() = user_id);

create policy "rounds_update_host" on public.rounds
  for update using (public.is_round_host(id));

create policy "rounds_delete_host" on public.rounds
  for delete using (public.is_round_host(id));

drop policy if exists "round_throws_all_own" on public.round_throws;
drop policy if exists "round_throws_select_participant" on public.round_throws;
drop policy if exists "round_throws_insert_host" on public.round_throws;
drop policy if exists "round_throws_update_host" on public.round_throws;
drop policy if exists "round_throws_delete_host" on public.round_throws;

create policy "round_throws_select_participant" on public.round_throws
  for select using (public.is_round_participant(round_id));

create policy "round_throws_insert_host" on public.round_throws
  for insert with check (public.is_round_host(round_id));

create policy "round_throws_update_host" on public.round_throws
  for update using (public.is_round_host(round_id));

create policy "round_throws_delete_host" on public.round_throws
  for delete using (public.is_round_host(round_id));

alter table public.round_players enable row level security;
alter table public.round_scores enable row level security;

drop policy if exists "round_players_select_participant" on public.round_players;
drop policy if exists "round_players_insert_host" on public.round_players;
drop policy if exists "round_players_update_host" on public.round_players;
drop policy if exists "round_players_delete_host" on public.round_players;

create policy "round_players_select_participant" on public.round_players
  for select using (public.is_round_participant(round_id));

create policy "round_players_insert_host" on public.round_players
  for insert with check (public.is_round_host(round_id));

create policy "round_players_update_host" on public.round_players
  for update using (public.is_round_host(round_id));

create policy "round_players_delete_host" on public.round_players
  for delete using (public.is_round_host(round_id));

drop policy if exists "round_scores_select_participant" on public.round_scores;
drop policy if exists "round_scores_insert_participant" on public.round_scores;
drop policy if exists "round_scores_update_participant" on public.round_scores;
drop policy if exists "round_scores_delete_host" on public.round_scores;

create policy "round_scores_select_participant" on public.round_scores
  for select using (public.is_round_participant(round_id));

create policy "round_scores_insert_participant" on public.round_scores
  for insert with check (
    public.is_round_participant(round_id)
    and (
      public.is_round_host(round_id)
      or exists (
        select 1 from public.round_players rp
        where rp.id = round_player_id and rp.user_id = auth.uid()
      )
    )
  );

create policy "round_scores_update_participant" on public.round_scores
  for update using (
    public.is_round_participant(round_id)
    and (
      public.is_round_host(round_id)
      or exists (
        select 1 from public.round_players rp
        where rp.id = round_player_id and rp.user_id = auth.uid()
      )
    )
  );

create policy "round_scores_delete_host" on public.round_scores
  for delete using (public.is_round_host(round_id));

grant select, insert, update, delete on public.round_players to authenticated;
grant select, insert, update, delete on public.round_scores to authenticated;

-- ---------- Leaderboard views ----------

create or replace view public.round_player_totals
  with (security_invoker = true)
as
select
  rp.id as round_player_id,
  rp.round_id,
  rp.user_id,
  rp.display_name,
  rp.is_host,
  r.course_id,
  r.status as round_status,
  r.started_at,
  r.ended_at,
  count(rs.hole_number)::integer as holes_scored,
  coalesce(sum(rs.strokes), 0)::integer as total_strokes,
  coalesce(sum(rs.par), 0)::integer as total_par,
  coalesce(sum(rs.strokes), 0) - coalesce(sum(rs.par), 0) as score_to_par
from public.round_players rp
join public.rounds r on r.id = rp.round_id
left join public.round_scores rs on rs.round_player_id = rp.id
group by
  rp.id, rp.round_id, rp.user_id, rp.display_name, rp.is_host,
  r.course_id, r.status, r.started_at, r.ended_at;

create or replace view public.course_leaderboard
  with (security_invoker = true)
as
select
  rpt.course_id,
  rpt.round_player_id,
  rpt.round_id,
  rpt.user_id,
  rpt.display_name,
  rpt.total_strokes,
  rpt.total_par,
  rpt.score_to_par,
  rpt.holes_scored,
  rpt.ended_at as played_at,
  rank() over (
    partition by rpt.course_id
    order by rpt.total_strokes asc, rpt.ended_at desc
  ) as course_rank
from public.round_player_totals rpt
where rpt.round_status = 'completed'
  and rpt.course_id is not null
  and rpt.holes_scored >= 9;

create or replace view public.hole_leaderboard
  with (security_invoker = true)
as
select
  r.course_id,
  rs.hole_number,
  rp.id as round_player_id,
  rp.round_id,
  rp.user_id,
  rp.display_name,
  rs.strokes,
  rs.par,
  rs.strokes - coalesce(rs.par, 0) as score_to_par,
  r.ended_at as played_at,
  rank() over (
    partition by r.course_id, rs.hole_number
    order by rs.strokes asc, r.ended_at desc
  ) as hole_rank
from public.round_scores rs
join public.round_players rp on rp.id = rs.round_player_id
join public.rounds r on r.id = rs.round_id
where r.status = 'completed'
  and r.course_id is not null;

grant select on public.round_player_totals to authenticated;
grant select on public.course_leaderboard to authenticated;
grant select on public.hole_leaderboard to authenticated;
