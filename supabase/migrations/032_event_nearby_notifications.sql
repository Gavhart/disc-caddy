-- Disc Caddy 032: Notify nearby players when an event or pickup is posted

create or replace function public.notify_nearby_users_of_event(
  p_event_id uuid,
  p_host_id uuid,
  p_course_id uuid,
  p_post_type text,
  p_scheduled_at timestamptz
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  recipient record;
  host_name text;
  course_name text;
  c_lat double precision;
  c_lon double precision;
  title text;
  body text;
begin
  select coalesce(nullif(trim(p.display_name), ''), split_part(p.email, '@', 1))
  into host_name
  from public.profiles p
  where p.id = p_host_id;

  select c.name, c.lat, c.lon
  into course_name, c_lat, c_lon
  from public.courses c
  where c.id = p_course_id;

  if c_lat is null or c_lon is null then
    return;
  end if;

  title := case
    when p_post_type = 'pickup' then 'Pickup round near you'
    else 'New event near you'
  end;

  for recipient in
    select distinct p.id as user_id
    from public.profiles p
    join public.profile_home_cities hc on hc.user_id = p.id
    where p.id <> p_host_id
      and p.community_visible = true
      and hc.latitude is not null
      and hc.longitude is not null
      and public.haversine_miles(hc.latitude, hc.longitude, c_lat, c_lon) <= 75
  loop
    body := coalesce(host_name, 'Someone')
      || case when p_post_type = 'pickup' then ' wants players at ' else ' posted an event at ' end
      || coalesce(course_name, 'a course')
      || ' · '
      || to_char(p_scheduled_at at time zone 'UTC', 'Mon DD, HH12:MI AM');

    perform public.create_user_notification(
      recipient.user_id,
      'scheduled_round',
      title,
      body,
      '/community/events',
      jsonb_build_object(
        'scheduled_round_id', p_event_id,
        'post_type', p_post_type,
        'host_id', p_host_id
      )
    );
  end loop;
exception
  when others then
    raise warning 'notify_nearby_users_of_event failed: %', sqlerrm;
end;
$$;

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

  if coalesce(p_visibility, 'community') = 'community' then
    perform public.notify_nearby_users_of_event(sid, uid, p_course_id, kind, p_scheduled_at);
  end if;

  return sid;
end;
$$;

grant execute on function public.notify_nearby_users_of_event(uuid, uuid, uuid, text, timestamptz) to authenticated;
