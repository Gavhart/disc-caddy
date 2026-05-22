-- Disc Caddy 005: course completion stats
--
-- Adds a `total_holes` column so we know how many holes a course is
-- *supposed* to have (filled from DiscGolfAPI on import; user-provided for
-- manually-created courses). Also exposes a `course_summaries` view that
-- aggregates hole counts and distance stats so the UI can render a "filled /
-- expected" badge without N+1 queries.

alter table public.courses
  add column if not exists total_holes integer
    check (total_holes is null or total_holes > 0);

-- ---------- Course summary view ----------
-- One row per course: hole-fill count plus distance totals/averages over the
-- holes that *have* been entered. NULL distance_avg_ft means no holes filled.
drop view if exists public.course_summaries;
create view public.course_summaries as
  select
    c.id                                                     as course_id,
    c.total_holes                                            as total_holes,
    count(h.id)::integer                                     as holes_filled,
    coalesce(sum(h.distance), 0)::integer                    as distance_total_ft,
    case when count(h.id) > 0
      then round(avg(h.distance))::integer
      else null
    end                                                      as distance_avg_ft
  from public.courses c
  left join public.course_holes h on h.course_id = c.id
  group by c.id, c.total_holes;

-- The view runs as its owner, which bypasses RLS on the underlying tables.
-- That's fine here: courses and course_holes both have public SELECT RLS, so
-- the view is exposing data that's already publicly readable.
grant select on public.course_summaries to anon, authenticated;
