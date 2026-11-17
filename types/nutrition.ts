// Unified nutrition schema: 6 macros + 13 micronutrients, one canonical unit each.

export const MACRO_KEYS = [
  "calories_kcal",
  "protein_g",
  "carbs_g",
  "fat_g",
  "fiber_g",
  "sugar_g",
] as const;

export const MICRO_KEYS = [
  "iron_mg",
  "calcium_mg",
  "magnesium_mg",
  "potassium_mg",
  "zinc_mg",
  "sodium_mg",
  "vitamin_a_mcg",
  "vitamin_b12_mcg",
  "vitamin_c_mg",
  "vitamin_d_mcg",
  "vitamin_e_mg",
  "vitamin_k_mcg",
  "folate_mcg",
] as const;

export const NUTRIENT_KEYS = [...MACRO_KEYS, ...MICRO_KEYS] as const;

export type MacroKey = (typeof MACRO_KEYS)[number];
export type MicroKey = (typeof MICRO_KEYS)[number];
export type NutrientKey = (typeof NUTRIENT_KEYS)[number];

export type CanonicalUnit = "kcal" | "g" | "mg" | "mcg";

export const NUTRIENT_UNITS: Record<NutrientKey, CanonicalUnit> = {
  calories_kcal: "kcal",
  protein_g: "g",
  carbs_g: "g",
  fat_g: "g",
  fiber_g: "g",
  sugar_g: "g",
  iron_mg: "mg",
  calcium_mg: "mg",
  magnesium_mg: "mg",
  potassium_mg: "mg",
  zinc_mg: "mg",
  sodium_mg: "mg",
  vitamin_a_mcg: "mcg",
  vitamin_b12_mcg: "mcg",
  vitamin_c_mg: "mg",
  vitamin_d_mcg: "mcg",
  vitamin_e_mg: "mg",
  vitamin_k_mcg: "mcg",
  folate_mcg: "mcg",
};

export type NutrientVector = Record<NutrientKey, number>;
export type PartialNutrients = Partial<Record<NutrientKey, number>>;

export type Lang = "fr" | "en";
export type Sex = "male" | "female";
export type ActivityLevel =
  | "sedentary"
  | "light"
  | "moderate"
  | "active"
  | "very_active";
export type MealType = "breakfast" | "lunch" | "dinner" | "snack";
export type SourceType =
  | "custom_recipe"
  | "custom_food"
  | "openfoodfacts"
  | "usda"
  | "ai_estimate"
  | "manual";
export type FoodType = "whole_food" | "packaged" | "dish";

export interface ResolvedItem {
  id: string; // client-side uid
  name: string; // display name in the requested language
  name_fr: string;
  name_en: string;
  grams: number;
  confidence: number; // 0..1
  source: SourceType;
  source_ref_id: string | null; // custom_foods.id / custom_recipes.id / OFF barcode / USDA fdcId
  source_label: string | null; // matched product / entry name
  per100g: NutrientVector;
  nutrients: NutrientVector; // totals for `grams`
  backfilled_keys: NutrientKey[]; // fields filled by the AI estimate
  missing_keys: NutrientKey[]; // fields with no data at all (set to 0)
  serving_weight_g: number | null;
}

export interface FoodCandidate {
  id: string;
  name: string;
  brand: string | null;
  source: Exclude<SourceType, "ai_estimate" | "manual">;
  per100g: PartialNutrients;
  serving_weight_g: number | null;
}

export type AnalyzeFoodResult =
  | { ok: true; items: ResolvedItem[]; authenticated: boolean; warnings: string[] }
  | { ok: false; error: string };

export type SearchFoodsResult =
  | { ok: true; candidates: FoodCandidate[] }
  | { ok: false; error: string };

export interface AnalyzeFoodInput {
  imageBase64?: string; // raw base64 (no data: prefix) — never persisted
  mimeType?: "image/jpeg" | "image/png" | "image/webp";
  text?: string;
  lang: Lang;
}

// ---------------------------------------------------------------------------
// Vector helpers
// ---------------------------------------------------------------------------

export function emptyNutrients(): NutrientVector {
  const v = {} as NutrientVector;
  for (const k of NUTRIENT_KEYS) v[k] = 0;
  return v;
}

export function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

export function scaleNutrients(per100g: NutrientVector, grams: number): NutrientVector {
  const f = grams / 100;
  const out = {} as NutrientVector;
  for (const k of NUTRIENT_KEYS) out[k] = round3((per100g[k] || 0) * f);
  return out;
}

export function addNutrients(a: NutrientVector, b: NutrientVector): NutrientVector {
  const out = {} as NutrientVector;
  for (const k of NUTRIENT_KEYS) out[k] = round3((a[k] || 0) + (b[k] || 0));
  return out;
}

export function sumNutrients(list: NutrientVector[]): NutrientVector {
  return list.reduce(addNutrients, emptyNutrients());
}

/** Keys that are undefined / non-finite in a partial vector. */
export function missingKeys(p: PartialNutrients): NutrientKey[] {
  return NUTRIENT_KEYS.filter((k) => !Number.isFinite(p[k]));
}

/**
 * Graceful-degradation merge: values from `primary` win; only keys that are
 * missing in `primary` are taken from `fallback`. Remaining gaps become 0 and
 * are reported in `missing`.
 */
export function mergeMissing(
  primary: PartialNutrients,
  fallback: PartialNutrients | null,
): { vector: NutrientVector; backfilled: NutrientKey[]; missing: NutrientKey[] } {
  const vector = emptyNutrients();
  const backfilled: NutrientKey[] = [];
  const missing: NutrientKey[] = [];
  for (const k of NUTRIENT_KEYS) {
    const p = primary[k];
    if (typeof p === "number" && Number.isFinite(p) && p >= 0) {
      vector[k] = round3(p);
      continue;
    }
    const f = fallback?.[k];
    if (typeof f === "number" && Number.isFinite(f) && f >= 0) {
      vector[k] = round3(f);
      backfilled.push(k);
    } else {
      missing.push(k);
    }
  }
  return { vector, backfilled, missing };
}

// ---------------------------------------------------------------------------
// Unit normalizer (g / mg / mcg|µg / kJ / IU -> canonical unit of each key)
// ---------------------------------------------------------------------------

const MASS_TO_MG: Record<string, number> = {
  kg: 1_000_000,
  g: 1000,
  mg: 1,
  mcg: 0.001,
  ug: 0.001,
};

// IU conversions (only defined for vitamins that have a standard factor).
const IU_FACTORS: Partial<Record<NutrientKey, number>> = {
  vitamin_a_mcg: 0.3, // 1 IU retinol = 0.3 mcg RAE
  vitamin_d_mcg: 0.025, // 1 IU = 0.025 mcg
  vitamin_e_mg: 0.67, // 1 IU d-alpha-tocopherol (natural) = 0.67 mg
};

export function normalizeUnitName(unit: string | null | undefined): string {
  return (unit ?? "")
    .toLowerCase()
    .replace(/[µμ]/g, "u") // micro sign & greek mu
    .replace(/\s+/g, "")
    .replace(/^ug$/, "ug")
    .replace(/^mcg$/, "mcg");
}

/**
 * Convert `value` expressed in `unit` into the canonical unit of `key`.
 * Returns undefined when the value or conversion is invalid, so callers can
 * treat it as "missing" (and backfill) instead of silently using 0.
 */
export function toCanonical(
  key: NutrientKey,
  value: unknown,
  unit: string | null | undefined,
): number | undefined {
  const n = typeof value === "string" ? parseFloat(value.replace(",", ".")) : Number(value);
  if (!Number.isFinite(n) || n < 0) return undefined;
  const u = normalizeUnitName(unit);
  const canonical = NUTRIENT_UNITS[key];

  if (canonical === "kcal") {
    if (u === "kj") return round3(n / 4.184);
    if (u === "" || u === "kcal" || u === "cal") return round3(n);
    return undefined;
  }

  if (u === "iu") {
    const f = IU_FACTORS[key];
    return f === undefined ? undefined : round3(n * f);
  }

  const mgPerUnit = MASS_TO_MG[u === "" ? canonical : u];
  if (mgPerUnit === undefined) return undefined;
  const mg = n * mgPerUnit;
  if (canonical === "g") return round3(mg / 1000);
  if (canonical === "mg") return round3(mg);
  return round3(mg * 1000); // mcg
}

export const saltGramsToSodiumMg = (saltG: number) => round3(saltG * 400);

// ---------------------------------------------------------------------------
// Recipe math (raw ingredients -> cooked yield)
// ---------------------------------------------------------------------------

export interface RecipeIngredientInput {
  grams: number;
  per100g: NutrientVector;
}

export interface RecipeComputation {
  raw_weight_g: number;
  cooked_weight_g: number;
  total_servings: number;
  serving_weight_g: number;
  totals: NutrientVector; // whole pot
  per100g: NutrientVector; // totals / cooked_weight * 100
  perServing: NutrientVector;
}

export function computeRecipe(
  ingredients: RecipeIngredientInput[],
  cookedWeightG: number | null | undefined,
  totalServings: number | null | undefined,
): RecipeComputation {
  const raw = ingredients.reduce((s, i) => s + Math.max(0, i.grams || 0), 0);
  const cooked =
    typeof cookedWeightG === "number" && Number.isFinite(cookedWeightG) && cookedWeightG > 0
      ? cookedWeightG
      : raw; // fallback: sum of raw ingredient grams
  const servings =
    typeof totalServings === "number" && Number.isFinite(totalServings) && totalServings > 0
      ? totalServings
      : 1;
  const totals = sumNutrients(ingredients.map((i) => scaleNutrients(i.per100g, Math.max(0, i.grams || 0))));
  const per100g = cooked > 0 ? scaleNutrients(totals, 10000 / cooked) : emptyNutrients();
  // scaleNutrients(x, 10000/cooked) multiplies by 100/cooked => totals / cooked * 100
  const serving = cooked / servings;
  return {
    raw_weight_g: round3(raw),
    cooked_weight_g: round3(cooked),
    total_servings: servings,
    serving_weight_g: round3(serving),
    totals,
    per100g,
    perServing: scaleNutrients(per100g, serving),
  };
}

// ---------------------------------------------------------------------------
// Profile & targets
// ---------------------------------------------------------------------------

export type TargetMode = "auto" | "manual";
export type NutrientTargets = Partial<Record<NutrientKey, { mode: TargetMode; value?: number }>>;

export interface UserProfile {
  age: number | null;
  weight_kg: number | null;
  height_cm: number | null;
  sex: Sex | null;
  activity_level: ActivityLevel;
  preferred_language: Lang;
  nutrient_targets: NutrientTargets;
}

export const DEFAULT_PROFILE: UserProfile = {
  age: 30,
  weight_kg: 70,
  height_cm: 170,
  sex: "male",
  activity_level: "moderate",
  preferred_language: "fr",
  nutrient_targets: {},
};
