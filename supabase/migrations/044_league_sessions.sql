-- Disc Caddy 044: league night sessions — check-in + card assignment

create table if not exists public.league_sessions (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  session_date date not null default current_date,
  course_id uuid references public.courses(id) on delete set null,
  status text not null default 'open' check (status in ('open', 'closed')),
  created_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  closed_at timestamptz,
  constraint league_sessions_one_per_day unique (league_id, session_date)
);

create index if not exists league_sessions_league_idx
  on public.league_sessions (league_id, session_date desc);

create table if not exists public.league_session_checkins (
  session_id uuid not null references public.league_sessions(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  checked_in_at timestamptz not null default now(),
  checked_in_by uuid not null references public.profiles(id) on delete cascade,
  primary key (session_id, user_id)
);

create index if not exists league_session_checkins_session_idx
  on public.league_session_checkins (session_id, checked_in_at);

create table if not exists public.league_session_cards (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.league_sessions(id) on delete cascade,
  sort_order integer not null default 0,
  label text,
  constraint league_session_cards_order unique (session_id, sort_order)
);

create index if not exists league_session_cards_session_idx
  on public.league_session_cards (session_id, sort_order);

create table if not exists public.league_session_card_members (
  card_id uuid not null references public.league_session_cards(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  sort_order integer not null default 0,
  primary key (card_id, user_id)
);

alter table public.league_sessions enable row level security;
alter table public.league_session_checkins enable row level security;
alter table public.league_session_cards enable row level security;
alter table public.league_session_card_members enable row level security;

drop policy if exists "league_sessions_select_member" on public.league_sessions;
create policy "league_sessions_select_member" on public.league_sessions
  for select using (public.is_league_member(league_id));

drop policy if exists "league_session_checkins_select_member" on public.league_session_checkins;
create policy "league_session_checkins_select_member" on public.league_session_checkins
  for select using (
    exists (
      select 1 from public.league_sessions ls
      where ls.id = session_id and public.is_league_member(ls.league_id)
    )
  );

drop policy if exists "league_session_cards_select_member" on public.league_session_cards;
create policy "league_session_cards_select_member" on public.league_session_cards
  for select using (
    exists (
      select 1 from public.league_sessions ls
      where ls.id = session_id and public.is_league_member(ls.league_id)
    )
  );

drop policy if exists "league_session_card_members_select_member" on public.league_session_card_members;
create policy "league_session_card_members_select_member" on public.league_session_card_members
  for select using (
    exists (
      select 1
      from public.league_session_cards c
      join public.league_sessions ls on ls.id = c.session_id
      where c.id = card_id and public.is_league_member(ls.league_id)
    )
  );

-- ---------- Helpers ----------

create or replace function public._league_session_card_labels()
returns text[]
language sql
immutable
as $$
  select array[
    'Card 1 — Early birds', 'Card 2 — Hyzer heroes', 'Card 3 — Chain seekers',
    'Card 4 — Fore! squad', 'Card 5 — Birdie brigade', 'Card 6 — Mando mavens',
    'Card 7 — Sky hyzers', 'Card 8 — Putt pirates', 'Card 9 — Rough riders',
    'Card 10 — Ace chasers', 'Card 11 — Tee titans', 'Card 12 — Disc dynamos'
  ];
$$;

create or replace function public._profile_display_name(p_user_id uuid)
returns text
language sql
stable
as $$
  select coalesce(
    nullif(trim(p.display_name), ''),
    split_part(p.email, '@', 1),
    'Player'
  )
  from public.profiles p
  where p.id = p_user_id;
$$;

create or replace function public._build_league_tonight_payload(p_session_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  sess public.league_sessions%rowtype;
  uid uuid := auth.uid();
  checkins jsonb;
  cards jsonb;
  sit_out jsonb;
  member_count integer;
  checked_in_count integer;
  my_card_id uuid;
  card_labels text[] := public._league_session_card_labels();
begin
  select * into sess from public.league_sessions where id = p_session_id;
  if not found then
    return null;
  end if;

  select count(*) into member_count
  from public.league_members lm
  where lm.league_id = sess.league_id;

  select count(*) into checked_in_count
  from public.league_session_checkins c
  where c.session_id = p_session_id;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'user_id', c.user_id,
      'display_name', public._profile_display_name(c.user_id),
      'checked_in_at', c.checked_in_at,
      'checked_in_by', c.checked_in_by,
      'is_me', c.user_id = uid
    )
    order by c.checked_in_at
  ), '[]'::jsonb)
  into checkins
  from public.league_session_checkins c
  where c.session_id = p_session_id;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', c.id,
      'sort_order', c.sort_order,
      'label', coalesce(
        nullif(trim(c.label), ''),
        card_labels[1 + ((c.sort_order) % array_length(card_labels, 1))]
      ),
      'members', (
        select coalesce(jsonb_agg(
          jsonb_build_object(
            'user_id', m.user_id,
            'display_name', public._profile_display_name(m.user_id),
            'sort_order', m.sort_order,
            'is_me', m.user_id = uid
          )
          order by m.sort_order
        ), '[]'::jsonb)
        from public.league_session_card_members m
        where m.card_id = c.id
      )
    )
    order by c.sort_order
  ), '[]'::jsonb)
  into cards
  from public.league_session_cards c
  where c.session_id = p_session_id;

  select c.id into my_card_id
  from public.league_session_cards c
  join public.league_session_card_members m on m.card_id = c.id
  where c.session_id = p_session_id and m.user_id = uid
  limit 1;

  sit_out := null;
  if checked_in_count > 0 and jsonb_array_length(cards) > 0 then
    select jsonb_build_object(
      'user_id', c.user_id,
      'display_name', public._profile_display_name(c.user_id)
    )
    into sit_out
    from public.league_session_checkins c
    where c.session_id = p_session_id
      and not exists (
        select 1 from public.league_session_card_members m
        join public.league_session_cards card on card.id = m.card_id
        where card.session_id = p_session_id and m.user_id = c.user_id
      )
    limit 1;
  end if;

  return jsonb_build_object(
    'session', jsonb_build_object(
      'id', sess.id,
      'league_id', sess.league_id,
      'session_date', sess.session_date,
      'course_id', sess.course_id,
      'status', sess.status,
      'created_at', sess.created_at,
      'closed_at', sess.closed_at
    ),
    'checkins', checkins,
    'cards', cards,
    'sit_out', sit_out,
    'my_card_id', my_card_id,
    'checked_in_count', checked_in_count,
    'member_count', member_count
  );
end;
$$;

-- ---------- Get tonight's session ----------

create or replace function public.get_league_tonight(p_league_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  sid uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if not public.is_league_member(p_league_id) then
    raise exception 'Not a league member';
  end if;

  select ls.id into sid
  from public.league_sessions ls
  where ls.league_id = p_league_id
    and ls.session_date = current_date
    and ls.status = 'open'
  limit 1;

  if sid is null then
    return jsonb_build_object(
      'session', null,
      'checkins', '[]'::jsonb,
      'cards', '[]'::jsonb,
      'sit_out', null,
      'my_card_id', null,
      'checked_in_count', 0,
      'member_count', (
        select count(*) from public.league_members lm where lm.league_id = p_league_id
      )
    );
  end if;

  return public._build_league_tonight_payload(sid);
end;
$$;

-- ---------- Open / close session ----------

create or replace function public.open_league_session(
  p_league_id uuid,
  p_course_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  sid uuid;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if not public.is_league_admin(p_league_id) then
    raise exception 'Only league admins can open league night';
  end if;
  if p_course_id is not null and not exists (
    select 1 from public.courses where id = p_course_id
  ) then
    raise exception 'Course not found';
  end if;

  select ls.id into sid
  from public.league_sessions ls
  where ls.league_id = p_league_id
    and ls.session_date = current_date
    and ls.status = 'open';

  if sid is null then
    insert into public.league_sessions (league_id, session_date, course_id, created_by)
    values (p_league_id, current_date, p_course_id, auth.uid())
    returning id into sid;
  elsif p_course_id is not null then
    update public.league_sessions
    set course_id = p_course_id
    where id = sid;
  end if;

  return public._build_league_tonight_payload(sid);
end;
$$;

create or replace function public.close_league_session(p_session_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  lid uuid;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;

  select league_id into lid from public.league_sessions where id = p_session_id;
  if lid is null then raise exception 'Session not found'; end if;
  if not public.is_league_admin(lid) then
    raise exception 'Only league admins can close league night';
  end if;

  update public.league_sessions
  set status = 'closed', closed_at = now()
  where id = p_session_id;

  return public._build_league_tonight_payload(p_session_id);
end;
$$;

-- ---------- Check-in / check-out ----------

create or replace function public.check_in_league_session(
  p_session_id uuid,
  p_user_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  lid uuid;
  target uuid := coalesce(p_user_id, auth.uid());
  st text;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;

  select ls.league_id, ls.status into lid, st
  from public.league_sessions ls
  where ls.id = p_session_id;
  if lid is null then raise exception 'Session not found'; end if;
  if st <> 'open' then raise exception 'League night is closed'; end if;
  if not public.is_league_member(lid) then raise exception 'Not a league member'; end if;

  if target <> auth.uid() and not public.is_league_admin(lid) then
    raise exception 'Only admins can check in other players';
  end if;
  if not exists (
    select 1 from public.league_members lm
    where lm.league_id = lid and lm.user_id = target
  ) then
    raise exception 'Player is not in this league';
  end if;

  insert into public.league_session_checkins (session_id, user_id, checked_in_by)
  values (p_session_id, target, auth.uid())
  on conflict (session_id, user_id) do nothing;

  return public._build_league_tonight_payload(p_session_id);
end;
$$;

create or replace function public.check_out_league_session(
  p_session_id uuid,
  p_user_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  lid uuid;
  target uuid := coalesce(p_user_id, auth.uid());
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;

  select league_id into lid from public.league_sessions where id = p_session_id;
  if lid is null then raise exception 'Session not found'; end if;
  if not public.is_league_member(lid) then raise exception 'Not a league member'; end if;

  if target <> auth.uid() and not public.is_league_admin(lid) then
    raise exception 'Only admins can remove other check-ins';
  end if;

  delete from public.league_session_card_members m
  using public.league_session_cards c
  where c.id = m.card_id and c.session_id = p_session_id and m.user_id = target;

  delete from public.league_session_checkins
  where session_id = p_session_id and user_id = target;

  return public._build_league_tonight_payload(p_session_id);
end;
$$;

-- ---------- Shuffle cards from checked-in players ----------

create or replace function public.shuffle_league_session_cards(p_session_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  lid uuid;
  play_mode text;
  member_ids uuid[];
  member_count integer;
  card_size integer;
  i integer;
  card_idx integer := 0;
  card_id uuid;
  card_labels text[] := public._league_session_card_labels();
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;

  select ls.league_id into lid
  from public.league_sessions ls
  where ls.id = p_session_id and ls.status = 'open';
  if lid is null then raise exception 'Open session not found'; end if;
  if not public.is_league_admin(lid) then
    raise exception 'Only league admins can shuffle cards';
  end if;

  select l.play_mode into play_mode from public.leagues l where l.id = lid;
  card_size := case when play_mode = 'doubles' then 2 else 4 end;

  select coalesce(array_agg(c.user_id order by random()), array[]::uuid[])
  into member_ids
  from public.league_session_checkins c
  where c.session_id = p_session_id;

  member_count := coalesce(array_length(member_ids, 1), 0);
  if member_count < 2 then
    raise exception 'Need at least 2 checked-in players to shuffle cards';
  end if;

  if play_mode = 'doubles' and member_count % 2 = 1 then
    member_count := member_count - 1;
  end if;

  delete from public.league_session_card_members m
  using public.league_session_cards c
  where c.id = m.card_id and c.session_id = p_session_id;

  delete from public.league_session_cards where session_id = p_session_id;

  i := 1;
  while i <= member_count loop
    declare
      remaining integer := member_count - i + 1;
      this_size integer;
    begin
      if remaining <= card_size then
        this_size := remaining;
      else
        this_size := card_size;
        if play_mode <> 'doubles' and (remaining - card_size) = 1 and card_size > 1 then
          this_size := card_size - 1;
        end if;
      end if;

      card_idx := card_idx + 1;
      insert into public.league_session_cards (session_id, sort_order, label)
      values (
        p_session_id,
        card_idx - 1,
        card_labels[1 + ((card_idx - 1) % array_length(card_labels, 1))]
      )
      returning id into card_id;

      for j in 0..(this_size - 1) loop
        insert into public.league_session_card_members (card_id, user_id, sort_order)
        values (card_id, member_ids[i + j], j);
      end loop;

      i := i + this_size;
    end;
  end loop;

  return public._build_league_tonight_payload(p_session_id);
end;
$$;

-- ---------- Notify card assignments ----------

create or replace function public.notify_league_session_cards(p_session_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  lid uuid;
  league_name text;
  card record;
  member record;
  roster text;
  notified integer := 0;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;

  select ls.league_id into lid
  from public.league_sessions ls
  where ls.id = p_session_id and ls.status = 'open';
  if lid is null then raise exception 'Open session not found'; end if;
  if not public.is_league_admin(lid) then
    raise exception 'Only league admins can notify card assignments';
  end if;

  select l.name into league_name from public.leagues l where l.id = lid;

  for card in
    select c.id, c.label, c.sort_order
    from public.league_session_cards c
    where c.session_id = p_session_id
    order by c.sort_order
  loop
    select string_agg(public._profile_display_name(m.user_id), ', ' order by m.sort_order)
    into roster
    from public.league_session_card_members m
    where m.card_id = card.id;

    for member in
      select m.user_id
      from public.league_session_card_members m
      where m.card_id = card.id
    loop
      perform public.create_user_notification(
        member.user_id,
        'league_update',
        coalesce(nullif(trim(card.label), ''), 'Your league card'),
        'League night card for ' || league_name || ': ' || roster,
        '/social/leagues',
        jsonb_build_object(
          'league_id', lid,
          'session_id', p_session_id,
          'card_id', card.id
        )
      );
      notified := notified + 1;
    end loop;
  end loop;

  return jsonb_build_object(
    'notified', notified,
    'tonight', public._build_league_tonight_payload(p_session_id)
  );
end;
$$;

-- ---------- Start live round for a card ----------

create or replace function public.start_league_session_round(
  p_card_id uuid,
  p_course_id uuid,
  p_bag_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  card public.league_session_cards%rowtype;
  sess public.league_sessions%rowtype;
  league public.leagues%rowtype;
  rid uuid;
  member record;
  rp_id uuid;
  v_team_id uuid;
  host_name text;
  course_name text;
  card_label text;
  member_count integer;
  sort_idx integer := 0;
  partner_id uuid;
  partner_ids uuid[] := array[]::uuid[];
begin
  if uid is null then raise exception 'Not authenticated'; end if;

  select * into card from public.league_session_cards where id = p_card_id;
  if not found then raise exception 'Card not found'; end if;

  select * into sess from public.league_sessions where id = card.session_id;
  if sess.status <> 'open' then raise exception 'League night is closed'; end if;

  if not exists (
    select 1 from public.league_session_card_members m
    where m.card_id = p_card_id and m.user_id = uid
  ) then
    raise exception 'Only players on this card can start the round';
  end if;

  if not public.is_league_member(sess.league_id) then
    raise exception 'Not a league member';
  end if;

  select * into league from public.leagues where id = sess.league_id;

  if not exists (select 1 from public.courses where id = p_course_id) then
    raise exception 'Course not found';
  end if;
  if not exists (select 1 from public.bags where id = p_bag_id and user_id = uid) then
    raise exception 'Select one of your bags to start the round';
  end if;

  select count(*) into member_count
  from public.league_session_card_members m
  where m.card_id = p_card_id;

  card_label := coalesce(
    nullif(trim(card.label), ''),
    'Card ' || (card.sort_order + 1)::text
  );

  select c.name into course_name from public.courses c where c.id = p_course_id;
  select public._profile_display_name(uid) into host_name;

  insert into public.rounds (
    user_id,
    course_id,
    bag_id,
    status,
    format,
    format_config,
    host_scoring_only
  )
  values (
    uid,
    p_course_id,
    p_bag_id,
    'active',
    case when league.play_mode = 'doubles' and member_count = 2 then 'best_ball' else 'stroke' end,
    jsonb_build_object(
      'league_id', sess.league_id,
      'session_id', sess.id,
      'card_id', p_card_id
    ),
    false
  )
  returning id into rid;

  if league.play_mode = 'doubles' and member_count = 2 then
    insert into public.round_teams (round_id, name, sort_order)
    values (rid, card_label, 0)
    returning id into v_team_id;
  end if;

  for member in
    select m.user_id, m.sort_order
    from public.league_session_card_members m
    where m.card_id = p_card_id
    order by m.sort_order
  loop
    insert into public.round_players (round_id, user_id, display_name, is_host, sort_order, team_id)
    values (
      rid,
      member.user_id,
      public._profile_display_name(member.user_id),
      member.user_id = uid,
      sort_idx,
      case when v_team_id is not null then v_team_id else null end
    )
    returning id into rp_id;

    if member.user_id <> uid then
      partner_ids := array_append(partner_ids, member.user_id);
    end if;

    sort_idx := sort_idx + 1;
  end loop;

  foreach partner_id in array partner_ids loop
    perform public.create_user_notification(
      partner_id,
      case
        when league.play_mode = 'doubles' then 'league_doubles_round'
        else 'league_update'
      end,
      host_name || ' started your league card round',
      'Join the live scorecard for ' || card_label
        || case when course_name is not null then ' at ' || course_name else '' end
        || '.',
      '/',
      jsonb_build_object(
        'round_id', rid,
        'league_id', sess.league_id,
        'session_id', sess.id,
        'card_id', p_card_id
      )
    );
  end loop;

  return jsonb_build_object(
    'round_id', rid,
    'course_id', p_course_id,
    'course_name', course_name,
    'card_label', card_label,
    'member_count', member_count
  );
end;
$$;

grant execute on function public.get_league_tonight(uuid) to authenticated;
grant execute on function public.open_league_session(uuid, uuid) to authenticated;
grant execute on function public.close_league_session(uuid) to authenticated;
grant execute on function public.check_in_league_session(uuid, uuid) to authenticated;
grant execute on function public.check_out_league_session(uuid, uuid) to authenticated;
grant execute on function public.shuffle_league_session_cards(uuid) to authenticated;
grant execute on function public.notify_league_session_cards(uuid) to authenticated;
grant execute on function public.start_league_session_round(uuid, uuid, uuid) to authenticated;
