-- 046_drop_subscription.sql
-- Disc Caddy is fully free — there is no Pro tier, no Stripe billing.
-- This migration removes the subscription columns and rebuilds the `me` view
-- without them.
--
-- Safe to run after deploying the app code that no longer reads these fields.

-- ---------- Rebuild me view without subscription columns ----------
drop view if exists public.me;

create or replace view public.me as
  select
    p.id,
    p.email,
    p.display_name,
    p.onboarding_complete,
    p.max_distance,
    p.putter_max_distance,
    p.midrange_max_distance,
    p.fairway_max_distance,
    p.dominant_hand,
    p.throws_forehand,
    p.primary_throw,
    p.forehand_max_distance,
    p.community_visible,
    p.looking_for_players,
    p.avatar_path,
    p.community_search_radius_miles,
    p.notify_email,
    p.venmo_username
  from public.profiles p
  where p.id = auth.uid();

-- ---------- Drop subscription columns from profiles ----------
alter table public.profiles
  drop column if exists stripe_customer_id,
  drop column if exists subscription_status,
  drop column if exists subscription_tier,
  drop column if exists subscription_period_end;
