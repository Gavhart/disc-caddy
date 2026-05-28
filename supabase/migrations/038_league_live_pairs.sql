-- Disc Caddy 038: league live pair indicator for standings UI

create or replace function public.list_league_live_pairs(p_league_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if not public.is_league_member(p_league_id) then raise exception 'Not a league member'; end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object('pair_id', lp.id, 'round_id', r.id))
    from public.league_pairs lp
    join public.rounds r
      on r.status = 'active'
      and (r.format_config ->> 'league_pair_id')::uuid = lp.id
      and (r.format_config ->> 'league_id')::uuid = p_league_id
    where lp.league_id = p_league_id
  ), '[]'::jsonb);
end;
$$;

grant execute on function public.list_league_live_pairs(uuid) to authenticated;
