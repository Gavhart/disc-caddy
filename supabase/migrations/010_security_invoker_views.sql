-- Disc Caddy 010: fix Supabase Security Advisor "Security Definer View" warnings
--
-- Postgres views default to SECURITY DEFINER, which runs queries as the view
-- owner and can bypass RLS. Supabase flags this in public schema.
-- Fix: recreate views with security_invoker = true so RLS applies normally.
--
-- Resolves advisor warnings for public.course_owners and public.discs (if
-- those objects are views in your project), and hardens our own views.

-- ---------- Helper: preserve an existing view body, switch to security invoker ----------
create or replace function public._fix_view_security_invoker(view_name text)
returns void
language plpgsql
set search_path = public
as $$
declare
  def text;
  kind "char";
begin
  select c.relkind into kind
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relname = view_name;

  -- Only views can be fixed this way; skip tables (e.g. public.discs table).
  if kind is distinct from 'v' then
    return;
  end if;

  select pg_get_viewdef(format('public.%I', view_name)::regclass, true) into def;
  execute format(
    'create or replace view public.%I with (security_invoker = true) as %s',
    view_name,
    def
  );
end;
$$;

select public._fix_view_security_invoker('course_owners');
select public._fix_view_security_invoker('discs');

drop function public._fix_view_security_invoker(text);

-- ---------- App views (explicit recreate) ----------

drop view if exists public.me;
create view public.me
  with (security_invoker = true)
as
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

drop view if exists public.course_summaries;
create view public.course_summaries
  with (security_invoker = true)
as
  select
    c.id                                                     as course_id,
    c.total_holes                                            as total_holes,
    count(h.id)::integer                                     as holes_filled,
    coalesce(sum(h.distance), 0)::integer                    as distance_total_ft,
    case when count(h.id) > 0
      then round(avg(h.distance))::integer
      else null
    end                                                      as distance_avg_ft
  from public.courses c
  left join public.course_holes h on h.course_id = c.id
  group by c.id, c.total_holes;

grant select on public.course_summaries to anon, authenticated;

drop view if exists public.user_memberships;
create view public.user_memberships
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

revoke all on public.user_memberships from public, anon, authenticated;
grant select on public.user_memberships to service_role;
