-- Disc Caddy 017: flexible community city matching
--
-- Players often enter cities with inconsistent region/country (or only city name).
-- Match on exact city_key OR same city + country (case-insensitive).

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
    where a.user_id = p_user_a
      and (
        b.city_key = a.city_key
        or (
          lower(trim(b.city)) = lower(trim(a.city))
          and lower(trim(coalesce(b.country_code, '')))
            = lower(trim(coalesce(a.country_code, '')))
        )
      )
  );
$$;

create or replace function public.community_users_share_city(
  p_user_a uuid,
  p_user_b uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.home_cities_overlap(p_user_a, p_user_b);
$$;

drop function if exists public.community_members_at_my_cities();

create or replace function public.community_members_at_my_cities()
returns table (
  user_id uuid,
  display_name text,
  shared_city_labels text[],
  looking_for_players boolean
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

  if not exists (
    select 1 from public.profile_home_cities phc where phc.user_id = uid
  ) then
    return;
  end if;

  return query
  with my_cities as (
    select phc.city, phc.region_code, phc.country_code, phc.city_key
    from public.profile_home_cities phc
    where phc.user_id = uid
  ),
  matched as (
    select
      p.id as member_id,
      coalesce(nullif(trim(p.display_name), ''), split_part(p.email, '@', 1)) as member_name,
      p.looking_for_players as member_looking,
      public.format_city_label(phc.city, phc.region_code, phc.country_code) as city_label
    from public.profiles p
    join public.profile_home_cities phc on phc.user_id = p.id
    where p.id <> uid
      and p.community_visible = true
      and coalesce(p.onboarding_complete, true) = true
      and exists (
        select 1
        from my_cities mc
        where phc.city_key = mc.city_key
           or (
             lower(trim(phc.city)) = lower(trim(mc.city))
             and lower(trim(coalesce(phc.country_code, '')))
               = lower(trim(coalesce(mc.country_code, '')))
           )
      )
  )
  select
    m.member_id,
    max(m.member_name),
    array_agg(distinct m.city_label order by m.city_label),
    bool_or(m.member_looking)
  from matched m
  group by m.member_id
  order by max(m.member_name);
end;
$$;

grant execute on function public.home_cities_overlap(uuid, uuid) to authenticated;
grant execute on function public.community_members_at_my_cities() to authenticated;
