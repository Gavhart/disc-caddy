-- Multi-select mandos and tree layouts per hole.
-- Self-contained: adds legacy single-value columns if an earlier migration was skipped.

alter table public.course_holes
  add column if not exists terrain text not null default 'flat'
    check (terrain in ('flat', 'rolling', 'hilly', 'mountainous'));

alter table public.course_holes
  add column if not exists tree_coverage text not null default 'open'
    check (tree_coverage in ('open', 'light', 'wooded', 'heavily_wooded'));

alter table public.course_holes
  add column if not exists tree_layout text not null default 'none'
    check (tree_layout in (
      'none', 'throughout', 'front_half', 'back_half', 'left', 'right', 'canopy'
    ));

alter table public.course_holes
  add column if not exists mando text not null default 'none'
    check (mando in ('none', 'left', 'right', 'double', 'triple'));

alter table public.course_holes
  add column if not exists mandos text[] not null default '{}',
  add column if not exists tree_layouts text[] not null default '{}';

alter table public.course_holes
  drop constraint if exists course_holes_mandos_check;

alter table public.course_holes
  add constraint course_holes_mandos_check
  check (
    mandos <@ array['left', 'right', 'double', 'triple']::text[]
  );

alter table public.course_holes
  drop constraint if exists course_holes_tree_layouts_check;

alter table public.course_holes
  add constraint course_holes_tree_layouts_check
  check (
    tree_layouts <@ array[
      'throughout', 'front_half', 'back_half', 'left', 'right', 'canopy'
    ]::text[]
  );

-- Backfill from legacy single-value columns when present and arrays are still empty.
update public.course_holes
set mandos = array[mando]
where coalesce(array_length(mandos, 1), 0) = 0
  and mando is not null
  and mando <> 'none';

update public.course_holes
set tree_layouts = array[tree_layout]
where coalesce(array_length(tree_layouts, 1), 0) = 0
  and tree_layout is not null
  and tree_layout <> 'none';

comment on column public.course_holes.mandos is
  'Mandatory routes (multi): left, right, double, triple — duplicates allowed.';

comment on column public.course_holes.tree_layouts is
  'Tree/obstacle positions (multi): throughout, front_half, back_half, left, right, canopy.';
