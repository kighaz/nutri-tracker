"use server";

import { createSupabaseServerClient } from "@/lib/supabase";
import {
  DEFAULT_PROFILE,
  NUTRIENT_KEYS,
  computeRecipe,
  emptyNutrients,
  normLang,
  type MealType,
  type NutrientTargets,
  type NutrientVector,
  type SourceType,
  type UserProfile,
} from "@/types/nutrition";
import type {
  ActionResult,
  DailyTotals,
  LoggedMeal,
  RecipeSummary,
  SaveMealInput,
  SaveRecipeInput,
} from "@/types/diary";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MEALS: MealType[] = ["breakfast", "lunch", "dinner", "snack"];
const SOURCES: SourceType[] = [
  "custom_recipe",
  "custom_food",
  "openfoodfacts",
  "usda",
  "ai_estimate",
  "manual",
];

async function authed() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return null;
  return { supabase, userId: data.user.id };
}

const UNAUTH = { ok: false, error: "error.unauthenticated" } as const;

function dbError(prefix: string, e: { message?: string; code?: string } | null | undefined) {
  // Details stay in the server logs; the browser only receives a translatable generic key.
  console.error(prefix, e?.code ?? "", e?.message ?? "");
  return { ok: false, error: "common.error" } as const;
}

function vectorFromRow(row: Record<string, unknown>): NutrientVector {
  const v = emptyNutrients();
  for (const k of NUTRIENT_KEYS) v[k] = Number(row[k] ?? 0) || 0;
  return v;
}

function cleanVector(v: NutrientVector): NutrientVector {
  const out = emptyNutrients();
  for (const k of NUTRIENT_KEYS) {
    const n = Number(v?.[k]);
    out[k] = Number.isFinite(n) && n >= 0 ? n : 0;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Profile & targets
// ---------------------------------------------------------------------------
export async function getProfile(): Promise<ActionResult<UserProfile>> {
  const a = await authed();
  if (!a) return UNAUTH;
  const { data, error } = await a.supabase.from("user_profiles").select("*").eq("user_id", a.userId).maybeSingle();
  if (error) return { ok: false, error: "common.error" };
  if (!data) return { ok: true, data: DEFAULT_PROFILE };
  return {
    ok: true,
    data: {
      age: data.age ?? null,
      weight_kg: data.weight_kg != null ? Number(data.weight_kg) : null,
      height_cm: data.height_cm != null ? Number(data.height_cm) : null,
      sex: data.sex ?? null,
      activity_level: data.activity_level,
      preferred_language: data.preferred_language,
      nutrient_targets: (data.nutrient_targets ?? {}) as NutrientTargets,
    },
  };
}

export async function saveProfile(p: UserProfile): Promise<ActionResult<true>> {
  const a = await authed();
  if (!a) return UNAUTH;
  const targets: NutrientTargets = {};
  for (const k of NUTRIENT_KEYS) {
    const t = p.nutrient_targets?.[k];
    if (t?.mode === "manual" && typeof t.value === "number" && t.value > 0) targets[k] = { mode: "manual", value: t.value };
  }
  const { error } = await a.supabase.from("user_profiles").upsert({
    user_id: a.userId,
    age: p.age,
    weight_kg: p.weight_kg,
    height_cm: p.height_cm,
    sex: p.sex,
    activity_level: p.activity_level,
    preferred_language: normLang(p.preferred_language),
    nutrient_targets: targets,
  });
  return error ? { ok: false, error: "common.error" } : { ok: true, data: true };
}

// ---------------------------------------------------------------------------
// Meals
// ---------------------------------------------------------------------------
export async function saveMeal(input: SaveMealInput): Promise<ActionResult<{ id: string }>> {
  const a = await authed();
  if (!a) return UNAUTH;
  if (!DATE_RE.test(input.date) || !MEALS.includes(input.mealType) || !input.items?.length || input.items.length > 50) {
    return { ok: false, error: "common.error" };
  }
  const { data: meal, error } = await a.supabase
    .from("meal_logs")
    .insert({ user_id: a.userId, logged_date: input.date, meal_type: input.mealType })
    .select("id")
    .single();
  if (error || !meal) return dbError("Failed to save meal", error);

  const rows = input.items
    .filter((i) => i.grams > 0)
    .map((i) => ({
      meal_log_id: meal.id,
      user_id: a.userId,
      logged_date: input.date,
      item_name: String(i.name).slice(0, 160),
      source_type: SOURCES.includes(i.source) ? i.source : "manual",
      source_ref_id: i.source_ref_id,
      grams: Math.round(Math.min(Math.max(Number(i.grams) || 0, 0.01), 10000) * 100) / 100,
      confidence: Math.round(Math.min(1, Math.max(0, Number(i.confidence) || 0)) * 100) / 100,
      ...cleanVector(i.nutrients),
    }));
  if (rows.length === 0) {
    await a.supabase.from("meal_logs").delete().eq("id", meal.id);
    return { ok: false, error: "common.error" };
  }
  const { error: itemsError } = await a.supabase.from("meal_log_items").insert(rows);
  if (itemsError) {
    await a.supabase.from("meal_logs").delete().eq("id", meal.id); // no half-saved meals
    return dbError("Failed to save meal items", itemsError);
  }
  return { ok: true, data: { id: meal.id } };
}

export async function getMeals(from: string, to: string): Promise<ActionResult<LoggedMeal[]>> {
  const a = await authed();
  if (!a) return UNAUTH;
  if (!DATE_RE.test(from) || !DATE_RE.test(to)) return { ok: false, error: "common.error" };
  const { data, error } = await a.supabase
    .from("meal_logs")
    .select("id, logged_date, meal_type, note, meal_log_items(*)")
    .eq("user_id", a.userId)
    .gte("logged_date", from)
    .lte("logged_date", to)
    .order("logged_date")
    .order("created_at");
  if (error) return { ok: false, error: "common.error" };
  return {
    ok: true,
    data: (data ?? []).map((m) => ({
      id: m.id,
      logged_date: m.logged_date,
      meal_type: m.meal_type as MealType,
      note: m.note,
      items: ((m.meal_log_items ?? []) as Record<string, unknown>[]).map((i) => ({
        id: String(i.id),
        item_name: String(i.item_name),
        source_type: i.source_type as SourceType,
        grams: Number(i.grams),
        confidence: i.confidence != null ? Number(i.confidence) : null,
        nutrients: vectorFromRow(i),
      })),
    })),
  };
}

export async function getDailyTotals(from: string, to: string): Promise<ActionResult<DailyTotals>> {
  const a = await authed();
  if (!a) return UNAUTH;
  if (!DATE_RE.test(from) || !DATE_RE.test(to)) return { ok: false, error: "common.error" };
  const { data, error } = await a.supabase
    .from("daily_nutrient_totals")
    .select("*")
    .eq("user_id", a.userId)
    .gte("logged_date", from)
    .lte("logged_date", to);
  if (error) return { ok: false, error: "common.error" };
  const out: DailyTotals = {};
  for (const r of (data ?? []) as Record<string, unknown>[]) out[String(r.logged_date)] = vectorFromRow(r);
  return { ok: true, data: out };
}

export async function deleteMeal(id: string): Promise<ActionResult<true>> {
  const a = await authed();
  if (!a) return UNAUTH;
  const { error } = await a.supabase.from("meal_logs").delete().eq("id", id).eq("user_id", a.userId);
  return error ? { ok: false, error: "common.error" } : { ok: true, data: true };
}

// ---------------------------------------------------------------------------
// Recipes (per-100g computed from COOKED weight; fallback = sum of raw grams)
// ---------------------------------------------------------------------------
export async function saveRecipe(input: SaveRecipeInput): Promise<ActionResult<{ id: string }>> {
  const a = await authed();
  if (!a) return UNAUTH;
  const name = input.name?.trim().slice(0, 160);
  const ingredients = (input.ingredients ?? []).filter((i) => i.grams > 0);
  if (!name || !ingredients.length || ingredients.length > 100) return { ok: false, error: "common.error" };

  const calc = computeRecipe(
    ingredients.map((i) => ({ grams: i.grams, per100g: cleanVector(i.per100g) })),
    input.cookedWeightG,
    input.totalServings,
  );

  const { data: recipe, error } = await a.supabase
    .from("custom_recipes")
    .insert({
      user_id: a.userId,
      name,
      raw_weight_g: calc.raw_weight_g,
      cooked_weight_g: calc.cooked_weight_g,
      total_servings: calc.total_servings,
      ...calc.per100g,
    })
    .select("id")
    .single();
  if (error || !recipe) return { ok: false, error: "common.error" };

  const { error: ingError } = await a.supabase.from("recipe_ingredients").insert(
    ingredients.map((i, idx) => ({
      recipe_id: recipe.id,
      user_id: a.userId,
      position: idx,
      item_name: i.name.slice(0, 160),
      source_type: SOURCES.includes(i.source) ? i.source : "manual",
      source_ref_id: i.source_ref_id,
      grams: i.grams,
      nutrients_per_100g: cleanVector(i.per100g),
    })),
  );
  if (ingError) {
    await a.supabase.from("custom_recipes").delete().eq("id", recipe.id);
    return { ok: false, error: "common.error" };
  }
  return { ok: true, data: { id: recipe.id } };
}

export async function listRecipes(): Promise<ActionResult<RecipeSummary[]>> {
  const a = await authed();
  if (!a) return UNAUTH;
  const { data, error } = await a.supabase.from("custom_recipes").select("*").eq("user_id", a.userId).order("created_at", { ascending: false });
  if (error) return { ok: false, error: "common.error" };
  return {
    ok: true,
    data: ((data ?? []) as Record<string, unknown>[]).map((r) => ({
      id: String(r.id),
      name: String(r.name),
      raw_weight_g: Number(r.raw_weight_g),
      cooked_weight_g: Number(r.cooked_weight_g),
      total_servings: Number(r.total_servings),
      serving_weight_g: Number(r.serving_weight_g),
      per100g: vectorFromRow(r),
    })),
  };
}

export async function deleteRecipe(id: string): Promise<ActionResult<true>> {
  const a = await authed();
  if (!a) return UNAUTH;
  const { error } = await a.supabase.from("custom_recipes").delete().eq("id", id).eq("user_id", a.userId);
  return error ? { ok: false, error: "common.error" } : { ok: true, data: true };
}
