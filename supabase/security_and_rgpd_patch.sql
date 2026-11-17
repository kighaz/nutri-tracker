-- Nutri Tracker: security + RGPD/DSGVO patch. Idempotent; run once in the Supabase SQL Editor
-- BEFORE deploying the matching app code (the app calls these functions and fails closed without them).

-- ---------------------------------------------------------------------------
-- 1. Defense in depth: anonymous (not signed-in) visitors get no table access at all.
--    RLS already blocks them; this removes the grants too.
-- ---------------------------------------------------------------------------
revoke all on public.user_profiles, public.custom_foods, public.custom_recipes,
  public.recipe_ingredients, public.meal_logs, public.meal_log_items from anon;
revoke all on public.daily_nutrient_totals from anon;

-- Make sure RLS is on everywhere (no-op if already enabled).
alter table public.user_profiles enable row level security;
alter table public.custom_foods enable row level security;
alter table public.custom_recipes enable row level security;
alter table public.recipe_ingredients enable row level security;
alter table public.meal_logs enable row level security;
alter table public.meal_log_items enable row level security;

-- ---------------------------------------------------------------------------
-- 2. Rate limiting (abuse / Gemini + USDA quota protection)
--    RLS is enabled with NO policy: nobody can touch the table directly,
--    only the SECURITY DEFINER function below can.
-- ---------------------------------------------------------------------------
create table if not exists public.rate_limits (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  action text not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_rate_limits_lookup on public.rate_limits(user_id, action, created_at);
alter table public.rate_limits enable row level security;
revoke all on public.rate_limits from anon, authenticated;

create or replace function public.consume_rate_limit(p_action text, p_max integer, p_window_seconds integer)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  used integer;
begin
  if uid is null then
    return false;
  end if;
  delete from public.rate_limits
    where user_id = uid and action = p_action
      and created_at < now() - make_interval(secs => p_window_seconds);
  select count(*) into used from public.rate_limits where user_id = uid and action = p_action;
  if used >= p_max then
    return false;
  end if;
  insert into public.rate_limits(user_id, action) values (uid, p_action);
  return true;
end $$;

revoke all on function public.consume_rate_limit(text, integer, integer) from public, anon;
grant execute on function public.consume_rate_limit(text, integer, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Right to erasure (RGPD Art. 17): delete the caller's account and ALL their data.
--    Every table references auth.users(id) ON DELETE CASCADE, so deleting the auth
--    row removes profile, custom foods, recipes, ingredients, meals, meal items, rate limits.
-- ---------------------------------------------------------------------------
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;
  -- Explicit deletes first (belt and braces; the cascade would do the same).
  delete from public.meal_log_items where user_id = uid;
  delete from public.meal_logs where user_id = uid;
  delete from public.recipe_ingredients where user_id = uid;
  delete from public.custom_recipes where user_id = uid;
  delete from public.custom_foods where user_id = uid;
  delete from public.user_profiles where user_id = uid;
  delete from public.rate_limits where user_id = uid;
  delete from auth.users where id = uid;
end $$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Data minimisation: new accounts no longer get invented age/weight/height values.
--    (The user fills them in Settings; the app falls back to its own defaults when null.)
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.user_profiles (user_id) values (new.id) on conflict (user_id) do nothing;
  return new;
end $$;
