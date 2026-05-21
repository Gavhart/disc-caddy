-- Disc Caddy 003: courses + per-hole data + player handedness
-- Run this in Supabase Dashboard → SQL Editor after 001 + 002.
-- Safe to re-run: every block is idempotent.

-- ---------- Profile additions ----------
alter table public.profiles
  add column if not exists dominant_hand text not null default 'right'
    check (dominant_hand in ('left','right'));

alter table public.profiles
  add column if not exists throws_forehand boolean not null default false;

-- Nullable: defaults to max_distance at read time when null.
alter table public.profiles
  add column if not exists forehand_max_distance integer;

-- ---------- Courses (shared catalog, same RLS model as discs) ----------
create table if not exists public.courses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  locality text,
  region_code text,
  country_code text,
  lat numeric,
  lon numeric,
  source text not null default 'user'
    check (source in ('user','discgolfapi')),
  source_id text,                                    -- public id from DiscGolfAPI when source='discgolfapi'
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists courses_name_idx on public.courses (lower(name));
create index if not exists courses_source_id_idx on public.courses (source, source_id);

-- ---------- Course holes ----------
create table if not exists public.course_holes (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  number integer not null check (number > 0),
  distance integer not null check (distance > 0),    -- feet
  par integer check (par between 2 and 6),
  direction text not null default 'straight'
    check (direction in ('hard_left','dogleg_left','straight','dogleg_right','hard_right')),
  elevation text not null default 'flat'
    check (elevation in ('uphill','flat','downhill')),
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (course_id, number)
);

create index if not exists course_holes_course_id_idx on public.course_holes (course_id);

-- ---------- RLS ----------
alter table public.courses      enable row level security;
alter table public.course_holes enable row level security;

-- Public read on both tables (reference data).
drop policy if exists "courses_select_all" on public.courses;
create policy "courses_select_all" on public.courses for select using (true);

drop policy if exists "course_holes_select_all" on public.course_holes;
create policy "course_holes_select_all" on public.course_holes for select using (true);

-- Any authenticated user can insert; row must be theirs.
drop policy if exists "courses_insert_authenticated" on public.courses;
create policy "courses_insert_authenticated" on public.courses
  for insert to authenticated
  with check (auth.uid() = created_by);

drop policy if exists "course_holes_insert_authenticated" on public.course_holes;
create policy "course_holes_insert_authenticated" on public.course_holes
  for insert to authenticated
  with check (auth.uid() = created_by);

-- Owner-only edit/delete so users can self-correct without trashing others' data.
drop policy if exists "courses_update_own" on public.courses;
create policy "courses_update_own" on public.courses
  for update to authenticated
  using (auth.uid() = created_by)
  with check (auth.uid() = created_by);

drop policy if exists "courses_delete_own" on public.courses;
create policy "courses_delete_own" on public.courses
  for delete to authenticated
  using (auth.uid() = created_by);

drop policy if exists "course_holes_update_own" on public.course_holes;
create policy "course_holes_update_own" on public.course_holes
  for update to authenticated
  using (auth.uid() = created_by)
  with check (auth.uid() = created_by);

drop policy if exists "course_holes_delete_own" on public.course_holes;
create policy "course_holes_delete_own" on public.course_holes
  for delete to authenticated
  using (auth.uid() = created_by);

-- ---------- Refresh me view to expose new player fields ----------
-- Postgres's CREATE OR REPLACE VIEW can only *append* columns. Since we're
-- inserting handedness columns mid-row, drop + recreate explicitly.
drop view if exists public.me;
create view public.me as
  select
    p.id,
    p.email,
    p.max_distance,
    p.dominant_hand,
    p.throws_forehand,
    coalesce(p.forehand_max_distance, p.max_distance) as forehand_max_distance,
    p.subscription_tier,
    p.subscription_status,
    p.subscription_period_end,
    (p.subscription_tier = 'pro' and p.subscription_status in ('active','trialing'))
      as is_pro
  from public.profiles p
  where p.id = auth.uid();
