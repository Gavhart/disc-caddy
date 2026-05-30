-- Caddy adherence: top pick vs what the player actually threw.

create or replace function public.get_caddy_adherence_stats()
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
    select jsonb_build_object(
      'total_throws', stats.total_throws,
      'top_pick_throws', stats.top_pick_throws,
      'off_script_throws', stats.off_script_throws,
      'off_script_discs', coalesce(off_discs.list, '[]'::jsonb),
      'by_phase', coalesce(phase_rows.list, '[]'::jsonb)
    )
    from (
      select
        count(*)::int as total_throws,
        count(*) filter (where rt.used_recommendation)::int as top_pick_throws,
        count(*) filter (where not rt.used_recommendation)::int as off_script_throws
      from public.round_throws rt
      join public.rounds r on r.id = rt.round_id and r.user_id = uid
    ) stats
    cross join lateral (
      select coalesce(jsonb_agg(row_to_json(d) order by d.throws desc), '[]'::jsonb) as list
      from (
        select rt.disc_name, count(*)::int as throws
        from public.round_throws rt
        join public.rounds r on r.id = rt.round_id and r.user_id = uid
        where not rt.used_recommendation
        group by rt.disc_name
        order by count(*) desc
        limit 12
      ) d
    ) off_discs
    cross join lateral (
      select coalesce(jsonb_agg(row_to_json(p)), '[]'::jsonb) as list
      from (
        select
          rt.throw_phase,
          count(*)::int as total,
          count(*) filter (where rt.used_recommendation)::int as top_pick_throws
        from public.round_throws rt
        join public.rounds r on r.id = rt.round_id and r.user_id = uid
        where rt.throw_phase is not null
        group by rt.throw_phase
      ) p
    ) phase_rows
  ), '{"total_throws":0,"top_pick_throws":0,"off_script_throws":0,"off_script_discs":[],"by_phase":[]}'::jsonb);
end;
$$;

grant execute on function public.get_caddy_adherence_stats() to authenticated;
