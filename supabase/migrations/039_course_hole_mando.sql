-- Mandatory route on a hole (left / right / double / triple).

alter table public.course_holes
  add column if not exists mando text not null default 'none'
    check (mando in ('none', 'left', 'right', 'double', 'triple'));

comment on column public.course_holes.mando is
  'Mandatory route relative to the line of play: none, left, right, double, or triple.';
