-- Disc Caddy 019: fix community matching for real-world testing
--
-- Problems addressed:
-- 1. Mutual radius required BOTH users inside each other's radius (too strict).
-- 2. City+country match failed when one account omitted country code.
-- 3. No visibility into setup state when matches fail.

create or replace function public.community_home_areas_match(
  my_city text,
  my_region text,
  my_country text,
  my_lat double precision,
  my_lon double precision,
  their_city text,
  their_region text,
  their_country text,
  their_lat double precision,
  their_lon double precision,
  my_radius_miles integer
)
returns boolean
language sql
immutable
as $$
  select
    public.normalize_city_key(my_city, my_region, my_country)
      = public.normalize_city_key(their_city, their_region, their_country)
    or (
      lower(trim(my_city)) = lower(trim(their_city))
      and lower(trim(coalesce(my_country, ''))) = lower(trim(coalesce(their_country, '')))
    )
    or (
      lower(trim(my_city)) = lower(trim(their_city))
      and lower(trim(coalesce(my_region, ''))) = lower(trim(coalesce(their_region, '')))
      and nullif(trim(coalesce(my_region, '')), '') is not null
    )
    or (
      lower(trim(my_city)) = lower(trim(their_city))
      and (
        nullif(trim(coalesce(my_country, '')), '') is null
        or nullif(trim(coalesce(their_country, '')), '') is null
      )
    )
    or (
      my_lat is not null
      and my_lon is not null
      and their_lat is not null
      and their_lon is not null
      and public.haversine_miles(my_lat, my_lon, their_lat, their_lon) <= my_radius_miles
    );
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
      and public.community_home_areas_match(
        a.city,
        a.region_code,
        a.country_code,
        a.latitude,
        a.longitude,
        b.city,
        b.region_code,
        b.country_code,
        b.latitude,
        b.longitude,
        greatest(pa.community_search_radius_miles, pb.community_search_radius_miles)
      )
  );
$$;

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
      mc.latitude as my_lat,
      mc.longitude as my_lon,
      phc.latitude as their_lat,
      phc.longitude as their_lon
    from public.profiles p
    join public.profile_home_cities phc on phc.user_id = p.id
    cross join my_cities mc
    where p.id <> uid
      and p.community_visible = true
      and coalesce(p.onboarding_complete, true) = true
      and public.community_home_areas_match(
        mc.city,
        mc.region_code,
        mc.country_code,
        mc.latitude,
        mc.longitude,
        phc.city,
        phc.region_code,
        phc.country_code,
        phc.latitude,
        phc.longitude,
        my_radius
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

create or replace function public.community_setup_status()
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  result json;
begin
  if uid is null then
    return json_build_object('error', 'Not authenticated');
  end if;

  select json_build_object(
    'community_visible', p.community_visible,
    'looking_for_players', p.looking_for_players,
    'search_radius_miles', p.community_search_radius_miles,
    'home_city_count', (
      select count(*)::int from public.profile_home_cities phc where phc.user_id = uid
    ),
    'gps_city_count', (
      select count(*)::int
      from public.profile_home_cities phc
      where phc.user_id = uid
        and phc.latitude is not null
        and phc.longitude is not null
    ),
    'saved_city_labels', coalesce((
      select json_agg(
        public.format_city_label(phc.city, phc.region_code, phc.country_code)
        order by phc.sort_order
      )
      from public.profile_home_cities phc
      where phc.user_id = uid
    ), '[]'::json),
    'other_visible_players', (
      select count(*)::int
      from public.profiles op
      where op.id <> uid
        and op.community_visible = true
        and coalesce(op.onboarding_complete, true) = true
    ),
    'other_visible_with_cities', (
      select count(distinct op.id)::int
      from public.profiles op
      join public.profile_home_cities phc on phc.user_id = op.id
      where op.id <> uid
        and op.community_visible = true
        and coalesce(op.onboarding_complete, true) = true
    ),
    'match_count', (
      select count(*)::int from public.community_members_at_my_cities()
    )
  )
  into result
  from public.profiles p
  where p.id = uid;

  return coalesce(result, json_build_object('error', 'Profile not found'));
end;
$$;

grant execute on function public.community_setup_status() to authenticated;
