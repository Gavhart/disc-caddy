-- Disc Caddy 014: home cities + opt-in community matching
--
-- Players set up to 3 home-area cities (often derived from a course's locality).
-- Community page shows other opt-in members who share at least one city key.

alter table public.profiles
  add column if not exists community_visible boolean not null default false;

comment on column public.profiles.community_visible is
  'When true, other opt-in members can see this player on the Community page if they share a home city.';

-- ---------- Home cities ----------

create table if not exists public.profile_home_cities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  city text not null,
  region_code text,
  country_code text,
  city_key text not null,
  course_id uuid references public.courses(id) on delete set null,
  sort_order integer not null check (sort_order >= 0 and sort_order <= 2),
  created_at timestamptz not null default now(),
  constraint profile_home_cities_city_nonempty check (length(trim(city)) > 0),
  unique (user_id, sort_order),
  unique (user_id, city_key)
);

create index if not exists profile_home_cities_user_id_idx
  on public.profile_home_cities (user_id);

create index if not exists profile_home_cities_city_key_idx
  on public.profile_home_cities (city_key);

alter table public.profile_home_cities enable row level security;

drop policy if exists "profile_home_cities_select_own" on public.profile_home_cities;
create policy "profile_home_cities_select_own" on public.profile_home_cities
  for select using (auth.uid() = user_id);

drop policy if exists "profile_home_cities_insert_own" on public.profile_home_cities;
create policy "profile_home_cities_insert_own" on public.profile_home_cities
  for insert with check (auth.uid() = user_id);

drop policy if exists "profile_home_cities_update_own" on public.profile_home_cities;
create policy "profile_home_cities_update_own" on public.profile_home_cities
  for update using (auth.uid() = user_id);

drop policy if exists "profile_home_cities_delete_own" on public.profile_home_cities;
create policy "profile_home_cities_delete_own" on public.profile_home_cities
  for delete using (auth.uid() = user_id);

-- ---------- Helpers ----------

create or replace function public.normalize_city_key(
  p_city text,
  p_region text default null,
  p_country text default null
)
returns text
language sql
immutable
as $$
  select lower(trim(p_city))
    || '|' || lower(trim(coalesce(p_region, '')))
    || '|' || lower(trim(coalesce(p_country, '')))
$$;

create or replace function public.format_city_label(
  p_city text,
  p_region text default null,
  p_country text default null
)
returns text
language sql
immutable
as $$
  select trim(p_city)
    || case when nullif(trim(coalesce(p_region, '')), '') is not null
      then ', ' || trim(p_region) else '' end
    || case when nullif(trim(coalesce(p_country, '')), '') is not null
      then ', ' || trim(p_country) else '' end
$$;

create or replace function public.set_profile_home_cities(
  p_cities jsonb,
  p_community_visible boolean default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  row jsonb;
  idx integer := 0;
  c_city text;
  c_region text;
  c_country text;
  c_course uuid;
  c_key text;
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  if p_cities is null or jsonb_typeof(p_cities) <> 'array' then
    raise exception 'p_cities must be a JSON array';
  end if;

  if jsonb_array_length(p_cities) > 3 then
    raise exception 'At most 3 home cities allowed';
  end if;

  if p_community_visible is not null then
    update public.profiles
    set community_visible = p_community_visible,
        updated_at = now()
    where id = uid;
  end if;

  delete from public.profile_home_cities where user_id = uid;

  for row in select * from jsonb_array_elements(p_cities)
  loop
    c_city := nullif(trim(row->>'city'), '');
    if c_city is null then
      continue;
    end if;
    c_region := nullif(trim(row->>'region_code'), '');
    c_country := nullif(trim(row->>'country_code'), '');
    c_course := nullif(trim(row->>'course_id'), '')::uuid;
    c_key := public.normalize_city_key(c_city, c_region, c_country);

    insert into public.profile_home_cities (
      user_id,
      city,
      region_code,
      country_code,
      city_key,
      course_id,
      sort_order
    )
    values (
      uid,
      c_city,
      c_region,
      c_country,
      c_key,
      c_course,
      idx
    );
    idx := idx + 1;
  end loop;
end;
$$;

grant execute on function public.set_profile_home_cities(jsonb, boolean) to authenticated;

create or replace function public.community_members_at_my_cities()
returns table (
  user_id uuid,
  display_name text,
  shared_city_labels text[]
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    return;
  end if;

  if not exists (
    select 1 from public.profiles p
    where p.id = uid and p.community_visible = true
  ) then
    return;
  end if;

  return query
  with my_keys as (
    select phc.city_key
    from public.profile_home_cities phc
    where phc.user_id = uid
  ),
  matched as (
    select
      p.id as member_id,
      coalesce(nullif(trim(p.display_name), ''), split_part(p.email, '@', 1)) as member_name,
      public.format_city_label(phc.city, phc.region_code, phc.country_code) as city_label
    from public.profiles p
    join public.profile_home_cities phc on phc.user_id = p.id
    where p.id <> uid
      and p.community_visible = true
      and coalesce(p.onboarding_complete, true) = true
      and phc.city_key in (select city_key from my_keys)
  )
  select
    m.member_id,
    max(m.member_name),
    array_agg(distinct m.city_label order by m.city_label)
  from matched m
  group by m.member_id
  order by max(m.member_name);
end;
$$;

grant execute on function public.community_members_at_my_cities() to authenticated;

-- ---------- me view ----------

drop view if exists public.me;
create view public.me
  with (security_invoker = true)
as
  select
    p.id,
    p.email,
    p.display_name,
    p.onboarding_complete,
    p.max_distance,
    coalesce(p.putter_max_distance,   (p.max_distance * 0.50)::integer) as putter_max_distance,
    coalesce(p.midrange_max_distance, (p.max_distance * 0.70)::integer) as midrange_max_distance,
    coalesce(p.fairway_max_distance,  (p.max_distance * 0.85)::integer) as fairway_max_distance,
    p.dominant_hand,
    p.throws_forehand,
    p.primary_throw,
    coalesce(p.forehand_max_distance, p.max_distance) as forehand_max_distance,
    p.subscription_tier,
    p.subscription_status,
    p.subscription_period_end,
    (p.subscription_tier = 'pro' and p.subscription_status in ('active','trialing'))
      as is_pro,
    p.community_visible
  from public.profiles p
  where p.id = auth.uid();
