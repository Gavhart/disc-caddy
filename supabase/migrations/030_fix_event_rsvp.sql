-- Disc Caddy 030: Fix event RSVP (record variable shadowing + resilient notifications)

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
  evt record;
  going_count integer;
  attendee_name text;
begin
  if uid is null then raise exception 'Not authenticated'; end if;
  if p_status not in ('going', 'maybe', 'declined') then
    raise exception 'Invalid RSVP status';
  end if;

  select r.*, c.name as course_name
  into evt
  from public.scheduled_rounds r
  left join public.courses c on c.id = r.course_id
  where r.id = p_scheduled_round_id;

  if evt.id is null then raise exception 'Event not found'; end if;
  if evt.status = 'cancelled' then raise exception 'Event was cancelled'; end if;

  if p_status = 'going' and evt.host_id <> uid then
    select count(*)::integer into going_count
    from public.scheduled_round_rsvps rsvp
    where rsvp.scheduled_round_id = p_scheduled_round_id
      and rsvp.status = 'going';

    if going_count >= evt.max_players
       and not exists (
         select 1 from public.scheduled_round_rsvps rsvp
         where rsvp.scheduled_round_id = p_scheduled_round_id
           and rsvp.user_id = uid
           and rsvp.status = 'going'
       )
    then
      raise exception 'This event is full';
    end if;
  end if;

  insert into public.scheduled_round_rsvps (scheduled_round_id, user_id, status)
  values (p_scheduled_round_id, uid, p_status)
  on conflict (scheduled_round_id, user_id) do update set status = excluded.status;

  select count(*)::integer into going_count
  from public.scheduled_round_rsvps rsvp
  where rsvp.scheduled_round_id = p_scheduled_round_id and rsvp.status = 'going';

  update public.scheduled_rounds
  set status = case when going_count >= max_players then 'full' else 'open' end
  where id = p_scheduled_round_id;

  if evt.host_id <> uid and p_status in ('going', 'maybe') then
    begin
      select coalesce(nullif(trim(p.display_name), ''), split_part(p.email, '@', 1))
      into attendee_name
      from public.profiles p where p.id = uid;

      perform public.create_user_notification(
        evt.host_id,
        'scheduled_round',
        case when p_status = 'going' then 'New attendee' else 'New maybe RSVP' end,
        attendee_name || ' is '
          || case when p_status = 'going' then 'going' else 'interested' end
          || case when evt.course_name is not null then ' to ' || evt.course_name else '' end
          || ' (' || going_count || '/' || evt.max_players || ').',
        '/community/events',
        jsonb_build_object('scheduled_round_id', p_scheduled_round_id)
      );
    exception
      when others then
        raise warning 'rsvp notification failed: %', sqlerrm;
    end;
  end if;
end;
$$;

-- Ensure notification kinds include scheduled_round (safe if 025 already applied)
alter table public.user_notifications drop constraint if exists user_notifications_kind_check;
alter table public.user_notifications add constraint user_notifications_kind_check
  check (kind in (
    'scorecard_invite', 'community_message', 'friend_activity', 'round_invite',
    'scheduled_round', 'challenge_complete', 'league_update'
  ));

grant execute on function public.rsvp_scheduled_round(uuid, text) to authenticated;
