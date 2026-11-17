-- Idempotent: aligns meal_logs / meal_log_items (+ RLS, grants, daily totals view) with the app code.
-- Safe to run multiple times in the Supabase SQL Editor.

create extension if not exists pgcrypto;

create table if not exists public.meal_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  logged_date date not null default current_date,
  meal_type text not null,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.meal_log_items (
  id uuid primary key default gen_random_uuid(),
  meal_log_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  logged_date date not null,
  item_name text not null,
  source_type text not null,
  source_ref_id text,
  grams numeric(10,2) not null,
  confidence numeric(3,2),
  created_at timestamptz not null default now()
);

-- Columns the app writes (add if the table was created from an older schema).
alter table public.meal_logs
  add column if not exists user_id uuid default auth.uid(),
  add column if not exists logged_date date not null default current_date,
  add column if not exists meal_type text,
  add column if not exists note text,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

alter table public.meal_log_items
  add column if not exists meal_log_id uuid,
  add column if not exists user_id uuid default auth.uid(),
  add column if not exists logged_date date,
  add column if not exists item_name text,
  add column if not exists source_type text,
  add column if not exists source_ref_id text,
  add column if not exists grams numeric(10,2),
  add column if not exists confidence numeric(3,2),
  add column if not exists created_at timestamptz not null default now();

do $$
declare k text;
begin
  foreach k in array array[
    'calories_kcal','protein_g','carbs_g','fat_g','fiber_g','sugar_g','iron_mg','calcium_mg',
    'magnesium_mg','potassium_mg','zinc_mg','sodium_mg','vitamin_a_mcg','vitamin_b12_mcg',
    'vitamin_c_mg','vitamin_d_mcg','vitamin_e_mg','vitamin_k_mcg','folate_mcg']
  loop
    execute format('alter table public.meal_log_items add column if not exists %I numeric(10,3) not null default 0', k);
  end loop;
end $$;

-- Constraints (replace so they accept every value the app sends).
alter table public.meal_logs drop constraint if exists meal_logs_meal_type_check;
alter table public.meal_logs add constraint meal_logs_meal_type_check
  check (meal_type in ('breakfast','lunch','dinner','snack'));

alter table public.meal_log_items drop constraint if exists meal_log_items_source_type_check;
alter table public.meal_log_items add constraint meal_log_items_source_type_check
  check (source_type in ('custom_recipe','custom_food','openfoodfacts','usda','ai_estimate','manual'));

alter table public.meal_log_items drop constraint if exists meal_log_items_grams_check;
alter table public.meal_log_items add constraint meal_log_items_grams_check check (grams > 0);

-- Composite key required by the (meal_log_id, user_id) foreign key.
do $$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.meal_logs'::regclass and conname = 'meal_logs_id_user_id_key') then
    alter table public.meal_logs add constraint meal_logs_id_user_id_key unique (id, user_id);
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.meal_log_items'::regclass and conname = 'meal_log_items_meal_log_id_user_id_fkey') then
    alter table public.meal_log_items add constraint meal_log_items_meal_log_id_user_id_fkey
      foreign key (meal_log_id, user_id) references public.meal_logs(id, user_id) on delete cascade;
  end if;
end $$;

create index if not exists idx_meal_logs_user_date on public.meal_logs(user_id, logged_date);
create index if not exists idx_meal_log_items_meal on public.meal_log_items(meal_log_id);
create index if not exists idx_meal_log_items_user_date on public.meal_log_items(user_id, logged_date);

-- updated_at trigger
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;
drop trigger if exists trg_meal_logs_updated on public.meal_logs;
create trigger trg_meal_logs_updated before update on public.meal_logs
  for each row execute function public.set_updated_at();

-- Row Level Security: owner only, for signed-in (incl. anonymous) users.
alter table public.meal_logs enable row level security;
alter table public.meal_log_items enable row level security;

drop policy if exists "meal_logs_owner_all" on public.meal_logs;
create policy "meal_logs_owner_all" on public.meal_logs
  for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists "meal_log_items_owner_all" on public.meal_log_items;
create policy "meal_log_items_owner_all" on public.meal_log_items
  for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.meal_logs to authenticated;
grant select, insert, update, delete on public.meal_log_items to authenticated;

-- Daily totals view used by the calendar.
create or replace view public.daily_nutrient_totals with (security_invoker = true) as
select
  user_id, logged_date,
  sum(calories_kcal) as calories_kcal, sum(protein_g) as protein_g, sum(carbs_g) as carbs_g,
  sum(fat_g) as fat_g, sum(fiber_g) as fiber_g, sum(sugar_g) as sugar_g,
  sum(iron_mg) as iron_mg, sum(calcium_mg) as calcium_mg, sum(magnesium_mg) as magnesium_mg,
  sum(potassium_mg) as potassium_mg, sum(zinc_mg) as zinc_mg, sum(sodium_mg) as sodium_mg,
  sum(vitamin_a_mcg) as vitamin_a_mcg, sum(vitamin_b12_mcg) as vitamin_b12_mcg,
  sum(vitamin_c_mg) as vitamin_c_mg, sum(vitamin_d_mcg) as vitamin_d_mcg,
  sum(vitamin_e_mg) as vitamin_e_mg, sum(vitamin_k_mcg) as vitamin_k_mcg,
  sum(folate_mcg) as folate_mcg
from public.meal_log_items
group by user_id, logged_date;
grant select on public.daily_nutrient_totals to authenticated;
