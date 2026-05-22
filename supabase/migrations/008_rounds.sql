-- Disc Caddy 008: live rounds + throw log (Pro round tracking)

create table if not exists public.rounds (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  course_id uuid references public.courses(id) on delete set null,
  bag_id uuid references public.bags(id) on delete set null,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  status text not null default 'active'
    check (status in ('active', 'completed')),
  created_at timestamptz not null default now()
);

create index if not exists rounds_user_id_idx on public.rounds (user_id);
create index if not exists rounds_course_id_idx on public.rounds (course_id);

create table if not exists public.round_throws (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references public.rounds(id) on delete cascade,
  hole_number integer not null check (hole_number > 0),
  bag_disc_id uuid references public.bag_discs(id) on delete set null,
  disc_name text not null,
  throw_style text not null check (throw_style in ('backhand', 'forehand')),
  recommended_rank integer,
  used_recommendation boolean not null default true,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists round_throws_round_id_idx on public.round_throws (round_id);

alter table public.rounds enable row level security;
alter table public.round_throws enable row level security;

create policy "rounds_all_own" on public.rounds
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "round_throws_all_own" on public.round_throws
  for all using (
    exists (
      select 1 from public.rounds r
      where r.id = round_throws.round_id and r.user_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from public.rounds r
      where r.id = round_throws.round_id and r.user_id = auth.uid()
    )
  );

grant select, insert, update, delete on public.rounds to authenticated;
grant select, insert, update, delete on public.round_throws to authenticated;
