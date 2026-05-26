-- Disc Caddy 015: looking for players + community messages
--
-- Opt-in flag to show you're open to new card-mates, and in-app messages
-- between community members who share a home city.

alter table public.profiles
  add column if not exists looking_for_players boolean not null default false;

comment on column public.profiles.looking_for_players is
  'When true (and community_visible), player appears as looking for rounds and can message city-mates.';

-- ---------- Messages ----------

create table if not exists public.community_messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  constraint community_messages_body_nonempty check (length(trim(body)) between 1 and 2000),
  constraint community_messages_no_self check (sender_id <> recipient_id)
);

create index if not exists community_messages_recipient_idx
  on public.community_messages (recipient_id, created_at desc);

create index if not exists community_messages_sender_idx
  on public.community_messages (sender_id, created_at desc);

alter table public.community_messages enable row level security;

drop policy if exists "community_messages_select_participant" on public.community_messages;
create policy "community_messages_select_participant" on public.community_messages
  for select using (auth.uid() in (sender_id, recipient_id));

drop policy if exists "community_messages_update_recipient_read" on public.community_messages;
create policy "community_messages_update_recipient_read" on public.community_messages
  for update using (auth.uid() = recipient_id)
  with check (auth.uid() = recipient_id);

-- Inserts only via send_community_message().

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
  select exists (
    select 1
    from public.profile_home_cities a
    join public.profile_home_cities b
      on b.city_key = a.city_key
     and b.user_id = p_user_b
    where a.user_id = p_user_a
  );
$$;

drop function if exists public.set_profile_home_cities(jsonb, boolean);

create or replace function public.set_profile_home_cities(
  p_cities jsonb,
  p_community_visible boolean default null,
  p_looking_for_players boolean default null
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
  vis boolean;
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

  vis := p_community_visible;
  if vis is not null or p_looking_for_players is not null then
    update public.profiles
    set
      community_visible = coalesce(vis, community_visible),
      looking_for_players = case
        when coalesce(vis, community_visible) = false then false
        else coalesce(p_looking_for_players, looking_for_players)
      end,
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
      user_id, city, region_code, country_code, city_key, course_id, sort_order
    )
    values (uid, c_city, c_region, c_country, c_key, c_course, idx);
    idx := idx + 1;
  end loop;
end;
$$;

grant execute on function public.set_profile_home_cities(jsonb, boolean, boolean) to authenticated;

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
      p.looking_for_players as member_looking,
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
    array_agg(distinct m.city_label order by m.city_label),
    bool_or(m.member_looking)
  from matched m
  group by m.member_id
  order by max(m.member_name);
end;
$$;

grant execute on function public.community_members_at_my_cities() to authenticated;

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
    where p.id = uid
      and p.community_visible = true
      and p.looking_for_players = true
  ) then
    raise exception 'Turn on Community and “Looking for players” to send messages';
  end if;

  if not exists (
    select 1 from public.profiles p
    where p.id = p_recipient_id
      and p.community_visible = true
      and coalesce(p.onboarding_complete, true) = true
  ) then
    raise exception 'That player is not available on Community';
  end if;

  if not public.community_users_share_city(uid, p_recipient_id) then
    raise exception 'You can only message players who share one of your home cities';
  end if;

  insert into public.community_messages (sender_id, recipient_id, body)
  values (uid, p_recipient_id, msg_body)
  returning id into new_id;

  return new_id;
end;
$$;

grant execute on function public.send_community_message(uuid, text) to authenticated;

create or replace function public.list_community_messages()
returns table (
  id uuid,
  sender_id uuid,
  sender_name text,
  recipient_id uuid,
  recipient_name text,
  body text,
  created_at timestamptz,
  read_at timestamptz,
  is_inbound boolean
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

  return query
  select
    m.id,
    m.sender_id,
    coalesce(nullif(trim(sp.display_name), ''), split_part(sp.email, '@', 1)),
    m.recipient_id,
    coalesce(nullif(trim(rp.display_name), ''), split_part(rp.email, '@', 1)),
    m.body,
    m.created_at,
    m.read_at,
    (m.recipient_id = uid) as is_inbound
  from public.community_messages m
  join public.profiles sp on sp.id = m.sender_id
  join public.profiles rp on rp.id = m.recipient_id
  where m.sender_id = uid or m.recipient_id = uid
  order by m.created_at desc
  limit 100;
end;
$$;

grant execute on function public.list_community_messages() to authenticated;

create or replace function public.mark_community_message_read(p_message_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  update public.community_messages
  set read_at = coalesce(read_at, now())
  where id = p_message_id
    and recipient_id = auth.uid();
end;
$$;

grant execute on function public.mark_community_message_read(uuid) to authenticated;

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
    p.community_visible,
    p.looking_for_players
  from public.profiles p
  where p.id = auth.uid();
