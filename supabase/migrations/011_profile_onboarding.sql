-- Disc Caddy 011: profile display name + onboarding flag
--
-- Signup collects player info; OAuth users finish on /welcome.
-- handle_new_user copies auth metadata into profiles when present.

alter table public.profiles
  add column if not exists display_name text,
  add column if not exists onboarding_complete boolean not null default false;

-- Don't send existing users through welcome.
update public.profiles
set onboarding_complete = true
where onboarding_complete = false;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  disp text := nullif(trim(meta->>'display_name'), '');
  max_dist integer := nullif(trim(meta->>'max_distance'), '')::integer;
  hand text := nullif(trim(meta->>'dominant_hand'), '');
  primary_rel text := nullif(trim(meta->>'primary_throw'), '');
  throws_fh boolean := coalesce((meta->>'throws_forehand')::boolean, primary_rel = 'forehand');
  onboarded boolean := coalesce((meta->>'onboarding_complete')::boolean, false);
begin
  insert into public.profiles (
    id,
    email,
    display_name,
    max_distance,
    dominant_hand,
    primary_throw,
    throws_forehand,
    onboarding_complete
  )
  values (
    new.id,
    new.email,
    disp,
    coalesce(max_dist, 280),
    coalesce(hand, 'right'),
    coalesce(primary_rel, 'backhand'),
    throws_fh,
    onboarded
  );
  return new;
end;
$$;

drop view if exists public.me;
create view public.me
  with (security_invoker = true)
as
  select
    p.id,
    p.email,
    p.display_name,
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
      as is_pro
  from public.profiles p
  where p.id = auth.uid();
