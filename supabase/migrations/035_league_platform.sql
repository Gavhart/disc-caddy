-- Disc Caddy 035: Full league platform — discovery, doubles, handicaps, chat,
-- announcements, ace pots, clubs, rivalries

-- ---------- Clubs (before league FK) ----------

create table if not exists public.clubs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  location text,
  created_by uuid not null references public.profiles(id) on delete cascade,
  invite_code text not null unique default encode(gen_random_bytes(6), 'hex'),
  created_at timestamptz not null default now()
);

create table if not exists public.club_members (
  club_id uuid not null references public.clubs(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('admin', 'member')),
  joined_at timestamptz not null default now(),
  primary key (club_id, user_id)
);

-- ---------- League visibility ----------

alter table public.leagues
  add column if not exists is_public boolean not null default false,
  add column if not exists skill_level text not null default 'all',
  add column if not exists club_id uuid references public.clubs(id) on delete set null;

alter table public.clubs enable row level security;
alter table public.club_members enable row level security;

alter table public.leagues
  drop constraint if exists leagues_skill_level_check;

alter table public.leagues
  add constraint leagues_skill_level_check
  check (skill_level in ('beginner', 'intermediate', 'advanced', 'all'));

drop policy if exists "clubs_select_member" on public.clubs;
create policy "clubs_select_member" on public.clubs
  for select using (
    exists (
      select 1 from public.club_members cm
      where cm.club_id = id and cm.user_id = auth.uid()
    )
  );

drop policy if exists "club_members_select" on public.club_members;
create policy "club_members_select" on public.club_members
  for select using (
    user_id = auth.uid()
    or exists (
      select 1 from public.club_members cm
      where cm.club_id = club_id and cm.user_id = auth.uid()
    )
  );

-- ---------- Member handicaps ----------

alter table public.league_members
  add column if not exists handicap_index numeric(4, 1) not null default 0;

-- ---------- Doubles pairs ----------

create table if not exists public.league_pairs (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  name text,
  player1_id uuid not null references public.profiles(id) on delete cascade,
  player2_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint league_pairs_distinct_players check (player1_id <> player2_id),
  constraint league_pairs_unique_pair unique (league_id, player1_id, player2_id)
);

create index if not exists league_pairs_league_idx on public.league_pairs (league_id);

alter table public.league_pairs enable row level security;

drop policy if exists "league_pairs_select_member" on public.league_pairs;
create policy "league_pairs_select_member" on public.league_pairs
  for select using (
    exists (
      select 1 from public.league_members lm
      where lm.league_id = league_id and lm.user_id = auth.uid()
    )
  );

-- ---------- Announcements ----------

create table if not exists public.league_announcements (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  body text not null,
  created_at timestamptz not null default now(),
  constraint league_announcements_title_len check (char_length(trim(title)) between 1 and 120),
  constraint league_announcements_body_len check (char_length(trim(body)) between 1 and 2000)
);

create index if not exists league_announcements_league_idx
  on public.league_announcements (league_id, created_at desc);

alter table public.league_announcements enable row level security;

drop policy if exists "league_announcements_select_member" on public.league_announcements;
create policy "league_announcements_select_member" on public.league_announcements
  for select using (
    exists (
      select 1 from public.league_members lm
      where lm.league_id = league_id and lm.user_id = auth.uid()
    )
  );

-- ---------- League chat ----------

create table if not exists public.league_messages (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  constraint league_messages_body_len check (char_length(trim(body)) between 1 and 2000)
);

create index if not exists league_messages_league_idx
  on public.league_messages (league_id, created_at desc);

alter table public.league_messages enable row level security;

drop policy if exists "league_messages_select_member" on public.league_messages;
create policy "league_messages_select_member" on public.league_messages
  for select using (
    exists (
      select 1 from public.league_members lm
      where lm.league_id = league_id and lm.user_id = auth.uid()
    )
  );

-- ---------- Ace pot ----------

create table if not exists public.league_pots (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null unique references public.leagues(id) on delete cascade,
  label text not null default 'Ace pot',
  balance_cents integer not null default 0 check (balance_cents >= 0),
  entry_fee_cents integer not null default 0 check (entry_fee_cents >= 0),
  updated_at timestamptz not null default now()
);

create table if not exists public.league_pot_entries (
  id uuid primary key default gen_random_uuid(),
  pot_id uuid not null references public.league_pots(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  amount_cents integer not null,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists league_pot_entries_pot_idx
  on public.league_pot_entries (pot_id, created_at desc);

alter table public.league_pots enable row level security;
alter table public.league_pot_entries enable row level security;

drop policy if exists "league_pots_select_member" on public.league_pots;
create policy "league_pots_select_member" on public.league_pots
  for select using (
    exists (
      select 1 from public.league_members lm
      where lm.league_id = league_id and lm.user_id = auth.uid()
    )
  );

drop policy if exists "league_pot_entries_select_member" on public.league_pot_entries;
create policy "league_pot_entries_select_member" on public.league_pot_entries
  for select using (
    exists (
      select 1 from public.league_pots lp
      join public.league_members lm on lm.league_id = lp.league_id and lm.user_id = auth.uid()
      where lp.id = pot_id
    )
  );

-- ---------- Helpers ----------

create or replace function public.is_league_admin(p_league_id uuid, p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.league_members
    where league_id = p_league_id and user_id = p_user_id and role = 'admin'
  );
$$;

create or replace function public.is_league_member(p_league_id uuid, p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.league_members
    where league_id = p_league_id and user_id = p_user_id
  );
$$;

create or replace function public.calc_handicap_index(p_user_id uuid)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    round(greatest(0, least(36, avg(pt.score_to_par) * 0.85)), 1),
    0
  )
  from (
    select pt.score_to_par
    from public.round_player_totals pt
    join public.rounds r on r.id = pt.round_id and r.status = 'completed'
    where pt.user_id = p_user_id and pt.holes_scored >= 9
    order by r.ended_at desc nulls last
    limit 10
  ) pt;
$$;

create or replace function public.refresh_league_handicaps(p_league_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_count integer := 0;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if not public.is_league_member(p_league_id) then
    raise exception 'Not a league member';
  end if;

  update public.league_members lm
  set handicap_index = public.calc_handicap_index(lm.user_id)
  where lm.league_id = p_league_id;

  get diagnostics updated_count = row_count;
  return updated_count;
end;
$$;

-- ---------- Public discovery ----------

create or replace function public.discover_public_leagues(p_limit integer default 20)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  return coalesce((
    select jsonb_agg(row_to_json(x) order by x.member_count desc, x.name)
    from (
      select
        lg.id,
        lg.name,
        lg.description,
        lg.location,
        lg.format,
        lg.play_mode,
        lg.skill_level,
        lg.handicap_enabled,
        lg.season_start,
        lg.season_end,
        lg.invite_code,
        (select count(*) from public.league_members lm2 where lm2.league_id = lg.id) as member_count,
        coalesce(
          nullif(trim(creator.display_name), ''),
          split_part(creator.email, '@', 1)
        ) as creator_name
      from public.leagues lg
      join public.profiles creator on creator.id = lg.created_by
      where lg.is_public = true
        and current_date <= lg.season_end
        and not exists (
          select 1 from public.league_members lm
          where lm.league_id = lg.id and lm.user_id = auth.uid()
        )
      order by member_count desc, lg.name
      limit greatest(1, least(p_limit, 50))
    ) x
  ), '[]'::jsonb);
end;
$$;

-- ---------- Clubs ----------

create or replace function public.create_club(
  p_name text,
  p_description text default null,
  p_location text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  cid uuid;
  code text;
begin
  if uid is null then raise exception 'Not authenticated'; end if;
  insert into public.clubs (name, description, location, created_by)
  values (trim(p_name), nullif(trim(p_description), ''), nullif(trim(p_location), ''), uid)
  returning id, invite_code into cid, code;
  insert into public.club_members (club_id, user_id, role) values (cid, uid, 'admin');
  return jsonb_build_object('id', cid, 'invite_code', code);
end;
$$;

create or replace function public.join_club(p_invite_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  cid uuid;
begin
  if uid is null then raise exception 'Not authenticated'; end if;
  select id into cid from public.clubs where invite_code = lower(trim(p_invite_code));
  if cid is null then raise exception 'Invalid club invite code'; end if;
  insert into public.club_members (club_id, user_id, role)
  values (cid, uid, 'member')
  on conflict do nothing;
  return cid;
end;
$$;

create or replace function public.list_my_clubs()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  return coalesce((
    select jsonb_agg(row_to_json(c) order by c.name)
    from (
      select
        cl.id,
        cl.name,
        cl.description,
        cl.location,
        cl.invite_code,
        cm.role as my_role,
        (select count(*) from public.club_members cm2 where cm2.club_id = cl.id) as member_count
      from public.clubs cl
      join public.club_members cm on cm.club_id = cl.id and cm.user_id = auth.uid()
    ) c
  ), '[]'::jsonb);
end;
$$;

-- ---------- Pairs ----------

create or replace function public.create_league_pair(
  p_league_id uuid,
  p_player1_id uuid,
  p_player2_id uuid,
  p_name text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  pid uuid;
  a uuid;
  b uuid;
begin
  if uid is null then raise exception 'Not authenticated'; end if;
  if not public.is_league_admin(p_league_id) then
    raise exception 'Only league admins can manage pairs';
  end if;
  if p_player1_id = p_player2_id then raise exception 'Pair must be two different players'; end if;
  if not exists (select 1 from public.league_members where league_id = p_league_id and user_id = p_player1_id)
    or not exists (select 1 from public.league_members where league_id = p_league_id and user_id = p_player2_id)
  then
    raise exception 'Both players must be league members';
  end if;
  a := least(p_player1_id, p_player2_id);
  b := greatest(p_player1_id, p_player2_id);
  insert into public.league_pairs (league_id, name, player1_id, player2_id)
  values (p_league_id, nullif(trim(p_name), ''), a, b)
  returning id into pid;
  return pid;
end;
$$;

create or replace function public.delete_league_pair(p_pair_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  lid uuid;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  select league_id into lid from public.league_pairs where id = p_pair_id;
  if lid is null then raise exception 'Pair not found'; end if;
  if not public.is_league_admin(lid) then raise exception 'Only league admins can manage pairs'; end if;
  delete from public.league_pairs where id = p_pair_id;
end;
$$;

create or replace function public.list_league_pairs(p_league_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if not public.is_league_member(p_league_id) then raise exception 'Not a league member'; end if;
  return coalesce((
    select jsonb_agg(row_to_json(p) order by coalesce(p.name, p.player1_name))
    from (
      select
        lp.id,
        lp.name,
        lp.player1_id,
        lp.player2_id,
        coalesce(nullif(trim(p1.display_name), ''), split_part(p1.email, '@', 1)) as player1_name,
        coalesce(nullif(trim(p2.display_name), ''), split_part(p2.email, '@', 1)) as player2_name
      from public.league_pairs lp
      join public.profiles p1 on p1.id = lp.player1_id
      join public.profiles p2 on p2.id = lp.player2_id
      where lp.league_id = p_league_id
    ) p
  ), '[]'::jsonb);
end;
$$;

-- ---------- Announcements ----------

create or replace function public.post_league_announcement(
  p_league_id uuid,
  p_title text,
  p_body text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  aid uuid;
  member record;
  league_name text;
begin
  if uid is null then raise exception 'Not authenticated'; end if;
  if not public.is_league_admin(p_league_id) then
    raise exception 'Only league admins can post announcements';
  end if;
  select name into league_name from public.leagues where id = p_league_id;
  insert into public.league_announcements (league_id, author_id, title, body)
  values (p_league_id, uid, trim(p_title), trim(p_body))
  returning id into aid;

  for member in
    select user_id from public.league_members
    where league_id = p_league_id and user_id <> uid
  loop
    perform public.create_user_notification(
      member.user_id,
      'league_update',
      coalesce(league_name, 'League') || ': ' || trim(p_title),
      left(trim(p_body), 240),
      '/leagues',
      jsonb_build_object('league_id', p_league_id, 'announcement_id', aid)
    );
  end loop;

  return aid;
end;
$$;

create or replace function public.list_league_announcements(p_league_id uuid, p_limit integer default 20)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if not public.is_league_member(p_league_id) then raise exception 'Not a league member'; end if;
  return coalesce((
    select jsonb_agg(row_to_json(a) order by a.created_at desc)
    from (
      select
        la.id,
        la.title,
        la.body,
        la.created_at,
        coalesce(nullif(trim(p.display_name), ''), split_part(p.email, '@', 1)) as author_name
      from public.league_announcements la
      join public.profiles p on p.id = la.author_id
      where la.league_id = p_league_id
      order by la.created_at desc
      limit greatest(1, least(p_limit, 50))
    ) a
  ), '[]'::jsonb);
end;
$$;

-- ---------- League chat ----------

create or replace function public.send_league_message(p_league_id uuid, p_body text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  mid uuid;
begin
  if uid is null then raise exception 'Not authenticated'; end if;
  if not public.is_league_member(p_league_id) then raise exception 'Not a league member'; end if;
  if length(trim(p_body)) = 0 then raise exception 'Message cannot be empty'; end if;
  insert into public.league_messages (league_id, sender_id, body)
  values (p_league_id, uid, trim(p_body))
  returning id into mid;
  return mid;
end;
$$;

create or replace function public.list_league_messages(p_league_id uuid, p_limit integer default 50)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if not public.is_league_member(p_league_id) then raise exception 'Not a league member'; end if;
  return coalesce((
    select jsonb_agg(row_to_json(m) order by m.created_at asc)
    from (
      select
        lm.id,
        lm.body,
        lm.created_at,
        lm.sender_id,
        coalesce(nullif(trim(p.display_name), ''), split_part(p.email, '@', 1)) as sender_name
      from public.league_messages lm
      join public.profiles p on p.id = lm.sender_id
      where lm.league_id = p_league_id
      order by lm.created_at desc
      limit greatest(1, least(p_limit, 100))
    ) m
  ), '[]'::jsonb);
end;
$$;

-- ---------- Ace pot ----------

create or replace function public.get_league_pot(p_league_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  pot record;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if not public.is_league_member(p_league_id) then raise exception 'Not a league member'; end if;

  insert into public.league_pots (league_id)
  values (p_league_id)
  on conflict (league_id) do nothing;

  select * into pot from public.league_pots where league_id = p_league_id;
  return jsonb_build_object(
    'id', pot.id,
    'label', pot.label,
    'balance_cents', pot.balance_cents,
    'entry_fee_cents', pot.entry_fee_cents
  );
end;
$$;

create or replace function public.add_league_pot_entry(
  p_league_id uuid,
  p_amount_cents integer,
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  pot_id uuid;
  eid uuid;
begin
  if uid is null then raise exception 'Not authenticated'; end if;
  if not public.is_league_member(p_league_id) then raise exception 'Not a league member'; end if;
  if p_amount_cents = 0 then raise exception 'Amount cannot be zero'; end if;

  insert into public.league_pots (league_id) values (p_league_id)
  on conflict (league_id) do nothing;

  select id into pot_id from public.league_pots where league_id = p_league_id;

  insert into public.league_pot_entries (pot_id, user_id, amount_cents, note)
  values (pot_id, uid, p_amount_cents, nullif(trim(p_note), ''))
  returning id into eid;

  update public.league_pots
  set balance_cents = balance_cents + p_amount_cents, updated_at = now()
  where id = pot_id;

  return eid;
end;
$$;

create or replace function public.list_league_pot_entries(p_league_id uuid, p_limit integer default 30)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if not public.is_league_member(p_league_id) then raise exception 'Not a league member'; end if;
  return coalesce((
    select jsonb_agg(row_to_json(e) order by e.created_at desc)
    from (
      select
        pe.id,
        pe.amount_cents,
        pe.note,
        pe.created_at,
        coalesce(nullif(trim(p.display_name), ''), split_part(p.email, '@', 1)) as player_name
      from public.league_pot_entries pe
      join public.league_pots lp on lp.id = pe.pot_id
      join public.profiles p on p.id = pe.user_id
      where lp.league_id = p_league_id
      order by pe.created_at desc
      limit greatest(1, least(p_limit, 100))
    ) e
  ), '[]'::jsonb);
end;
$$;

-- ---------- Rivalries & streaks ----------

create or replace function public.get_league_rivalries(p_league_id uuid, p_limit integer default 10)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if not public.is_league_member(p_league_id) then raise exception 'Not a league member'; end if;
  return coalesce((
    select jsonb_agg(row_to_json(r) order by r.shared_rounds desc)
    from (
      select
        least(a.user_id, b.user_id) as user_a_id,
        greatest(a.user_id, b.user_id) as user_b_id,
        pa.display_name as user_a_name,
        pb.display_name as user_b_name,
        count(*) as shared_rounds,
        count(*) filter (where a.score_to_par < b.score_to_par) as a_wins,
        count(*) filter (where b.score_to_par < a.score_to_par) as b_wins
      from public.league_round_submissions lrs_a
      join public.league_round_submissions lrs_b
        on lrs_b.league_id = lrs_a.league_id and lrs_b.round_id = lrs_a.round_id
        and lrs_b.submitted_by > lrs_a.submitted_by
      join public.round_player_totals a
        on a.round_id = lrs_a.round_id and a.user_id = lrs_a.submitted_by
      join public.round_player_totals b
        on b.round_id = lrs_b.round_id and b.user_id = lrs_b.submitted_by
      join public.profiles pa on pa.id = lrs_a.submitted_by
      join public.profiles pb on pb.id = lrs_b.submitted_by
      where lrs_a.league_id = p_league_id
      group by 1, 2, 3, 4
      having count(*) >= 1
      order by count(*) desc
      limit greatest(1, least(p_limit, 25))
    ) r
  ), '[]'::jsonb);
end;
$$;

create or replace function public.get_league_streaks(p_league_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if not public.is_league_member(p_league_id) then raise exception 'Not a league member'; end if;
  return coalesce((
    select jsonb_agg(row_to_json(s) order by s.submitted_rounds desc)
    from (
      select
        lm.user_id,
        coalesce(nullif(trim(p.display_name), ''), split_part(p.email, '@', 1)) as display_name,
        count(lrs.id) as submitted_rounds,
        round(avg(pt.score_to_par), 1) as avg_score_to_par
      from public.league_members lm
      join public.profiles p on p.id = lm.user_id
      left join public.league_round_submissions lrs
        on lrs.league_id = lm.league_id and lrs.submitted_by = lm.user_id
      left join public.round_player_totals pt
        on pt.round_id = lrs.round_id and pt.user_id = lm.user_id
      where lm.league_id = p_league_id
      group by lm.user_id, p.display_name, p.email
      having count(lrs.id) >= 2
    ) s
  ), '[]'::jsonb);
end;
$$;

-- ---------- Pair standings (doubles) ----------

create or replace function public.get_league_pair_standings(p_league_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if not public.is_league_member(p_league_id) then raise exception 'Not a league member'; end if;
  return coalesce((
    select jsonb_agg(row_to_json(s) order by s.rank)
    from (
      select
        lp.id as pair_id,
        coalesce(lp.name, p1n.name || ' & ' || p2n.name) as pair_name,
        count(distinct lrs.round_id) as rounds_together,
        round(avg(pt1.score_to_par + pt2.score_to_par), 1) as avg_combined_to_par,
        row_number() over (order by avg(pt1.score_to_par + pt2.score_to_par) nulls last) as rank
      from public.league_pairs lp
      join public.profiles p1n on p1n.id = lp.player1_id
      join public.profiles p2n on p2n.id = lp.player2_id
      left join public.league_round_submissions lrs1
        on lrs1.league_id = lp.league_id and lrs1.submitted_by = lp.player1_id
      left join public.league_round_submissions lrs2
        on lrs2.league_id = lp.league_id and lrs2.submitted_by = lp.player2_id
        and lrs2.round_id = lrs1.round_id
      left join public.league_round_submissions lrs on lrs.id = lrs1.id
      left join public.round_player_totals pt1
        on pt1.round_id = lrs.round_id and pt1.user_id = lp.player1_id
      left join public.round_player_totals pt2
        on pt2.round_id = lrs.round_id and pt2.user_id = lp.player2_id
      where lp.league_id = p_league_id
      group by lp.id, lp.name, p1n.display_name, p1n.email, p2n.display_name, p2n.email
    ) s
  ), '[]'::jsonb);
end;
$$;

-- ---------- Standings with handicap + min rounds ----------

create or replace function public.get_league_standings(p_league_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  fmt text;
  hc boolean;
  min_r smallint;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if not public.is_league_member(p_league_id) then raise exception 'Not a league member'; end if;

  select format, handicap_enabled, min_rounds
  into fmt, hc, min_r
  from public.leagues where id = p_league_id;

  if fmt = 'stableford' then
    return coalesce((
      select jsonb_agg(row_to_json(s) order by s.rank)
      from (
        select
          lm.user_id,
          coalesce(nullif(trim(p.display_name), ''), split_part(p.email, '@', 1)) as display_name,
          count(lrs.id) as rounds_submitted,
          round(avg(sf.sf_points), 1) as avg_stableford_points,
          max(sf.sf_points) as best_stableford_points,
          null::numeric as avg_score_to_par,
          null::integer as best_score_to_par,
          null::numeric as avg_net_score_to_par,
          (count(lrs.id) >= min_r) as qualified,
          row_number() over (
            order by avg(sf.sf_points) desc nulls last, max(sf.sf_points) desc nulls last
          ) as rank
        from public.league_members lm
        join public.profiles p on p.id = lm.user_id
        left join public.league_round_submissions lrs
          on lrs.league_id = lm.league_id and lrs.submitted_by = lm.user_id
        left join lateral (
          select coalesce(sum(public.stableford_points(rs.strokes, rs.par)), 0) as sf_points
          from public.round_scores rs
          join public.round_players rp on rp.id = rs.round_player_id
          where rs.round_id = lrs.round_id and rp.user_id = lm.user_id
        ) sf on lrs.id is not null
        where lm.league_id = p_league_id
        group by lm.user_id, p.display_name, p.email
      ) s
      where s.qualified or min_r = 0
    ), '[]'::jsonb);
  end if;

  return coalesce((
    select jsonb_agg(row_to_json(s) order by s.rank)
    from (
      select
        lm.user_id,
        coalesce(nullif(trim(p.display_name), ''), split_part(p.email, '@', 1)) as display_name,
        count(lrs.id) as rounds_submitted,
        null::numeric as avg_stableford_points,
        null::numeric as best_stableford_points,
        round(avg(pt.score_to_par), 1) as avg_score_to_par,
        min(pt.score_to_par) as best_score_to_par,
        case
          when hc then round(avg(pt.score_to_par - coalesce(lm.handicap_index, 0)), 1)
          else null
        end as avg_net_score_to_par,
        lm.handicap_index,
        (count(lrs.id) >= min_r) as qualified,
        row_number() over (
          order by
            case when hc then avg(pt.score_to_par - coalesce(lm.handicap_index, 0)) else avg(pt.score_to_par) end nulls last,
            min(pt.score_to_par)
        ) as rank
      from public.league_members lm
      join public.profiles p on p.id = lm.user_id
      left join public.league_round_submissions lrs
        on lrs.league_id = lm.league_id and lrs.submitted_by = lm.user_id
      left join public.round_player_totals pt
        on pt.round_id = lrs.round_id and pt.user_id = lm.user_id
      where lm.league_id = p_league_id
      group by lm.user_id, p.display_name, p.email, lm.handicap_index
    ) s
    where s.qualified or min_r = 0
  ), '[]'::jsonb);
end;
$$;

-- ---------- Extend create/update/list leagues ----------

create or replace function public.create_league(
  p_name text,
  p_season_start date,
  p_season_end date,
  p_format text default 'stroke',
  p_description text default null,
  p_location text default null,
  p_rules text default null,
  p_play_mode text default 'singles',
  p_handicap_enabled boolean default false,
  p_min_rounds smallint default 0,
  p_is_public boolean default false,
  p_skill_level text default 'all',
  p_club_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  lid uuid;
  code text;
begin
  if uid is null then raise exception 'Not authenticated'; end if;
  if p_season_end < p_season_start then
    raise exception 'Season end must be on or after season start';
  end if;

  insert into public.leagues (
    name, created_by, season_start, season_end, format,
    description, location, rules, play_mode, handicap_enabled, min_rounds,
    is_public, skill_level, club_id
  )
  values (
    trim(p_name), uid, p_season_start, p_season_end, coalesce(p_format, 'stroke'),
    nullif(trim(p_description), ''), nullif(trim(p_location), ''), nullif(trim(p_rules), ''),
    coalesce(p_play_mode, 'singles'), coalesce(p_handicap_enabled, false), coalesce(p_min_rounds, 0),
    coalesce(p_is_public, false), coalesce(p_skill_level, 'all'), p_club_id
  )
  returning id, invite_code into lid, code;

  insert into public.league_members (league_id, user_id, role) values (lid, uid, 'admin');
  insert into public.league_pots (league_id) values (lid) on conflict do nothing;

  if coalesce(p_handicap_enabled, false) then
    perform public.refresh_league_handicaps(lid);
  end if;

  return jsonb_build_object('id', lid, 'invite_code', code);
end;
$$;

create or replace function public.update_league(
  p_league_id uuid,
  p_name text default null,
  p_season_start date default null,
  p_season_end date default null,
  p_format text default null,
  p_description text default null,
  p_location text default null,
  p_rules text default null,
  p_update_info boolean default false,
  p_play_mode text default null,
  p_handicap_enabled boolean default null,
  p_min_rounds smallint default null,
  p_update_settings boolean default false,
  p_is_public boolean default null,
  p_skill_level text default null,
  p_club_id uuid default null,
  p_update_visibility boolean default false
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  cur record;
  new_start date;
  new_end date;
  new_handicap boolean;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if not public.is_league_admin(p_league_id) then
    raise exception 'Only league admins can edit this league';
  end if;

  select * into cur from public.leagues where id = p_league_id;
  if cur.id is null then raise exception 'League not found'; end if;

  new_start := coalesce(p_season_start, cur.season_start);
  new_end := coalesce(p_season_end, cur.season_end);
  new_handicap := coalesce(p_handicap_enabled, cur.handicap_enabled);

  update public.leagues
  set
    name = coalesce(nullif(trim(p_name), ''), name),
    season_start = new_start,
    season_end = new_end,
    format = coalesce(p_format, format),
    description = case when p_update_info then nullif(trim(p_description), '') else description end,
    location = case when p_update_info then nullif(trim(p_location), '') else location end,
    rules = case when p_update_info then nullif(trim(p_rules), '') else rules end,
    play_mode = case when p_update_settings then coalesce(p_play_mode, play_mode) else play_mode end,
    handicap_enabled = case when p_update_settings then coalesce(p_handicap_enabled, handicap_enabled) else handicap_enabled end,
    min_rounds = case when p_update_settings then coalesce(p_min_rounds, min_rounds) else min_rounds end,
    is_public = case when p_update_visibility then coalesce(p_is_public, is_public) else is_public end,
    skill_level = case when p_update_visibility then coalesce(p_skill_level, skill_level) else skill_level end,
    club_id = case when p_update_visibility then p_club_id else club_id end
  where id = p_league_id;

  if new_handicap and (p_update_settings or p_handicap_enabled is not null) then
    perform public.refresh_league_handicaps(p_league_id);
  end if;
end;
$$;

create or replace function public.list_my_leagues()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  return coalesce((
    select jsonb_agg(row_to_json(l) order by l.season_end desc, l.name)
    from (
      select
        lg.*,
        lm.role as my_role,
        coalesce(nullif(trim(creator.display_name), ''), split_part(creator.email, '@', 1)) as creator_name,
        (select count(*) from public.league_members lm2 where lm2.league_id = lg.id) as member_count,
        (select count(*) from public.league_round_submissions lrs where lrs.league_id = lg.id) as rounds_submitted,
        (select count(distinct lrs.submitted_by) from public.league_round_submissions lrs where lrs.league_id = lg.id) as players_with_rounds,
        (select count(*) from public.league_round_submissions lrs where lrs.league_id = lg.id and lrs.submitted_by = auth.uid()) as my_rounds_submitted,
        (
          select coalesce(nullif(trim(p.display_name), ''), split_part(p.email, '@', 1))
          from (
            select lrs.submitted_by,
              case when lg.format = 'stableford' then -1 * avg(coalesce((
                select sum(public.stableford_points(rs.strokes, rs.par))
                from public.round_scores rs
                join public.round_players rp on rp.id = rs.round_player_id
                where rs.round_id = lrs.round_id and rp.user_id = lrs.submitted_by
              ), 0)) else avg(pt.score_to_par) end as rank_score
            from public.league_round_submissions lrs
            join public.round_player_totals pt on pt.round_id = lrs.round_id and pt.user_id = lrs.submitted_by
            where lrs.league_id = lg.id
            group by lrs.submitted_by
            order by rank_score nulls last
            limit 1
          ) lead
          join public.profiles p on p.id = lead.submitted_by
        ) as leader_name
      from public.leagues lg
      join public.league_members lm on lm.league_id = lg.id and lm.user_id = auth.uid()
      join public.profiles creator on creator.id = lg.created_by
    ) l
  ), '[]'::jsonb);
end;
$$;

-- Auto-refresh handicaps on round submit
create or replace function public.submit_round_to_league(
  p_league_id uuid,
  p_round_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  hc boolean;
begin
  if uid is null then raise exception 'Not authenticated'; end if;
  if not public.is_league_member(p_league_id) then raise exception 'Not a league member'; end if;
  if not exists (
    select 1 from public.rounds r
    where r.id = p_round_id and r.status = 'completed'
      and (r.user_id = uid or exists (
        select 1 from public.round_players rp where rp.round_id = p_round_id and rp.user_id = uid
      ))
  ) then raise exception 'Invalid round'; end if;

  insert into public.league_round_submissions (league_id, round_id, submitted_by)
  values (p_league_id, p_round_id, uid)
  on conflict (league_id, round_id) do nothing;

  select handicap_enabled into hc from public.leagues where id = p_league_id;
  if hc then
    update public.league_members
    set handicap_index = public.calc_handicap_index(user_id)
    where league_id = p_league_id and user_id = uid;
  end if;
end;
$$;

drop policy if exists "leagues_select_public" on public.leagues;
create policy "leagues_select_public" on public.leagues
  for select using (
    is_public = true
    or exists (
      select 1 from public.league_members lm
      where lm.league_id = id and lm.user_id = auth.uid()
    )
  );

grant execute on function public.discover_public_leagues(integer) to authenticated;
grant execute on function public.create_club(text, text, text) to authenticated;
grant execute on function public.join_club(text) to authenticated;
grant execute on function public.list_my_clubs() to authenticated;
grant execute on function public.create_league_pair(uuid, uuid, uuid, text) to authenticated;
grant execute on function public.delete_league_pair(uuid) to authenticated;
grant execute on function public.list_league_pairs(uuid) to authenticated;
grant execute on function public.post_league_announcement(uuid, text, text) to authenticated;
grant execute on function public.list_league_announcements(uuid, integer) to authenticated;
grant execute on function public.send_league_message(uuid, text) to authenticated;
grant execute on function public.list_league_messages(uuid, integer) to authenticated;
grant execute on function public.get_league_pot(uuid) to authenticated;
grant execute on function public.add_league_pot_entry(uuid, integer, text) to authenticated;
grant execute on function public.list_league_pot_entries(uuid, integer) to authenticated;
grant execute on function public.get_league_rivalries(uuid, integer) to authenticated;
grant execute on function public.get_league_streaks(uuid) to authenticated;
grant execute on function public.get_league_pair_standings(uuid) to authenticated;
grant execute on function public.refresh_league_handicaps(uuid) to authenticated;
grant execute on function public.create_league(text, date, date, text, text, text, text, text, boolean, smallint, boolean, text, uuid) to authenticated;
grant execute on function public.update_league(uuid, text, date, date, text, text, text, text, boolean, text, boolean, smallint, boolean, boolean, text, uuid, boolean) to authenticated;
