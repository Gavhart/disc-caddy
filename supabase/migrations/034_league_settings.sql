-- Disc Caddy 034: League settings — play mode, handicap flag, min rounds, Stableford standings

alter table public.leagues
  add column if not exists play_mode text not null default 'singles',
  add column if not exists handicap_enabled boolean not null default false,
  add column if not exists min_rounds smallint not null default 0;

alter table public.leagues
  drop constraint if exists leagues_play_mode_check;

alter table public.leagues
  add constraint leagues_play_mode_check
  check (play_mode in ('singles', 'doubles'));

alter table public.leagues
  drop constraint if exists leagues_min_rounds_check;

alter table public.leagues
  add constraint leagues_min_rounds_check
  check (min_rounds >= 0 and min_rounds <= 50);

create or replace function public.create_league(
  p_name text,
  p_season_start date,
  p_season_end date,
  p_format text default 'stroke',
  p_description text default null,
  p_location text default null,
  p_rules text default null,
  p_play_mode text default 'singles',
  p_handicap_enabled boolean default false,
  p_min_rounds smallint default 0
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
  if p_season_end < p_season_start then
    raise exception 'Season end must be on or after season start';
  end if;
  if p_format is not null and p_format not in ('stroke', 'stableford') then
    raise exception 'Invalid league format';
  end if;
  if p_play_mode is not null and p_play_mode not in ('singles', 'doubles') then
    raise exception 'Invalid play mode';
  end if;
  if coalesce(p_min_rounds, 0) < 0 or coalesce(p_min_rounds, 0) > 50 then
    raise exception 'Min rounds must be between 0 and 50';
  end if;

  insert into public.leagues (
    name,
    created_by,
    season_start,
    season_end,
    format,
    description,
    location,
    rules,
    play_mode,
    handicap_enabled,
    min_rounds
  )
  values (
    trim(p_name),
    uid,
    p_season_start,
    p_season_end,
    coalesce(p_format, 'stroke'),
    nullif(trim(p_description), ''),
    nullif(trim(p_location), ''),
    nullif(trim(p_rules), ''),
    coalesce(p_play_mode, 'singles'),
    coalesce(p_handicap_enabled, false),
    coalesce(p_min_rounds, 0)
  )
  returning id, invite_code into lid, code;

  insert into public.league_members (league_id, user_id, role) values (lid, uid, 'admin');
  return jsonb_build_object('id', lid, 'invite_code', code);
end;
$$;

create or replace function public.update_league(
  p_league_id uuid,
  p_name text default null,
  p_season_start date default null,
  p_season_end date default null,
  p_format text default null,
  p_description text default null,
  p_location text default null,
  p_rules text default null,
  p_update_info boolean default false,
  p_play_mode text default null,
  p_handicap_enabled boolean default null,
  p_min_rounds smallint default null,
  p_update_settings boolean default false
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  cur record;
  new_start date;
  new_end date;
begin
  if uid is null then raise exception 'Not authenticated'; end if;

  if not exists (
    select 1 from public.league_members
    where league_id = p_league_id and user_id = uid and role = 'admin'
  ) then
    raise exception 'Only league admins can edit this league';
  end if;

  select * into cur from public.leagues where id = p_league_id;
  if cur.id is null then raise exception 'League not found'; end if;

  new_start := coalesce(p_season_start, cur.season_start);
  new_end := coalesce(p_season_end, cur.season_end);
  if new_end < new_start then
    raise exception 'Season end must be on or after season start';
  end if;

  if p_name is not null and length(trim(p_name)) = 0 then
    raise exception 'League name cannot be empty';
  end if;

  if p_format is not null and p_format not in ('stroke', 'stableford') then
    raise exception 'Invalid league format';
  end if;

  if p_play_mode is not null and p_play_mode not in ('singles', 'doubles') then
    raise exception 'Invalid play mode';
  end if;

  if p_min_rounds is not null and (p_min_rounds < 0 or p_min_rounds > 50) then
    raise exception 'Min rounds must be between 0 and 50';
  end if;

  update public.leagues
  set
    name = coalesce(nullif(trim(p_name), ''), name),
    season_start = new_start,
    season_end = new_end,
    format = coalesce(p_format, format),
    description = case
      when p_update_info then nullif(trim(p_description), '')
      else description
    end,
    location = case
      when p_update_info then nullif(trim(p_location), '')
      else location
    end,
    rules = case
      when p_update_info then nullif(trim(p_rules), '')
      else rules
    end,
    play_mode = case
      when p_update_settings then coalesce(p_play_mode, play_mode)
      else play_mode
    end,
    handicap_enabled = case
      when p_update_settings then coalesce(p_handicap_enabled, handicap_enabled)
      else handicap_enabled
    end,
    min_rounds = case
      when p_update_settings then coalesce(p_min_rounds, min_rounds)
      else min_rounds
    end
  where id = p_league_id;
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
    select jsonb_agg(row_to_json(l) order by l.season_end desc, l.name)
    from (
      select
        lg.id,
        lg.name,
        lg.season_start,
        lg.season_end,
        lg.format,
        lg.invite_code,
        lg.created_by,
        lg.created_at,
        lg.description,
        lg.location,
        lg.rules,
        lg.play_mode,
        lg.handicap_enabled,
        lg.min_rounds,
        lm.role as my_role,
        coalesce(
          nullif(trim(creator.display_name), ''),
          split_part(creator.email, '@', 1)
        ) as creator_name,
        (select count(*) from public.league_members lm2 where lm2.league_id = lg.id) as member_count,
        (select count(*) from public.league_round_submissions lrs where lrs.league_id = lg.id)
          as rounds_submitted,
        (select count(distinct lrs.submitted_by)
         from public.league_round_submissions lrs
         where lrs.league_id = lg.id) as players_with_rounds,
        (select count(*)
         from public.league_round_submissions lrs
         where lrs.league_id = lg.id and lrs.submitted_by = auth.uid()) as my_rounds_submitted,
        (
          select coalesce(nullif(trim(p.display_name), ''), split_part(p.email, '@', 1))
          from (
            select
              lrs.submitted_by,
              case
                when lg.format = 'stableford' then
                  -1 * avg(
                    coalesce((
                      select sum(public.stableford_points(rs.strokes, rs.par))
                      from public.round_scores rs
                      join public.round_players rp on rp.id = rs.round_player_id
                      where rs.round_id = lrs.round_id and rp.user_id = lrs.submitted_by
                    ), 0)
                  )
                else avg(pt.score_to_par)
              end as rank_score
            from public.league_round_submissions lrs
            join public.round_player_totals pt
              on pt.round_id = lrs.round_id and pt.user_id = lrs.submitted_by
            where lrs.league_id = lg.id
            group by lrs.submitted_by
            order by rank_score nulls last
            limit 1
          ) lead
          join public.profiles p on p.id = lead.submitted_by
        ) as leader_name
      from public.leagues lg
      join public.league_members lm on lm.league_id = lg.id and lm.user_id = auth.uid()
      join public.profiles creator on creator.id = lg.created_by
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
declare
  fmt text;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if not exists (
    select 1 from public.league_members where league_id = p_league_id and user_id = auth.uid()
  ) then
    raise exception 'Not a league member';
  end if;

  select format into fmt from public.leagues where id = p_league_id;

  if fmt = 'stableford' then
    return coalesce((
      select jsonb_agg(row_to_json(s) order by s.rank)
      from (
        select
          lm.user_id,
          coalesce(nullif(trim(p.display_name), ''), split_part(p.email, '@', 1)) as display_name,
          count(lrs.id) as rounds_submitted,
          round(avg(sf.sf_points), 1) as avg_stableford_points,
          max(sf.sf_points) as best_stableford_points,
          null::numeric as avg_score_to_par,
          null::integer as best_score_to_par,
          row_number() over (
            order by avg(sf.sf_points) desc nulls last, max(sf.sf_points) desc nulls last
          ) as rank
        from public.league_members lm
        join public.profiles p on p.id = lm.user_id
        left join public.league_round_submissions lrs
          on lrs.league_id = lm.league_id and lrs.submitted_by = lm.user_id
        left join lateral (
          select coalesce(sum(public.stableford_points(rs.strokes, rs.par)), 0) as sf_points
          from public.round_scores rs
          join public.round_players rp on rp.id = rs.round_player_id
          where rs.round_id = lrs.round_id and rp.user_id = lm.user_id
        ) sf on lrs.id is not null
        where lm.league_id = p_league_id
        group by lm.user_id, p.display_name, p.email
      ) s
    ), '[]'::jsonb);
  end if;

  return coalesce((
    select jsonb_agg(row_to_json(s) order by s.rank)
    from (
      select
        lm.user_id,
        coalesce(nullif(trim(p.display_name), ''), split_part(p.email, '@', 1)) as display_name,
        count(lrs.id) as rounds_submitted,
        null::numeric as avg_stableford_points,
        null::numeric as best_stableford_points,
        round(avg(pt.score_to_par), 1) as avg_score_to_par,
        min(pt.score_to_par) as best_score_to_par,
        row_number() over (order by avg(pt.score_to_par) nulls last, min(pt.score_to_par)) as rank
      from public.league_members lm
      join public.profiles p on p.id = lm.user_id
      left join public.league_round_submissions lrs
        on lrs.league_id = lm.league_id and lrs.submitted_by = lm.user_id
      left join public.round_player_totals pt
        on pt.round_id = lrs.round_id and pt.user_id = lm.user_id
      where lm.league_id = p_league_id
      group by lm.user_id, p.display_name, p.email
    ) s
  ), '[]'::jsonb);
end;
$$;

grant execute on function public.create_league(text, date, date, text, text, text, text, text, boolean, smallint) to authenticated;
grant execute on function public.update_league(uuid, text, date, date, text, text, text, text, boolean, text, boolean, smallint, boolean) to authenticated;
