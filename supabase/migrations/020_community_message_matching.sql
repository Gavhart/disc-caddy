-- Disc Caddy 020: align messaging with member discovery
--
-- Players could appear in the member list but fail send_community_message
-- because home_cities_overlap used different radius rules than the list RPC.

create or replace function public.community_users_are_matched(
  p_viewer uuid,
  p_other uuid
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  my_radius integer;
begin
  if p_viewer is null or p_other is null or p_viewer = p_other then
    return false;
  end if;

  select p.community_search_radius_miles
  into my_radius
  from public.profiles p
  where p.id = p_viewer
    and p.community_visible = true;

  if my_radius is null then
    return false;
  end if;

  if not exists (
    select 1 from public.profile_home_cities phc where phc.user_id = p_viewer
  ) then
    return false;
  end if;

  return exists (
    select 1
    from public.profile_home_cities mc
    join public.profile_home_cities oc on oc.user_id = p_other
    join public.profiles op on op.id = p_other
    where mc.user_id = p_viewer
      and op.community_visible = true
      and coalesce(op.onboarding_complete, true) = true
      and public.community_home_areas_match(
        mc.city,
        mc.region_code,
        mc.country_code,
        mc.latitude,
        mc.longitude,
        oc.city,
        oc.region_code,
        oc.country_code,
        oc.latitude,
        oc.longitude,
        my_radius
      )
  );
end;
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
  select public.community_users_are_matched(p_user_a, p_user_b);
$$;

create or replace function public.send_community_message(
  p_recipient_id uuid,
  p_body text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  msg_body text := trim(p_body);
  new_id uuid;
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  if p_recipient_id is null or p_recipient_id = uid then
    raise exception 'Invalid recipient';
  end if;

  if length(msg_body) < 1 or length(msg_body) > 2000 then
    raise exception 'Message must be 1–2000 characters';
  end if;

  if not exists (
    select 1 from public.profiles p
    where p.id = uid and p.community_visible = true
  ) then
    raise exception 'Turn on Community and save settings before sending messages';
  end if;

  if not exists (
    select 1 from public.profiles p
    where p.id = uid and p.looking_for_players = true
  ) then
    raise exception 'Turn on “Looking for players” and tap Save settings before sending messages';
  end if;

  if not exists (
    select 1 from public.profiles p
    where p.id = p_recipient_id
      and p.community_visible = true
      and coalesce(p.onboarding_complete, true) = true
  ) then
    raise exception 'That player is not available on Community';
  end if;

  if not public.community_users_are_matched(uid, p_recipient_id) then
    raise exception 'That player is no longer in your search radius — refresh and try again';
  end if;

  insert into public.community_messages (sender_id, recipient_id, body)
  values (uid, p_recipient_id, msg_body)
  returning id into new_id;

  return new_id;
end;
$$;

grant execute on function public.community_users_are_matched(uuid, uuid) to authenticated;
grant execute on function public.send_community_message(uuid, text) to authenticated;
