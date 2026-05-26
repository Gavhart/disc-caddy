-- Disc Caddy 031: Fix badge double-counting community DMs in notification count

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
    and n.read_at is null
    and n.kind <> 'community_message';
$$;

create or replace function public.mark_community_message_notifications_read()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;

  update public.user_notifications
  set read_at = coalesce(read_at, now())
  where user_id = auth.uid()
    and read_at is null
    and kind = 'community_message';
end;
$$;

grant execute on function public.mark_community_message_notifications_read() to authenticated;
