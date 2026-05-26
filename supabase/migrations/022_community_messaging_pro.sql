-- Disc Caddy 022: community messaging is Pro-only
--
-- Free users can still appear on Community and read inbound messages;
-- sending (new conversations and replies) requires an active Pro subscription.

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

  return new_id;
end;
$$;

grant execute on function public.send_community_message(uuid, text) to authenticated;
