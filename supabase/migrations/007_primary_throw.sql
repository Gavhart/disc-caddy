-- Disc Caddy 007: primary throwing style preference
--
-- Adds `primary_throw` to `profiles` so the recommender can break ties in
-- favor of the player's preferred release. Distinct from `throws_forehand`,
-- which gates whether forehand is *considered at all*:
--
--   - primary_throw = 'backhand', throws_forehand = false → BH-only player
--   - primary_throw = 'backhand', throws_forehand = true  → BH-first, FH ok
--   - primary_throw = 'forehand'                          → FH-first (implies
--     throws_forehand should be true; the app enforces this on save)
--
-- Default is 'backhand' since that's the more common primary release at all
-- skill levels. A check constraint keeps the column tight.

alter table public.profiles
  add column if not exists primary_throw text not null default 'backhand'
  check (primary_throw in ('backhand', 'forehand'));

-- ---------- Refresh me view to expose primary_throw ----------
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
    p.primary_throw,
    coalesce(p.forehand_max_distance, p.max_distance) as forehand_max_distance,
    p.subscription_tier,
    p.subscription_status,
    p.subscription_period_end,
    (p.subscription_tier = 'pro' and p.subscription_status in ('active','trialing'))
      as is_pro
  from public.profiles p
  where p.id = auth.uid();
