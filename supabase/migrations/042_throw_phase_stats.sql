-- Throw phase (drive / approach / putt) on logged throws for stats.

alter table public.round_throws
  add column if not exists throw_phase text
    check (throw_phase is null or throw_phase in ('drive', 'approach', 'putt'));

alter table public.round_throws
  add column if not exists remaining_before_ft integer
    check (remaining_before_ft is null or remaining_before_ft >= 0);

alter table public.round_throws
  add column if not exists throw_distance_ft integer
    check (throw_distance_ft is null or throw_distance_ft > 0);

comment on column public.round_throws.throw_phase is
  'Auto-classified from remaining distance before the throw.';

create or replace function public.get_throw_phase_stats()
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
      'totals', (
        select coalesce(jsonb_agg(row_to_json(t) order by t.throws desc), '[]'::jsonb)
        from (
          select
            rt.throw_phase,
            count(*)::int as throws,
            round(avg(rt.throw_distance_ft))::int as avg_distance_ft
          from public.round_throws rt
          join public.rounds r on r.id = rt.round_id and r.user_id = uid
          where rt.throw_phase is not null
          group by rt.throw_phase
        ) t
      ),
      'by_disc', (
        select coalesce(jsonb_agg(row_to_json(d) order by d.throws desc), '[]'::jsonb)
        from (
          select
            rt.disc_name,
            rt.throw_phase,
            count(*)::int as throws,
            round(avg(rt.throw_distance_ft))::int as avg_distance_ft
          from public.round_throws rt
          join public.rounds r on r.id = rt.round_id and r.user_id = uid
          where rt.throw_phase is not null and rt.throw_distance_ft is not null
          group by rt.disc_name, rt.throw_phase
          having count(*) >= 2
          order by count(*) desc
          limit 20
        ) d
      )
    )
  ), '{"totals":[],"by_disc":[]}'::jsonb);
end;
$$;

grant execute on function public.get_throw_phase_stats() to authenticated;
