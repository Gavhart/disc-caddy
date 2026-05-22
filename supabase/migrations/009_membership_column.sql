-- Disc Caddy 009: Pro vs Free membership column + admin view
--
-- Makes it easy to see and filter users by plan in Supabase Table Editor.
-- `membership` is derived from subscription_tier + subscription_status and
-- stays in sync automatically (generated column).

alter table public.profiles
  add column if not exists membership text generated always as (
    case
      when subscription_tier = 'pro'
        and subscription_status in ('active', 'trialing')
      then 'pro'
      else 'free'
    end
  ) stored;

comment on column public.profiles.membership is
  'Effective plan shown in dashboard: pro when tier=pro and status is active/trialing, otherwise free.';

-- All users in one place — browse in Dashboard → Table Editor → user_memberships
create or replace view public.user_memberships
  with (security_invoker = true)
as
  select
    p.id,
    p.email,
    p.membership,
    p.subscription_tier,
    p.subscription_status,
    p.subscription_period_end,
    p.stripe_customer_id,
    p.created_at
  from public.profiles p;

comment on view public.user_memberships is
  'Admin view: all users with Pro vs Free membership. Visible in Supabase Table Editor.';

-- Keep this admin-only; clients already use the me view + is_pro.
revoke all on public.user_memberships from public, anon, authenticated;
grant select on public.user_memberships to service_role;
