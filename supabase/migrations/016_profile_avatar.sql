-- Profile avatar photo (stored in disc-photos bucket under {user_id}/avatar-*)

alter table public.profiles
  add column if not exists avatar_path text;

comment on column public.profiles.avatar_path is
  'Storage object path for the user profile photo (disc-photos bucket).';

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
    p.looking_for_players
  from public.profiles p
  where p.id = auth.uid();
