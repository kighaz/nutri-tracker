import {
  DEFAULT_PROFILE,
  NUTRIENT_KEYS,
  type ActivityLevel,
  type NutrientKey,
  type UserProfile,
} from "@/types/nutrition";

/** Nutrients where the target is a ceiling, not a goal. */
export const LIMIT_KEYS: ReadonlySet<NutrientKey> = new Set<NutrientKey>(["sodium_mg", "sugar_g"]);
const OVER_FLAGGED: ReadonlySet<NutrientKey> = new Set<NutrientKey>([
  "calories_kcal",
  "protein_g",
  "carbs_g",
  "fat_g",
]);

const ACTIVITY_FACTOR: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

/** Recommended daily values: Mifflin-St Jeor energy + ANSES/EFSA-style ANC for adults. */
export function baselineTargets(profile: UserProfile): Record<NutrientKey, number> {
  const age = profile.age ?? DEFAULT_PROFILE.age!;
  const weight = profile.weight_kg ?? DEFAULT_PROFILE.weight_kg!;
  const height = profile.height_cm ?? DEFAULT_PROFILE.height_cm!;
  const male = (profile.sex ?? "male") === "male";

  const bmr = 10 * weight + 6.25 * height - 5 * age + (male ? 5 : -161);
  const kcal = Math.round(bmr * ACTIVITY_FACTOR[profile.activity_level]);
  const protein = Math.round(weight * (profile.activity_level === "sedentary" ? 0.83 : 1.2));
  const fat = Math.round((kcal * 0.35) / 9);
  const carbs = Math.max(0, Math.round((kcal - protein * 4 - fat * 9) / 4));
  const postMeno = !male && age >= 50;

  return {
    calories_kcal: kcal,
    protein_g: protein,
    carbs_g: carbs,
    fat_g: fat,
    fiber_g: 30,
    sugar_g: Math.round((kcal * 0.1) / 4), // free-sugar guideline < 10 % of energy
    iron_mg: male || postMeno ? 11 : 16,
    calcium_mg: age >= 51 || age < 25 ? 1000 : 950,
    magnesium_mg: male ? 420 : 360,
    potassium_mg: 3500,
    zinc_mg: male ? 11 : 8,
    sodium_mg: 2300,
    vitamin_a_mcg: male ? 750 : 650,
    vitamin_b12_mcg: 4,
    vitamin_c_mg: 110,
    vitamin_d_mcg: 15,
    vitamin_e_mg: male ? 11 : 9,
    vitamin_k_mcg: 79,
    folate_mcg: 330,
  };
}

export interface ResolvedTarget {
  value: number;
  auto: number;
  mode: "auto" | "manual";
}

export function resolveTargets(profile: UserProfile): Record<NutrientKey, ResolvedTarget> {
  const auto = baselineTargets(profile);
  const out = {} as Record<NutrientKey, ResolvedTarget>;
  for (const k of NUTRIENT_KEYS) {
    const o = profile.nutrient_targets?.[k];
    const manual = o?.mode === "manual" && typeof o.value === "number" && o.value > 0;
    out[k] = { auto: auto[k], mode: manual ? "manual" : "auto", value: manual ? o!.value! : auto[k] };
  }
  return out;
}

export type ProgressStatus = "low" | "warn" | "ok" | "over";

export function progressStatus(key: NutrientKey, pct: number): ProgressStatus {
  if (LIMIT_KEYS.has(key)) return pct > 100 ? "over" : pct > 85 ? "warn" : "ok";
  if (pct < 50) return "low";
  if (pct < 90) return "warn";
  if (OVER_FLAGGED.has(key) && pct > 130) return "over";
  return "ok";
}

export const STATUS_BAR_CLASS: Record<ProgressStatus, string> = {
  low: "bg-red-500",
  warn: "bg-amber-500",
  ok: "bg-green-600",
  over: "bg-orange-600",
};

/** Local-time YYYY-MM-DD (avoids UTC off-by-one around midnight). */
export function toDateKey(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

export function parseDateKey(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(s: string, n: number): string {
  const d = parseDateKey(s);
  d.setDate(d.getDate() + n);
  return toDateKey(d);
}

/** Monday-based week start. */
export function weekStart(s: string): string {
  const d = parseDateKey(s);
  return addDays(s, -((d.getDay() + 6) % 7));
}
