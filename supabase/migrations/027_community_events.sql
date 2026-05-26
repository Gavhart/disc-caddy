-- Disc Caddy 027: Community events within 75mi, pickup posts, host attendee lists

alter table public.scheduled_rounds
  add column if not exists post_type text not null default 'event'
    check (post_type in ('event', 'pickup'));

comment on column public.scheduled_rounds.post_type is
  '"event" = posted event; "pickup" = looking for players at a time & place';

-- ---------- create (add post_type) ----------

drop function if exists public.create_scheduled_round(uuid, timestamptz, integer, text, text);

create or replace function public.create_scheduled_round(
  p_course_id uuid,
  p_scheduled_at timestamptz,
  p_max_players integer,
  p_visibility text,
  p_notes text,
  p_post_type text default 'event'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  sid uuid;
  course_name text;
  kind text := coalesce(nullif(trim(p_post_type), ''), 'event');
begin
  if uid is null then raise exception 'Not authenticated'; end if;
  if kind not in ('event', 'pickup') then raise exception 'Invalid post type'; end if;
  if p_course_id is null then raise exception 'Course is required'; end if;
  if p_scheduled_at is null or p_scheduled_at < now() - interval '1 hour' then
    raise exception 'Scheduled time must be in the future';
  end if;

  insert into public.scheduled_rounds (
    host_id, course_id, scheduled_at, max_players, visibility, notes, post_type
  )
  values (
    uid,
    p_course_id,
    p_scheduled_at,
    coalesce(p_max_players, 4),
    coalesce(p_visibility, 'community'),
    nullif(trim(p_notes), ''),
    kind
  )
  returning id into sid;

  insert into public.scheduled_round_rsvps (scheduled_round_id, user_id, status)
  values (sid, uid, 'going');

  select c.name into course_name from public.courses c where c.id = p_course_id;

  perform public.create_user_notification(
    uid,
    'scheduled_round',
    case when kind = 'pickup' then 'Pickup post live' else 'Event posted' end,
    case when kind = 'pickup'
      then 'Your pickup round'
      else 'Your event'
    end
    || case when course_name is not null then ' at ' || course_name else '' end
    || ' is on the calendar.',
    '/community/events',
    jsonb_build_object('scheduled_round_id', sid, 'post_type', kind)
  );

  return sid;
end;
$$;

-- ---------- list with 75mi radius ----------

drop function if exists public.list_scheduled_rounds(integer);

create or replace function public.list_scheduled_rounds(
  p_limit integer default 30,
  p_radius_miles integer default 75,
  p_post_type text default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  radius integer := coalesce(p_radius_miles, 75);
begin
  if uid is null then raise exception 'Not authenticated'; end if;

  return coalesce((
    select jsonb_agg(row_to_json(s) order by s.scheduled_at)
    from (
      select
        sr.id,
        sr.host_id,
        coalesce(nullif(trim(p.display_name), ''), split_part(p.email, '@', 1)) as host_name,
        sr.course_id,
        c.name as course_name,
        c.locality as course_locality,
        sr.scheduled_at,
        sr.max_players,
        sr.visibility,
        sr.status,
        sr.notes,
        sr.round_id,
        sr.post_type,
        (
          select min(public.haversine_miles(hc.latitude, hc.longitude, c.lat, c.lon))
          from public.profile_home_cities hc
          where hc.user_id = uid
            and hc.latitude is not null and hc.longitude is not null
            and c.lat is not null and c.lon is not null
        ) as distance_miles,
        (select count(*)::integer from public.scheduled_round_rsvps r
         where r.scheduled_round_id = sr.id and r.status = 'going') as going_count,
        (select r.status from public.scheduled_round_rsvps r
         where r.scheduled_round_id = sr.id and r.user_id = uid) as my_rsvp
      from public.scheduled_rounds sr
      join public.profiles p on p.id = sr.host_id
      left join public.courses c on c.id = sr.course_id
      where sr.status in ('open', 'full')
        and sr.scheduled_at > now() - interval '1 day'
        and (p_post_type is null or sr.post_type = p_post_type)
        and (
          sr.host_id = uid
          or (
            sr.visibility = 'community'
            and c.lat is not null and c.lon is not null
            and exists (
              select 1 from public.profile_home_cities hc
              where hc.user_id = uid
                and hc.latitude is not null and hc.longitude is not null
                and public.haversine_miles(hc.latitude, hc.longitude, c.lat, c.lon) <= radius
            )
          )
          or (
            sr.visibility = 'friends'
            and exists (
              select 1 from public.friend_requests fr
              where fr.status = 'accepted'
                and (
                  (fr.from_user_id = sr.host_id and fr.to_user_id = uid)
                  or (fr.to_user_id = sr.host_id and fr.from_user_id = uid)
                )
            )
            and c.lat is not null and c.lon is not null
            and exists (
              select 1 from public.profile_home_cities hc
              where hc.user_id = uid
                and hc.latitude is not null and hc.longitude is not null
                and public.haversine_miles(hc.latitude, hc.longitude, c.lat, c.lon) <= radius
            )
          )
        )
      order by sr.scheduled_at
      limit coalesce(p_limit, 30)
    ) s
  ), '[]'::jsonb);
end;
$$;

-- ---------- host attendee list ----------

create or replace function public.list_scheduled_round_attendees(
  p_scheduled_round_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  host uuid;
begin
  if uid is null then raise exception 'Not authenticated'; end if;

  select sr.host_id into host
  from public.scheduled_rounds sr
  where sr.id = p_scheduled_round_id;

  if host is null then raise exception 'Event not found'; end if;
  if host <> uid then raise exception 'Only the host can view attendees'; end if;

  return coalesce((
    select jsonb_agg(row_to_json(a) order by a.sort_order, a.display_name)
    from (
      select
        r.user_id,
        coalesce(nullif(trim(p.display_name), ''), split_part(p.email, '@', 1)) as display_name,
        r.status,
        r.created_at,
        case r.status when 'going' then 0 when 'maybe' then 1 else 2 end as sort_order
      from public.scheduled_round_rsvps r
      join public.profiles p on p.id = r.user_id
      where r.scheduled_round_id = p_scheduled_round_id
        and r.status in ('going', 'maybe')
    ) a
  ), '[]'::jsonb);
end;
$$;

-- ---------- cancel (host) ----------

create or replace function public.cancel_scheduled_round(p_scheduled_round_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Not authenticated'; end if;

  update public.scheduled_rounds sr
  set status = 'cancelled'
  where sr.id = p_scheduled_round_id and sr.host_id = uid;

  if not found then raise exception 'Event not found or not yours'; end if;
end;
$$;

-- ---------- RSVP with host notification + capacity ----------

create or replace function public.rsvp_scheduled_round(
  p_scheduled_round_id uuid,
  p_status text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  sr record;
  going_count integer;
  attendee_name text;
begin
  if uid is null then raise exception 'Not authenticated'; end if;
  if p_status not in ('going', 'maybe', 'declined') then
    raise exception 'Invalid RSVP status';
  end if;

  select sr.*, c.name as course_name
  into sr
  from public.scheduled_rounds sr
  left join public.courses c on c.id = sr.course_id
  where sr.id = p_scheduled_round_id;

  if sr.id is null then raise exception 'Event not found'; end if;
  if sr.status = 'cancelled' then raise exception 'Event was cancelled'; end if;

  if p_status = 'going' and sr.host_id <> uid then
    select count(*)::integer into going_count
    from public.scheduled_round_rsvps r
    where r.scheduled_round_id = p_scheduled_round_id
      and r.status = 'going';

    if going_count >= sr.max_players then
      raise exception 'This event is full';
    end if;
  end if;

  insert into public.scheduled_round_rsvps (scheduled_round_id, user_id, status)
  values (p_scheduled_round_id, uid, p_status)
  on conflict (scheduled_round_id, user_id) do update set status = excluded.status;

  select count(*)::integer into going_count
  from public.scheduled_round_rsvps r
  where r.scheduled_round_id = p_scheduled_round_id and r.status = 'going';

  update public.scheduled_rounds
  set status = case when going_count >= max_players then 'full' else 'open' end
  where id = p_scheduled_round_id;

  if sr.host_id <> uid and p_status in ('going', 'maybe') then
    select coalesce(nullif(trim(p.display_name), ''), split_part(p.email, '@', 1))
    into attendee_name
    from public.profiles p where p.id = uid;

    perform public.create_user_notification(
      sr.host_id,
      'scheduled_round',
      case when p_status = 'going' then 'New attendee' else 'New maybe RSVP' end,
      attendee_name || ' is '
        || case when p_status = 'going' then 'going' else 'interested' end
        || case when sr.course_name is not null then ' to ' || sr.course_name else '' end
        || ' (' || going_count || '/' || sr.max_players || ').',
      '/community/events',
      jsonb_build_object('scheduled_round_id', p_scheduled_round_id)
    );
  end if;
end;
$$;

grant execute on function public.create_scheduled_round(uuid, timestamptz, integer, text, text, text) to authenticated;
grant execute on function public.list_scheduled_rounds(integer, integer, text) to authenticated;
grant execute on function public.list_scheduled_round_attendees(uuid) to authenticated;
grant execute on function public.cancel_scheduled_round(uuid) to authenticated;
grant execute on function public.rsvp_scheduled_round(uuid, text) to authenticated;
