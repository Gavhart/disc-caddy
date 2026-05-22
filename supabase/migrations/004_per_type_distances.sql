-- Disc Caddy 004: per-disc-type max distance
--
-- Players don't throw all disc classes proportionally. This stores the
-- player's actual max distance per type so the recommender can use the
-- right baseline when scoring a putter vs a midrange vs a driver.
--
-- All three new columns are nullable. The `me` view fills in sensible
-- ratios of driver distance (existing `max_distance`) when they're null,
-- so the client always reads a usable integer.

alter table public.profiles
  add column if not exists putter_max_distance integer;

alter table public.profiles
  add column if not exists midrange_max_distance integer;

alter table public.profiles
  add column if not exists fairway_max_distance integer;

-- ---------- Refresh me view to expose per-type distances ----------
-- CREATE OR REPLACE VIEW can't insert columns mid-row; drop + recreate.
drop view if exists public.me;
create view public.me as
  select
    p.id,
    p.email,
    p.max_distance,
    coalesce(p.putter_max_distance,   (p.max_distance * 0.50)::integer) as putter_max_distance,
    coalesce(p.midrange_max_distance, (p.max_distance * 0.70)::integer) as midrange_max_distance,
    coalesce(p.fairway_max_distance,  (p.max_distance * 0.85)::integer) as fairway_max_distance,
    p.dominant_hand,
    p.throws_forehand,
    coalesce(p.forehand_max_distance, p.max_distance) as forehand_max_distance,
    p.subscription_tier,
    p.subscription_status,
    p.subscription_period_end,
    (p.subscription_tier = 'pro' and p.subscription_status in ('active','trialing'))
      as is_pro
  from public.profiles p
  where p.id = auth.uid();
