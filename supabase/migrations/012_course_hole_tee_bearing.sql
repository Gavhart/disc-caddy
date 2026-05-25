-- Disc Caddy 012: per-hole tee facing (for live wind mapping)

alter table public.course_holes
  add column if not exists tee_bearing text not null default 'north'
    check (tee_bearing in (
      'north','northeast','east','southeast',
      'south','southwest','west','northwest'
    ));

comment on column public.course_holes.tee_bearing is
  'Compass direction the tee faces toward the basket (Open-Meteo wind mapping).';
