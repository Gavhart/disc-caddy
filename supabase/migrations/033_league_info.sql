-- Disc Caddy 033: Richer league profile — description, location, rules

alter table public.leagues
  add column if not exists description text,
  add column if not exists location text,
  add column if not exists rules text;

alter table public.leagues
  drop constraint if exists leagues_description_len;

alter table public.leagues
  add constraint leagues_description_len
  check (description is null or char_length(description) <= 2000);

alter table public.leagues
  drop constraint if exists leagues_location_len;

alter table public.leagues
  add constraint leagues_location_len
  check (location is null or char_length(location) <= 200);

alter table public.leagues
  drop constraint if exists leagues_rules_len;

alter table public.leagues
  add constraint leagues_rules_len
  check (rules is null or char_length(rules) <= 2000);

create or replace function public.create_league(
  p_name text,
  p_season_start date,
  p_season_end date,
  p_format text default 'stroke',
  p_description text default null,
  p_location text default null,
  p_rules text default null
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

  insert into public.leagues (
    name,
    created_by,
    season_start,
    season_end,
    format,
    description,
    location,
    rules
  )
  values (
    trim(p_name),
    uid,
    p_season_start,
    p_season_end,
    coalesce(p_format, 'stroke'),
    nullif(trim(p_description), ''),
    nullif(trim(p_location), ''),
    nullif(trim(p_rules), '')
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
  p_update_info boolean default false
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
              round(avg(pt.score_to_par), 1) as avg_score_to_par
            from public.league_round_submissions lrs
            join public.round_player_totals pt
              on pt.round_id = lrs.round_id and pt.user_id = lrs.submitted_by
            where lrs.league_id = lg.id
            group by lrs.submitted_by
            order by avg(pt.score_to_par) nulls last
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

grant execute on function public.create_league(text, date, date, text, text, text, text) to authenticated;
grant execute on function public.update_league(uuid, text, date, date, text, text, text, text, boolean) to authenticated;
