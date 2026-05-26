-- Disc Caddy 028: League admin — edit settings and delete leagues

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
      select
        lg.id,
        lg.name,
        lg.season_start,
        lg.season_end,
        lg.format,
        lg.invite_code,
        lg.created_by,
        lm.role as my_role,
        (select count(*) from public.league_members lm2 where lm2.league_id = lg.id) as member_count
      from public.leagues lg
      join public.league_members lm on lm.league_id = lg.id and lm.user_id = auth.uid()
    ) l
  ), '[]'::jsonb);
end;
$$;

create or replace function public.update_league(
  p_league_id uuid,
  p_name text default null,
  p_season_start date default null,
  p_season_end date default null,
  p_format text default null
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
    format = coalesce(p_format, format)
  where id = p_league_id;
end;
$$;

create or replace function public.delete_league(p_league_id uuid)
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
    select 1 from public.league_members
    where league_id = p_league_id and user_id = uid and role = 'admin'
  ) then
    raise exception 'Only league admins can delete this league';
  end if;

  delete from public.leagues where id = p_league_id;

  if not found then raise exception 'League not found'; end if;
end;
$$;

grant execute on function public.update_league(uuid, text, date, date, text) to authenticated;
grant execute on function public.delete_league(uuid) to authenticated;
