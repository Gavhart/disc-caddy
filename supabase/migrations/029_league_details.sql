-- Disc Caddy 029: Richer league list data for the Leagues page

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
        lm.role as my_role,
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
    ) l
  ), '[]'::jsonb);
end;
$$;
