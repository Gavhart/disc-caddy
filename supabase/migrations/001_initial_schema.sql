-- Disc Caddy initial schema
-- Run this in Supabase Dashboard → SQL Editor → New Query → paste → Run

-- ---------- Profiles ----------
-- One row per authenticated user. Holds player settings + subscription state.
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  max_distance integer not null default 280,
  stripe_customer_id text unique,
  subscription_status text not null default 'free',
  subscription_tier text not null default 'free',
  subscription_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on column public.profiles.subscription_status is
  '"free" | "active" | "canceled" | "past_due" | "trialing"';
comment on column public.profiles.subscription_tier is '"free" | "pro"';

-- Auto-create a profile row whenever a new auth user is created.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- Bags ----------
create table public.bags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index bags_user_id_idx on public.bags (user_id);

-- ---------- Bag discs ----------
create table public.bag_discs (
  id uuid primary key default gen_random_uuid(),
  bag_id uuid not null references public.bags(id) on delete cascade,
  disc_name text not null,
  plastic text not null,
  weight text not null,
  wear text not null,
  photo_path text,                      -- storage object path, nullable
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create index bag_discs_bag_id_idx on public.bag_discs (bag_id);

-- ---------- Row Level Security ----------
alter table public.profiles  enable row level security;
alter table public.bags      enable row level security;
alter table public.bag_discs enable row level security;

-- Profiles: a user can read + update their own profile only.
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id);

-- Bags: a user can do everything to their own bags.
create policy "bags_all_own" on public.bags
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Bag discs: a user can do everything to discs in their own bags.
create policy "bag_discs_all_own" on public.bag_discs
  for all using (
    exists (select 1 from public.bags
             where bags.id = bag_discs.bag_id
               and bags.user_id = auth.uid())
  ) with check (
    exists (select 1 from public.bags
             where bags.id = bag_discs.bag_id
               and bags.user_id = auth.uid())
  );

-- ---------- Storage bucket for disc photos ----------
-- Run this AFTER creating the bucket named 'disc-photos' in the Supabase Dashboard
-- (Storage → New bucket → name: disc-photos, public: false).

-- Users can upload to their own folder (path begins with their user id):
create policy "disc_photos_insert_own"
  on storage.objects for insert
  with check (
    bucket_id = 'disc-photos'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "disc_photos_select_own"
  on storage.objects for select
  using (
    bucket_id = 'disc-photos'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "disc_photos_delete_own"
  on storage.objects for delete
  using (
    bucket_id = 'disc-photos'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- ---------- Helpful view ----------
-- Quick "is this user pro?" check used by the client.
create or replace view public.me as
  select
    p.id,
    p.email,
    p.max_distance,
    p.subscription_tier,
    p.subscription_status,
    p.subscription_period_end,
    (p.subscription_tier = 'pro' and p.subscription_status in ('active','trialing'))
      as is_pro
  from public.profiles p
  where p.id = auth.uid();
