-- Disc Caddy 018: community search radius + GPS coordinates on home areas

alter table public.profile_home_cities
  add column if not exists latitude double precision,
  add column if not exists longitude double precision;

alter table public.profiles
  add column if not exists community_search_radius_miles integer not null default 25;

alter table public.profiles
  drop constraint if exists profiles_community_search_radius_miles_check;

alter table public.profiles
  add constraint profiles_community_search_radius_miles_check
  check (community_search_radius_miles between 5 and 200);

comment on column public.profiles.community_search_radius_miles is
  'How far (miles) to search for other community members from saved home-area coordinates.';

comment on column public.profile_home_cities.latitude is
  'Optional anchor latitude for radius matching (from GPS or geocoding).';

comment on column public.profile_home_cities.longitude is
  'Optional anchor longitude for radius matching (from GPS or geocoding).';

create or replace function public.haversine_miles(
  lat1 double precision,
  lon1 double precision,
  lat2 double precision,
  lon2 double precision
)
returns double precision
language sql
immutable
as $$
  select case
    when lat1 is null or lon1 is null or lat2 is null or lon2 is null then null
    else 3958.7613 * 2 * asin(sqrt(
      power(sin(radians(lat2 - lat1) / 2), 2)
      + cos(radians(lat1)) * cos(radians(lat2))
      * power(sin(radians(lon2 - lon1) / 2), 2)
    ))
  end;
$$;

create or replace function public.home_cities_overlap(p_user_a uuid, p_user_b uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profile_home_cities a
    join public.profile_home_cities b
      on b.user_id = p_user_b
    cross join public.profiles pa
    cross join public.profiles pb
    where a.user_id = p_user_a
      and pa.id = p_user_a
      and pb.id = p_user_b
      and (
        b.city_key = a.city_key
        or (
          lower(trim(b.city)) = lower(trim(a.city))
          and lower(trim(coalesce(b.country_code, '')))
            = lower(trim(coalesce(a.country_code, '')))
        )
        or (
          a.latitude is not null
          and a.longitude is not null
          and b.latitude is not null
          and b.longitude is not null
          and public.haversine_miles(a.latitude, a.longitude, b.latitude, b.longitude)
            <= pa.community_search_radius_miles
          and public.haversine_miles(a.latitude, a.longitude, b.latitude, b.longitude)
            <= pb.community_search_radius_miles
        )
      )
  );
$$;

drop function if exists public.set_profile_home_cities(jsonb, boolean, boolean);

create or replace function public.set_profile_home_cities(
  p_cities jsonb,
  p_community_visible boolean default null,
  p_looking_for_players boolean default null,
  p_search_radius_miles integer default null
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
  c_lat double precision;
  c_lon double precision;
  c_key text;
  vis boolean;
  radius integer;
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

  if p_search_radius_miles is not null then
    radius := p_search_radius_miles;
    if radius < 5 or radius > 200 then
      raise exception 'Search radius must be between 5 and 200 miles';
    end if;
  end if;

  vis := p_community_visible;
  if vis is not null or p_looking_for_players is not null or radius is not null then
    update public.profiles
    set
      community_visible = coalesce(vis, community_visible),
      looking_for_players = case
        when coalesce(vis, community_visible) = false then false
        else coalesce(p_looking_for_players, looking_for_players)
      end,
      community_search_radius_miles = coalesce(radius, community_search_radius_miles),
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
    c_lat := nullif(trim(row->>'latitude'), '')::double precision;
    c_lon := nullif(trim(row->>'longitude'), '')::double precision;
    c_key := public.normalize_city_key(c_city, c_region, c_country);

    insert into public.profile_home_cities (
      user_id,
      city,
      region_code,
      country_code,
      city_key,
      course_id,
      sort_order,
      latitude,
      longitude
    )
    values (uid, c_city, c_region, c_country, c_key, c_course, idx, c_lat, c_lon);
    idx := idx + 1;
  end loop;
end;
$$;

grant execute on function public.set_profile_home_cities(jsonb, boolean, boolean, integer) to authenticated;

drop function if exists public.community_members_at_my_cities();

create or replace function public.community_members_at_my_cities()
returns table (
  user_id uuid,
  display_name text,
  shared_city_labels text[],
  looking_for_players boolean,
  distance_miles numeric
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  my_radius integer;
begin
  if uid is null then
    return;
  end if;

  select p.community_search_radius_miles
  into my_radius
  from public.profiles p
  where p.id = uid and p.community_visible = true;

  if my_radius is null then
    return;
  end if;

  if not exists (
    select 1 from public.profile_home_cities phc where phc.user_id = uid
  ) then
    return;
  end if;

  return query
  with my_cities as (
    select
      phc.city,
      phc.region_code,
      phc.country_code,
      phc.city_key,
      phc.latitude,
      phc.longitude
    from public.profile_home_cities phc
    where phc.user_id = uid
  ),
  candidate_matches as (
    select
      p.id as member_id,
      coalesce(nullif(trim(p.display_name), ''), split_part(p.email, '@', 1)) as member_name,
      p.looking_for_players as member_looking,
      public.format_city_label(phc.city, phc.region_code, phc.country_code) as city_label,
      mc.city_key as my_city_key,
      mc.city as my_city,
      mc.country_code as my_country,
      mc.latitude as my_lat,
      mc.longitude as my_lon,
      phc.latitude as their_lat,
      phc.longitude as their_lon,
      p.community_search_radius_miles as their_radius
    from public.profiles p
    join public.profile_home_cities phc on phc.user_id = p.id
    cross join my_cities mc
    where p.id <> uid
      and p.community_visible = true
      and coalesce(p.onboarding_complete, true) = true
      and (
        phc.city_key = mc.city_key
        or (
          lower(trim(phc.city)) = lower(trim(mc.city))
          and lower(trim(coalesce(phc.country_code, '')))
            = lower(trim(coalesce(mc.country_code, '')))
        )
        or (
          mc.latitude is not null
          and mc.longitude is not null
          and phc.latitude is not null
          and phc.longitude is not null
          and public.haversine_miles(mc.latitude, mc.longitude, phc.latitude, phc.longitude)
            <= my_radius
          and public.haversine_miles(mc.latitude, mc.longitude, phc.latitude, phc.longitude)
            <= p.community_search_radius_miles
        )
      )
  ),
  matched as (
    select
      cm.member_id,
      cm.member_name,
      cm.member_looking,
      cm.city_label,
      min(
        case
          when cm.my_lat is not null
            and cm.my_lon is not null
            and cm.their_lat is not null
            and cm.their_lon is not null
          then public.haversine_miles(cm.my_lat, cm.my_lon, cm.their_lat, cm.their_lon)
          else null
        end
      ) as min_distance
    from candidate_matches cm
    group by cm.member_id, cm.member_name, cm.member_looking, cm.city_label
  )
  select
    m.member_id,
    max(m.member_name),
    array_agg(distinct m.city_label order by m.city_label),
    bool_or(m.member_looking),
    round(min(m.min_distance)::numeric, 1)
  from matched m
  group by m.member_id
  order by min(m.min_distance) nulls last, max(m.member_name);
end;
$$;

grant execute on function public.community_members_at_my_cities() to authenticated;

drop view if exists public.me;
create view public.me
  with (security_invoker = true)
as
  select
    p.id,
    p.email,
    p.display_name,
    p.avatar_path,
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
    p.community_visible,
    p.looking_for_players,
    p.community_search_radius_miles
  from public.profiles p
  where p.id = auth.uid();
