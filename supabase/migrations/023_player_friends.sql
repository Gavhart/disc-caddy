-- Disc Caddy 023: player friends + realtime group scorecards
--
-- Friends list for quick scorecard adds. Group rounds already support
-- participants via round_players (013); this adds friend requests and
-- enables live score sync via Supabase Realtime.

create table if not exists public.friend_requests (
  id uuid primary key default gen_random_uuid(),
  from_user_id uuid not null references public.profiles(id) on delete cascade,
  to_user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'declined')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  constraint friend_requests_no_self check (from_user_id <> to_user_id),
  constraint friend_requests_unique_pair unique (from_user_id, to_user_id)
);

create index if not exists friend_requests_to_user_idx
  on public.friend_requests (to_user_id, status, created_at desc);

create index if not exists friend_requests_from_user_idx
  on public.friend_requests (from_user_id, status);

alter table public.friend_requests enable row level security;

drop policy if exists "friend_requests_select_participant" on public.friend_requests;
create policy "friend_requests_select_participant" on public.friend_requests
  for select using (auth.uid() in (from_user_id, to_user_id));

-- Inserts/updates via RPC only.

create or replace function public.are_friends(p_user_a uuid, p_user_b uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.friend_requests fr
    where fr.status = 'accepted'
      and (
        (fr.from_user_id = p_user_a and fr.to_user_id = p_user_b)
        or (fr.from_user_id = p_user_b and fr.to_user_id = p_user_a)
      )
  );
$$;

create or replace function public.send_friend_request(p_to_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  existing public.friend_requests%rowtype;
  reverse public.friend_requests%rowtype;
  new_id uuid;
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  if p_to_user_id is null or p_to_user_id = uid then
    raise exception 'Invalid friend';
  end if;

  if not exists (
    select 1 from public.profiles p
    where p.id = p_to_user_id and coalesce(p.onboarding_complete, true) = true
  ) then
    raise exception 'That player is not available';
  end if;

  if public.are_friends(uid, p_to_user_id) then
    raise exception 'You are already friends';
  end if;

  select * into existing
  from public.friend_requests fr
  where fr.from_user_id = uid and fr.to_user_id = p_to_user_id;

  if found then
    if existing.status = 'pending' then
      raise exception 'Friend request already sent';
    elsif existing.status = 'accepted' then
      raise exception 'You are already friends';
    else
      update public.friend_requests
      set status = 'pending', responded_at = null, created_at = now()
      where id = existing.id
      returning id into new_id;
      return new_id;
    end if;
  end if;

  select * into reverse
  from public.friend_requests fr
  where fr.from_user_id = p_to_user_id
    and fr.to_user_id = uid
    and fr.status = 'pending';

  if found then
    update public.friend_requests
    set status = 'accepted', responded_at = now()
    where id = reverse.id
    returning id into new_id;
    return new_id;
  end if;

  insert into public.friend_requests (from_user_id, to_user_id, status)
  values (uid, p_to_user_id, 'pending')
  returning id into new_id;

  return new_id;
end;
$$;

create or replace function public.respond_friend_request(
  p_request_id uuid,
  p_accept boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  update public.friend_requests fr
  set
    status = case when p_accept then 'accepted' else 'declined' end,
    responded_at = now()
  where fr.id = p_request_id
    and fr.to_user_id = uid
    and fr.status = 'pending';

  if not found then
    raise exception 'Friend request not found';
  end if;
end;
$$;

create or replace function public.remove_friend(p_friend_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  delete from public.friend_requests fr
  where fr.status = 'accepted'
    and (
      (fr.from_user_id = uid and fr.to_user_id = p_friend_user_id)
      or (fr.from_user_id = p_friend_user_id and fr.to_user_id = uid)
    );
end;
$$;

create or replace function public.list_friends()
returns table (
  user_id uuid,
  display_name text,
  email text
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
    case when fr.from_user_id = uid then fr.to_user_id else fr.from_user_id end,
    coalesce(
      nullif(trim(p.display_name), ''),
      split_part(p.email, '@', 1)
    ),
    p.email
  from public.friend_requests fr
  join public.profiles p
    on p.id = case when fr.from_user_id = uid then fr.to_user_id else fr.from_user_id end
  where fr.status = 'accepted'
    and uid in (fr.from_user_id, fr.to_user_id)
  order by 2, 3;
end;
$$;

create or replace function public.list_incoming_friend_requests()
returns table (
  id uuid,
  from_user_id uuid,
  display_name text,
  email text,
  created_at timestamptz
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
    fr.id,
    fr.from_user_id,
    coalesce(nullif(trim(p.display_name), ''), split_part(p.email, '@', 1)),
    p.email,
    fr.created_at
  from public.friend_requests fr
  join public.profiles p on p.id = fr.from_user_id
  where fr.to_user_id = uid
    and fr.status = 'pending'
  order by fr.created_at desc;
end;
$$;

grant execute on function public.send_friend_request(uuid) to authenticated;
grant execute on function public.respond_friend_request(uuid, boolean) to authenticated;
grant execute on function public.remove_friend(uuid) to authenticated;
grant execute on function public.list_friends() to authenticated;
grant execute on function public.list_incoming_friend_requests() to authenticated;
grant execute on function public.are_friends(uuid, uuid) to authenticated;

-- Realtime for live group scorecards (safe to run if already added).
do $$
begin
  alter publication supabase_realtime add table public.round_scores;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.round_players;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.rounds;
exception
  when duplicate_object then null;
end $$;

alter table public.round_scores replica identity full;
alter table public.round_players replica identity full;
alter table public.rounds replica identity full;
