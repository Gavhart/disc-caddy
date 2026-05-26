-- Disc Caddy 026: auto league import, notification dispatch hook, app config

-- ---------- App config (one-time setup for push/email webhook) ----------
-- After deploying dispatch-notification edge function, run in SQL Editor:
--
-- insert into public.app_config (key, value) values
--   ('dispatch_notification_url', 'https://YOUR_PROJECT.supabase.co/functions/v1/dispatch-notification'),
--   ('notification_webhook_secret', 'YOUR_RANDOM_SECRET')
-- on conflict (key) do update set value = excluded.value, updated_at = now();
--
-- Set the same secret as NOTIFICATION_WEBHOOK_SECRET on the edge function.
-- Also set VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT on the edge function.

create table if not exists public.app_config (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

alter table public.app_config enable row level security;

comment on table public.app_config is
  'Server-side config for notification webhooks. Set via SQL Editor only.';

-- ---------- Auto-submit completed rounds to active leagues ----------

create or replace function public.auto_submit_round_to_leagues(p_round_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  played date;
  r_status text;
  submitted_count integer;
  league_ids jsonb;
begin
  if uid is null then raise exception 'Not authenticated'; end if;

  select r.status, coalesce(r.ended_at, r.started_at)::date
  into r_status, played
  from public.rounds r
  where r.id = p_round_id;

  if r_status is null then raise exception 'Round not found'; end if;
  if r_status <> 'completed' then raise exception 'Round must be completed first'; end if;

  if not exists (
    select 1 from public.round_player_totals pt
    where pt.round_id = p_round_id and pt.user_id = uid and pt.holes_scored >= 9
  ) then
    return jsonb_build_object('submitted', 0, 'league_ids', '[]'::jsonb);
  end if;

  insert into public.league_round_submissions (league_id, round_id, submitted_by)
  select lg.id, p_round_id, uid
  from public.leagues lg
  join public.league_members lm on lm.league_id = lg.id and lm.user_id = uid
  where played between lg.season_start and lg.season_end
  on conflict (league_id, round_id) do nothing;

  select count(*), coalesce(jsonb_agg(lg.id), '[]'::jsonb)
  into submitted_count, league_ids
  from public.league_round_submissions lrs
  join public.leagues lg on lg.id = lrs.league_id
  where lrs.round_id = p_round_id and lrs.submitted_by = uid;

  return jsonb_build_object('submitted', submitted_count, 'league_ids', league_ids);
end;
$$;

-- ---------- Notification dispatch via pg_net (optional) ----------

create extension if not exists pg_net with schema extensions;

create or replace function public.try_dispatch_notification_delivery(
  p_user_id uuid,
  p_title text,
  p_body text,
  p_link_path text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  fn_url text;
  hook_secret text;
begin
  select value into fn_url from public.app_config where key = 'dispatch_notification_url';
  select value into hook_secret from public.app_config where key = 'notification_webhook_secret';

  if fn_url is null or fn_url = '' then
    return;
  end if;

  perform net.http_post(
    url := fn_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-webhook-secret', coalesce(hook_secret, '')
    ),
    body := jsonb_build_object(
      'user_id', p_user_id,
      'title', p_title,
      'body', p_body,
      'link_path', p_link_path
    )
  );
exception
  when others then
    null;
end;
$$;

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

  perform public.try_dispatch_notification_delivery(
    p_user_id, p_title, p_body, p_link_path
  );

  return new_id;
end;
$$;

grant execute on function public.auto_submit_round_to_leagues(uuid) to authenticated;
