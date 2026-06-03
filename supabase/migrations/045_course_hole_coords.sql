-- 045_course_hole_coords.sql
-- Adds per-hole tee and basket GPS coordinates so we can render a real
-- satellite map of each hole (à la UDisc) instead of just a schematic.
--
-- Coordinates are nullable: most existing holes won't have them yet, and the
-- UI falls back to the SVG schematic when missing.

alter table public.course_holes
  add column if not exists tee_lat double precision,
  add column if not exists tee_lng double precision,
  add column if not exists basket_lat double precision,
  add column if not exists basket_lng double precision;

-- Validity bounds (very loose — just catches obvious garbage)
alter table public.course_holes
  drop constraint if exists course_holes_tee_lat_range;
alter table public.course_holes
  add constraint course_holes_tee_lat_range
  check (tee_lat is null or (tee_lat between -90 and 90));

alter table public.course_holes
  drop constraint if exists course_holes_tee_lng_range;
alter table public.course_holes
  add constraint course_holes_tee_lng_range
  check (tee_lng is null or (tee_lng between -180 and 180));

alter table public.course_holes
  drop constraint if exists course_holes_basket_lat_range;
alter table public.course_holes
  add constraint course_holes_basket_lat_range
  check (basket_lat is null or (basket_lat between -90 and 90));

alter table public.course_holes
  drop constraint if exists course_holes_basket_lng_range;
alter table public.course_holes
  add constraint course_holes_basket_lng_range
  check (basket_lng is null or (basket_lng between -180 and 180));

-- Spatial-ish index for "give me all holes for this course with coords"
create index if not exists course_holes_tee_coords_idx
  on public.course_holes (course_id)
  where tee_lat is not null and tee_lng is not null;
