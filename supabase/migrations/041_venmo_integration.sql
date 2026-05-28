-- Venmo handles for profile payouts and league ace-pot buy-ins.

alter table public.profiles
  add column if not exists venmo_username text;

comment on column public.profiles.venmo_username is
  'Optional Venmo @username for league payouts (no @ prefix).';

alter table public.league_pots
  add column if not exists venmo_username text;

comment on column public.league_pots.venmo_username is
  'League treasurer Venmo @username for ace-pot and buy-in payments.';

-- ---------- me view: venmo_username ----------

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
    p.notify_email,
    nullif(trim(p.venmo_username), '') as venmo_username
  from public.profiles p
  where p.id = auth.uid();

-- ---------- Ace pot: expose Venmo + admin settings ----------

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
    'entry_fee_cents', pot.entry_fee_cents,
    'venmo_username', nullif(trim(pot.venmo_username), '')
  );
end;
$$;

create or replace function public.update_league_pot_settings(
  p_league_id uuid,
  p_venmo_username text default null,
  p_entry_fee_cents integer default null,
  p_label text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  pot record;
  clean_venmo text;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if not public.is_league_admin(p_league_id) then raise exception 'Admin only'; end if;

  insert into public.league_pots (league_id) values (p_league_id)
  on conflict (league_id) do nothing;

  clean_venmo := nullif(regexp_replace(trim(coalesce(p_venmo_username, '')), '^@', ''), '');

  if clean_venmo is not null and clean_venmo !~ '^[A-Za-z0-9_-]{1,30}$' then
    raise exception 'Invalid Venmo username';
  end if;

  if p_entry_fee_cents is not null and p_entry_fee_cents < 0 then
    raise exception 'Entry fee cannot be negative';
  end if;

  update public.league_pots
  set
    venmo_username = clean_venmo,
    entry_fee_cents = coalesce(p_entry_fee_cents, entry_fee_cents),
    label = case
      when p_label is not null and trim(p_label) <> '' then trim(p_label)
      else label
    end,
    updated_at = now()
  where league_id = p_league_id
  returning * into pot;

  return jsonb_build_object(
    'id', pot.id,
    'label', pot.label,
    'balance_cents', pot.balance_cents,
    'entry_fee_cents', pot.entry_fee_cents,
    'venmo_username', nullif(trim(pot.venmo_username), '')
  );
end;
$$;

grant execute on function public.update_league_pot_settings(uuid, text, integer, text) to authenticated;
