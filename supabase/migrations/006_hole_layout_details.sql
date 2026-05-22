-- Disc Caddy 006: richer hole-layout descriptors
--
-- Adds three columns to `course_holes` capturing the layout nuances players
-- actually use to pick a disc: how undulating the fairway is (terrain), how
-- thick the trees are (tree_coverage), and where the trees actually sit
-- relative to the line of play (tree_layout). All three are non-null with
-- explicit "no data" defaults so existing rows stay valid without backfill.

alter table public.course_holes
  add column if not exists terrain text not null default 'flat'
    check (terrain in ('flat','rolling','hilly','mountainous'));

alter table public.course_holes
  add column if not exists tree_coverage text not null default 'open'
    check (tree_coverage in ('open','light','wooded','heavily_wooded'));

-- tree_layout is meaningful only when tree_coverage != 'open'. We allow any
-- value at the DB layer (the UI is the gatekeeper); the 'none' default
-- represents "either open fairway, or trees scattered/unspecified".
alter table public.course_holes
  add column if not exists tree_layout text not null default 'none'
    check (tree_layout in (
      'none','throughout','front_half','back_half','left','right','canopy'
    ));
