-- Nutri Tracker schema. Run in Supabase SQL Editor.
-- Auth: enable Email and/or "Anonymous sign-ins" (Authentication > Providers).
-- No Storage bucket is required: photos are analysed in memory and discarded.

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- user_profiles
-- nutrient_targets: { "iron_mg": { "mode": "manual", "value": 18 }, "protein_g": { "mode": "auto" } }
-- ---------------------------------------------------------------------------
create table public.user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  age smallint check (age between 1 and 120),
  weight_kg numeric(5,2) check (weight_kg > 0),
  height_cm numeric(5,1) check (height_cm > 0),
  sex text check (sex in ('male','female')),
  activity_level text not null default 'moderate'
    check (activity_level in ('sedentary','light','moderate','active','very_active')),
  preferred_language text not null default 'fr' check (preferred_language in ('fr','en','de')),
  nutrient_targets jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_user_profiles_updated before update on public.user_profiles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- custom_foods (values per 100 g, canonical units)
-- ---------------------------------------------------------------------------
create table public.custom_foods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  name text not null check (char_length(name) between 1 and 160),
  aliases text[] not null default '{}',
  brand text,
  calories_kcal numeric(10,3) not null default 0 check (calories_kcal >= 0),
  protein_g numeric(10,3) not null default 0 check (protein_g >= 0),
  carbs_g numeric(10,3) not null default 0 check (carbs_g >= 0),
  fat_g numeric(10,3) not null default 0 check (fat_g >= 0),
  fiber_g numeric(10,3) not null default 0 check (fiber_g >= 0),
  sugar_g numeric(10,3) not null default 0 check (sugar_g >= 0),
  iron_mg numeric(10,3) not null default 0 check (iron_mg >= 0),
  calcium_mg numeric(10,3) not null default 0 check (calcium_mg >= 0),
  magnesium_mg numeric(10,3) not null default 0 check (magnesium_mg >= 0),
  potassium_mg numeric(10,3) not null default 0 check (potassium_mg >= 0),
  zinc_mg numeric(10,3) not null default 0 check (zinc_mg >= 0),
  sodium_mg numeric(10,3) not null default 0 check (sodium_mg >= 0),
  vitamin_a_mcg numeric(10,3) not null default 0 check (vitamin_a_mcg >= 0),
  vitamin_b12_mcg numeric(10,3) not null default 0 check (vitamin_b12_mcg >= 0),
  vitamin_c_mg numeric(10,3) not null default 0 check (vitamin_c_mg >= 0),
  vitamin_d_mcg numeric(10,3) not null default 0 check (vitamin_d_mcg >= 0),
  vitamin_e_mg numeric(10,3) not null default 0 check (vitamin_e_mg >= 0),
  vitamin_k_mcg numeric(10,3) not null default 0 check (vitamin_k_mcg >= 0),
  folate_mcg numeric(10,3) not null default 0 check (folate_mcg >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);
create index idx_custom_foods_user on public.custom_foods(user_id);
create index idx_custom_foods_user_name on public.custom_foods(user_id, lower(name));
create trigger trg_custom_foods_updated before update on public.custom_foods
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- custom_recipes (per-100g density is pre-computed from the COOKED weight:
--   per100g = sum(raw ingredient nutrients) / cooked_weight_g * 100)
-- ---------------------------------------------------------------------------
create table public.custom_recipes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  name text not null check (char_length(name) between 1 and 160),
  aliases text[] not null default '{}',
  raw_weight_g numeric(10,2) not null check (raw_weight_g > 0),
  cooked_weight_g numeric(10,2) not null check (cooked_weight_g > 0),
  total_servings numeric(8,2) not null default 1 check (total_servings > 0),
  serving_weight_g numeric(10,2) generated always as (cooked_weight_g / total_servings) stored,
  calories_kcal numeric(10,3) not null default 0 check (calories_kcal >= 0),
  protein_g numeric(10,3) not null default 0 check (protein_g >= 0),
  carbs_g numeric(10,3) not null default 0 check (carbs_g >= 0),
  fat_g numeric(10,3) not null default 0 check (fat_g >= 0),
  fiber_g numeric(10,3) not null default 0 check (fiber_g >= 0),
  sugar_g numeric(10,3) not null default 0 check (sugar_g >= 0),
  iron_mg numeric(10,3) not null default 0 check (iron_mg >= 0),
  calcium_mg numeric(10,3) not null default 0 check (calcium_mg >= 0),
  magnesium_mg numeric(10,3) not null default 0 check (magnesium_mg >= 0),
  potassium_mg numeric(10,3) not null default 0 check (potassium_mg >= 0),
  zinc_mg numeric(10,3) not null default 0 check (zinc_mg >= 0),
  sodium_mg numeric(10,3) not null default 0 check (sodium_mg >= 0),
  vitamin_a_mcg numeric(10,3) not null default 0 check (vitamin_a_mcg >= 0),
  vitamin_b12_mcg numeric(10,3) not null default 0 check (vitamin_b12_mcg >= 0),
  vitamin_c_mg numeric(10,3) not null default 0 check (vitamin_c_mg >= 0),
  vitamin_d_mcg numeric(10,3) not null default 0 check (vitamin_d_mcg >= 0),
  vitamin_e_mg numeric(10,3) not null default 0 check (vitamin_e_mg >= 0),
  vitamin_k_mcg numeric(10,3) not null default 0 check (vitamin_k_mcg >= 0),
  folate_mcg numeric(10,3) not null default 0 check (folate_mcg >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);
create index idx_custom_recipes_user on public.custom_recipes(user_id);
create index idx_custom_recipes_user_name on public.custom_recipes(user_id, lower(name));
create trigger trg_custom_recipes_updated before update on public.custom_recipes
  for each row execute function public.set_updated_at();

-- Ingredient snapshot keeps per-100g nutrients so a recipe can be recomputed later.
create table public.recipe_ingredients (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  position smallint not null default 0,
  item_name text not null,
  source_type text not null default 'manual'
    check (source_type in ('custom_recipe','custom_food','openfoodfacts','usda','ai_estimate','manual')),
  source_ref_id text,
  grams numeric(10,2) not null check (grams > 0),
  nutrients_per_100g jsonb not null,
  created_at timestamptz not null default now(),
  foreign key (recipe_id, user_id) references public.custom_recipes(id, user_id) on delete cascade
);
create index idx_recipe_ingredients_recipe on public.recipe_ingredients(recipe_id);
create index idx_recipe_ingredients_user on public.recipe_ingredients(user_id);

-- ---------------------------------------------------------------------------
-- meal_logs / meal_log_items (no image columns anywhere)
-- ---------------------------------------------------------------------------
create table public.meal_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  logged_date date not null default current_date,
  meal_type text not null check (meal_type in ('breakfast','lunch','dinner','snack')),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);
create index idx_meal_logs_user_date on public.meal_logs(user_id, logged_date);
create trigger trg_meal_logs_updated before update on public.meal_logs
  for each row execute function public.set_updated_at();

create table public.meal_log_items (
  id uuid primary key default gen_random_uuid(),
  meal_log_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  logged_date date not null, -- denormalised for fast calendar aggregation
  item_name text not null,
  source_type text not null
    check (source_type in ('custom_recipe','custom_food','openfoodfacts','usda','ai_estimate','manual')),
  source_ref_id text,
  grams numeric(10,2) not null check (grams > 0),
  confidence numeric(3,2) check (confidence between 0 and 1),
  -- exact totals for `grams` (not per 100 g)
  calories_kcal numeric(10,3) not null default 0 check (calories_kcal >= 0),
  protein_g numeric(10,3) not null default 0 check (protein_g >= 0),
  carbs_g numeric(10,3) not null default 0 check (carbs_g >= 0),
  fat_g numeric(10,3) not null default 0 check (fat_g >= 0),
  fiber_g numeric(10,3) not null default 0 check (fiber_g >= 0),
  sugar_g numeric(10,3) not null default 0 check (sugar_g >= 0),
  iron_mg numeric(10,3) not null default 0 check (iron_mg >= 0),
  calcium_mg numeric(10,3) not null default 0 check (calcium_mg >= 0),
  magnesium_mg numeric(10,3) not null default 0 check (magnesium_mg >= 0),
  potassium_mg numeric(10,3) not null default 0 check (potassium_mg >= 0),
  zinc_mg numeric(10,3) not null default 0 check (zinc_mg >= 0),
  sodium_mg numeric(10,3) not null default 0 check (sodium_mg >= 0),
  vitamin_a_mcg numeric(10,3) not null default 0 check (vitamin_a_mcg >= 0),
  vitamin_b12_mcg numeric(10,3) not null default 0 check (vitamin_b12_mcg >= 0),
  vitamin_c_mg numeric(10,3) not null default 0 check (vitamin_c_mg >= 0),
  vitamin_d_mcg numeric(10,3) not null default 0 check (vitamin_d_mcg >= 0),
  vitamin_e_mg numeric(10,3) not null default 0 check (vitamin_e_mg >= 0),
  vitamin_k_mcg numeric(10,3) not null default 0 check (vitamin_k_mcg >= 0),
  folate_mcg numeric(10,3) not null default 0 check (folate_mcg >= 0),
  created_at timestamptz not null default now(),
  foreign key (meal_log_id, user_id) references public.meal_logs(id, user_id) on delete cascade
);
create index idx_meal_log_items_meal on public.meal_log_items(meal_log_id);
create index idx_meal_log_items_user_date on public.meal_log_items(user_id, logged_date);

-- Daily totals for the calendar (respects RLS of the caller).
create view public.daily_nutrient_totals with (security_invoker = true) as
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

-- ---------------------------------------------------------------------------
-- Row Level Security: every row is private to its owner.
-- ---------------------------------------------------------------------------
alter table public.user_profiles enable row level security;
alter table public.custom_foods enable row level security;
alter table public.custom_recipes enable row level security;
alter table public.recipe_ingredients enable row level security;
alter table public.meal_logs enable row level security;
alter table public.meal_log_items enable row level security;

create policy "profiles_owner_all" on public.user_profiles
  for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy "custom_foods_owner_all" on public.custom_foods
  for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy "custom_recipes_owner_all" on public.custom_recipes
  for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy "recipe_ingredients_owner_all" on public.recipe_ingredients
  for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy "meal_logs_owner_all" on public.meal_logs
  for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy "meal_log_items_owner_all" on public.meal_log_items
  for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- Auto-create a profile row on signup (defaults: French, standard adult).
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.user_profiles (user_id, age, weight_kg, height_cm, sex)
  values (new.id, 30, 70, 170, 'male')
  on conflict (user_id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();
