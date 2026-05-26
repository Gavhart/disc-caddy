-- Disc Caddy 024: notifications, scorecard invites, hole notes, round shares

-- ---------- Profiles: email notification preference ----------

alter table public.profiles
  add column if not exists notify_email boolean not null default true;

comment on column public.profiles.notify_email is
  'When true, important alerts may be emailed (scorecard invites, messages).';

-- ---------- Rounds: host-only scoring mode ----------

alter table public.rounds
  add column if not exists host_scoring_only boolean not null default false;

comment on column public.rounds.host_scoring_only is
  'When true, only the host can edit scores on the card.';

-- ---------- In-app notifications ----------

create table if not exists public.user_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (
    kind in ('scorecard_invite', 'community_message', 'friend_activity', 'round_invite')
  ),
  title text not null,
  body text not null,
  link_path text,
  metadata jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists user_notifications_user_idx
  on public.user_notifications (user_id, created_at desc);

create index if not exists user_notifications_unread_idx
  on public.user_notifications (user_id)
  where read_at is null;

alter table public.user_notifications enable row level security;

drop policy if exists "user_notifications_select_own" on public.user_notifications;
create policy "user_notifications_select_own" on public.user_notifications
  for select using (auth.uid() = user_id);

drop policy if exists "user_notifications_update_own" on public.user_notifications;
create policy "user_notifications_update_own" on public.user_notifications
  for update using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ---------- Scorecard invites (accept before joining) ----------

create table if not exists public.round_invites (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references public.rounds(id) on delete cascade,
  inviter_id uuid not null references public.profiles(id) on delete cascade,
  invitee_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'declined')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  constraint round_invites_unique_pair unique (round_id, invitee_id),
  constraint round_invites_no_self check (inviter_id <> invitee_id)
);

create index if not exists round_invites_invitee_idx
  on public.round_invites (invitee_id, status, created_at desc);

alter table public.round_invites enable row level security;

drop policy if exists "round_invites_select_participant" on public.round_invites;
create policy "round_invites_select_participant" on public.round_invites
  for select using (auth.uid() in (inviter_id, invitee_id));

-- Inserts/updates via RPC.

-- ---------- Per-user hole notes ----------

create table if not exists public.course_hole_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  hole_number integer not null check (hole_number > 0),
  note text not null,
  updated_at timestamptz not null default now(),
  constraint course_hole_notes_nonempty check (length(trim(note)) between 1 and 500),
  constraint course_hole_notes_unique unique (user_id, course_id, hole_number)
);

create index if not exists course_hole_notes_lookup_idx
  on public.course_hole_notes (user_id, course_id, hole_number);

alter table public.course_hole_notes enable row level security;

drop policy if exists "course_hole_notes_all_own" on public.course_hole_notes;
create policy "course_hole_notes_all_own" on public.course_hole_notes
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ---------- Public round recap links ----------

create table if not exists public.round_share_links (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references public.rounds(id) on delete cascade unique,
  token text not null unique default encode(gen_random_bytes(16), 'hex'),
  created_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.round_share_links enable row level security;

drop policy if exists "round_share_links_select_participant" on public.round_share_links;
create policy "round_share_links_select_participant" on public.round_share_links
  for select using (
    auth.uid() = created_by
    or public.is_round_participant(round_id)
  );

-- ---------- Helpers ----------

create or replace function public.create_user_notification(
  p_user_id uuid,
  p_kind text,
  p_title text,
  p_body text,
  p_link_path text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id uuid;
begin
  insert into public.user_notifications (
    user_id, kind, title, body, link_path, metadata
  )
  values (p_user_id, p_kind, p_title, p_body, p_link_path, coalesce(p_metadata, '{}'::jsonb))
  returning id into new_id;

  return new_id;
end;
$$;

create or replace function public.unread_notification_count()
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::int
  from public.user_notifications n
  where n.user_id = auth.uid()
    and n.read_at is null;
$$;

create or replace function public.list_user_notifications(p_limit integer default 30)
returns table (
  id uuid,
  kind text,
  title text,
  body text,
  link_path text,
  metadata jsonb,
  read_at timestamptz,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return;
  end if;

  return query
  select
    n.id, n.kind, n.title, n.body, n.link_path, n.metadata, n.read_at, n.created_at
  from public.user_notifications n
  where n.user_id = auth.uid()
  order by n.created_at desc
  limit greatest(1, least(coalesce(p_limit, 30), 100));
end;
$$;

create or replace function public.mark_notification_read(p_notification_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.user_notifications
  set read_at = coalesce(read_at, now())
  where id = p_notification_id
    and user_id = auth.uid();
end;
$$;

create or replace function public.mark_all_notifications_read()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.user_notifications
  set read_at = coalesce(read_at, now())
  where user_id = auth.uid()
    and read_at is null;
end;
$$;

create or replace function public.set_notify_email(p_enabled boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  update public.profiles
  set notify_email = p_enabled, updated_at = now()
  where id = auth.uid();
end;
$$;

create or replace function public.set_round_host_scoring_only(
  p_round_id uuid,
  p_enabled boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_round_host(p_round_id) then
    raise exception 'Only the host can change scoring mode';
  end if;

  update public.rounds
  set host_scoring_only = coalesce(p_enabled, false)
  where id = p_round_id;
end;
$$;

create or replace function public.invite_player_to_round(
  p_round_id uuid,
  p_invitee_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  invite_id uuid;
  host_name text;
  course_name text;
  course_id uuid;
  round_status text;
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  if not public.is_round_host(p_round_id) then
    raise exception 'Only the host can invite players';
  end if;

  select r.status, r.course_id
  into round_status, course_id
  from public.rounds r
  where r.id = p_round_id;

  if round_status <> 'active' then
    raise exception 'That round is no longer active';
  end if;

  if exists (
    select 1 from public.round_players rp
    where rp.round_id = p_round_id and rp.user_id = p_invitee_id
  ) then
    raise exception 'That player is already on the card';
  end if;

  select coalesce(nullif(trim(p.display_name), ''), split_part(p.email, '@', 1))
  into host_name
  from public.profiles p
  where p.id = uid;

  select c.name into course_name
  from public.courses c
  where c.id = course_id;

  insert into public.round_invites (round_id, inviter_id, invitee_id, status)
  values (p_round_id, uid, p_invitee_id, 'pending')
  on conflict (round_id, invitee_id) do update
  set status = 'pending', responded_at = null, created_at = now()
  returning id into invite_id;

  perform public.create_user_notification(
    p_invitee_id,
    'scorecard_invite',
    host_name || ' invited you to a scorecard',
    'Join ' || coalesce(host_name, 'a friend') || '''s live round'
      || case when course_name is not null then ' at ' || course_name else '' end
      || '.',
    '/',
    jsonb_build_object('round_id', p_round_id, 'invite_id', invite_id)
  );

  return invite_id;
end;
$$;

create or replace function public.respond_round_invite(
  p_invite_id uuid,
  p_accept boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  inv public.round_invites%rowtype;
  invitee_name text;
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  select * into inv
  from public.round_invites ri
  where ri.id = p_invite_id
    and ri.invitee_id = uid
    and ri.status = 'pending';

  if not found then
    raise exception 'Invite not found';
  end if;

  update public.round_invites
  set
    status = case when p_accept then 'accepted' else 'declined' end,
    responded_at = now()
  where id = p_invite_id;

  if not p_accept then
    return;
  end if;

  select coalesce(nullif(trim(p.display_name), ''), split_part(p.email, '@', 1))
  into invitee_name
  from public.profiles p
  where p.id = uid;

  insert into public.round_players (
    round_id, user_id, display_name, is_host, sort_order
  )
  select
    inv.round_id,
    uid,
    invitee_name,
    false,
    coalesce((select max(rp.sort_order) + 1 from public.round_players rp where rp.round_id = inv.round_id), 1)
  on conflict do nothing;
end;
$$;

create or replace function public.list_pending_round_invites()
returns table (
  id uuid,
  round_id uuid,
  inviter_name text,
  course_name text,
  course_id uuid,
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
    ri.id,
    ri.round_id,
    coalesce(nullif(trim(ip.display_name), ''), split_part(ip.email, '@', 1)),
    c.name,
    r.course_id,
    ri.created_at
  from public.round_invites ri
  join public.rounds r on r.id = ri.round_id
  join public.profiles ip on ip.id = ri.inviter_id
  left join public.courses c on c.id = r.course_id
  where ri.invitee_id = uid
    and ri.status = 'pending'
    and r.status = 'active'
  order by ri.created_at desc;
end;
$$;

create or replace function public.create_round_share_link(p_round_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  tok text;
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  if not public.is_round_participant(p_round_id) then
    raise exception 'Not allowed';
  end if;

  insert into public.round_share_links (round_id, created_by)
  values (p_round_id, uid)
  on conflict (round_id) do update set created_by = excluded.created_by
  returning token into tok;

  return tok;
end;
$$;

create or replace function public.get_public_round_recap(p_token text)
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  link public.round_share_links%rowtype;
  result json;
begin
  select * into link
  from public.round_share_links rsl
  where rsl.token = nullif(trim(p_token), '');

  if not found then
    return null;
  end if;

  select json_build_object(
    'course_name', c.name,
    'course_locality', c.locality,
    'played_at', r.ended_at,
    'status', r.status,
    'players', coalesce((
      select json_agg(
        json_build_object(
          'display_name', rp.display_name,
          'total_strokes', t.total_strokes,
          'total_par', t.total_par,
          'score_to_par', t.score_to_par,
          'holes_scored', t.holes_scored
        )
        order by t.score_to_par asc, t.total_strokes asc
      )
      from public.round_player_totals t
      join public.round_players rp on rp.id = t.round_player_id
      where t.round_id = link.round_id
    ), '[]'::json)
  )
  into result
  from public.rounds r
  left join public.courses c on c.id = r.course_id
  where r.id = link.round_id
    and r.status = 'completed';

  return result;
end;
$$;

create or replace function public.list_friend_activity(p_limit integer default 15)
returns table (
  user_id uuid,
  display_name text,
  course_name text,
  course_locality text,
  score_to_par integer,
  total_strokes integer,
  played_at timestamptz,
  round_id uuid
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
  with friends as (
    select case
      when fr.from_user_id = uid then fr.to_user_id
      else fr.from_user_id
    end as friend_id
    from public.friend_requests fr
    where fr.status = 'accepted'
      and uid in (fr.from_user_id, fr.to_user_id)
  )
  select
    f.friend_id,
    coalesce(nullif(trim(p.display_name), ''), split_part(p.email, '@', 1)),
    c.name,
    c.locality,
    t.score_to_par::int,
    t.total_strokes::int,
    t.ended_at,
    t.round_id
  from friends f
  join public.round_player_totals t on t.user_id = f.friend_id
  join public.profiles p on p.id = f.friend_id
  left join public.courses c on c.id = t.course_id
  where t.round_status = 'completed'
    and t.holes_scored >= 1
  order by t.ended_at desc nulls last
  limit greatest(1, least(coalesce(p_limit, 15), 50));
end;
$$;

-- Notify on new community messages

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
  has_thread boolean;
  new_id uuid;
  sender_name text;
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
      and p.subscription_tier = 'pro'
      and p.subscription_status in ('active', 'trialing')
  ) then
    raise exception 'Community messaging is a Pro feature — upgrade to send messages';
  end if;

  if not exists (
    select 1 from public.profiles p
    where p.id = uid and p.community_visible = true
  ) then
    raise exception 'Turn on Community and save settings before sending messages';
  end if;

  has_thread := public.community_users_have_thread(uid, p_recipient_id);

  if not has_thread and not exists (
    select 1 from public.profiles p
    where p.id = uid and p.looking_for_players = true
  ) then
    raise exception 'Turn on “Looking for players” and tap Save settings before starting a new conversation';
  end if;

  if not exists (
    select 1 from public.profiles p
    where p.id = p_recipient_id
      and p.community_visible = true
      and coalesce(p.onboarding_complete, true) = true
  ) then
    raise exception 'That player is not available on Community';
  end if;

  if not has_thread
     and not public.community_users_are_matched(uid, p_recipient_id)
  then
    raise exception 'That player is no longer in your search radius — refresh and try again';
  end if;

  if has_thread
     and not public.community_users_are_matched(uid, p_recipient_id)
     and not public.community_users_are_matched(p_recipient_id, uid)
  then
    raise exception 'That player is no longer available to message';
  end if;

  insert into public.community_messages (sender_id, recipient_id, body)
  values (uid, p_recipient_id, msg_body)
  returning id into new_id;

  select coalesce(nullif(trim(p.display_name), ''), split_part(p.email, '@', 1))
  into sender_name
  from public.profiles p
  where p.id = uid;

  perform public.create_user_notification(
    p_recipient_id,
    'community_message',
    'New message from ' || sender_name,
    left(msg_body, 120),
    '/community/messages/' || uid::text,
    jsonb_build_object('sender_id', uid, 'message_id', new_id)
  );

  return new_id;
end;
$$;

-- Friend activity notification when round completes (host ends round)

create or replace function public.notify_friends_round_completed(p_round_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  player record;
  course_name text;
  friend_id uuid;
begin
  if uid is null then
    return;
  end if;

  select c.name into course_name
  from public.rounds r
  left join public.courses c on c.id = r.course_id
  where r.id = p_round_id;

  for player in
    select rp.user_id, rp.display_name, t.score_to_par, t.total_strokes
    from public.round_players rp
    join public.round_player_totals t on t.round_player_id = rp.id
    where rp.round_id = p_round_id
      and rp.user_id is not null
      and rp.user_id <> uid
  loop
    for friend_id in
      select case
        when fr.from_user_id = player.user_id then fr.to_user_id
        else fr.from_user_id
      end
      from public.friend_requests fr
      where fr.status = 'accepted'
        and player.user_id in (fr.from_user_id, fr.to_user_id)
        and case
          when fr.from_user_id = player.user_id then fr.to_user_id
          else fr.from_user_id
        end = uid
    loop
      perform public.create_user_notification(
        friend_id,
        'friend_activity',
        player.display_name || ' finished a round',
        coalesce(player.display_name, 'A friend') || ' shot '
          || player.total_strokes::text
          || case when course_name is not null then ' at ' || course_name else '' end
          || '.',
        '/rounds/' || p_round_id::text,
        jsonb_build_object('round_id', p_round_id, 'user_id', player.user_id)
      );
    end loop;
  end loop;
end;
$$;

grant execute on function public.create_user_notification(uuid, text, text, text, text, jsonb) to authenticated;
grant execute on function public.unread_notification_count() to authenticated;
grant execute on function public.list_user_notifications(integer) to authenticated;
grant execute on function public.mark_notification_read(uuid) to authenticated;
grant execute on function public.mark_all_notifications_read() to authenticated;
grant execute on function public.set_notify_email(boolean) to authenticated;
grant execute on function public.set_round_host_scoring_only(uuid, boolean) to authenticated;
grant execute on function public.invite_player_to_round(uuid, uuid) to authenticated;
grant execute on function public.respond_round_invite(uuid, boolean) to authenticated;
grant execute on function public.list_pending_round_invites() to authenticated;
grant execute on function public.create_round_share_link(uuid) to authenticated;
grant execute on function public.get_public_round_recap(text) to authenticated;
grant execute on function public.get_public_round_recap(text) to anon;
grant execute on function public.list_friend_activity(integer) to authenticated;
grant execute on function public.notify_friends_round_completed(uuid) to authenticated;

grant execute on function public.send_community_message(uuid, text) to authenticated;

-- Respect host-only scoring on score updates

drop policy if exists "round_scores_insert_participant" on public.round_scores;
create policy "round_scores_insert_participant" on public.round_scores
  for insert with check (
    public.is_round_participant(round_id)
    and (
      public.is_round_host(round_id)
      or (
        not (select r.host_scoring_only from public.rounds r where r.id = round_id)
        and exists (
          select 1 from public.round_players rp
          where rp.id = round_player_id and rp.user_id = auth.uid()
        )
      )
    )
  );

drop policy if exists "round_scores_update_participant" on public.round_scores;
create policy "round_scores_update_participant" on public.round_scores
  for update using (
    public.is_round_participant(round_id)
    and (
      public.is_round_host(round_id)
      or (
        not (select r.host_scoring_only from public.rounds r where r.id = round_id)
        and exists (
          select 1 from public.round_players rp
          where rp.id = round_player_id and rp.user_id = auth.uid()
        )
      )
    )
  );

-- me view: notify_email
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
    coalesce(p.community_search_radius_miles, 25) as community_search_radius_miles,
    p.notify_email
  from public.profiles p
  where p.id = auth.uid();
