import type { MealType, NutrientVector, SourceType, UserProfile } from "@/types/nutrition";

export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

export interface LoggedItem {
  id: string;
  item_name: string;
  source_type: SourceType;
  grams: number;
  confidence: number | null;
  nutrients: NutrientVector;
}

export interface LoggedMeal {
  id: string;
  logged_date: string; // YYYY-MM-DD
  meal_type: MealType;
  note: string | null;
  items: LoggedItem[];
}

export type DailyTotals = Record<string, NutrientVector>;

export interface SaveMealInput {
  date: string;
  mealType: MealType;
  items: {
    name: string;
    source: SourceType;
    source_ref_id: string | null;
    grams: number;
    confidence: number;
    nutrients: NutrientVector;
  }[];
}

export interface RecipeSummary {
  id: string;
  name: string;
  raw_weight_g: number;
  cooked_weight_g: number;
  total_servings: number;
  serving_weight_g: number;
  per100g: NutrientVector;
}

export interface SaveRecipeInput {
  name: string;
  cookedWeightG: number | null;
  totalServings: number;
  ingredients: {
    name: string;
    source: SourceType;
    source_ref_id: string | null;
    grams: number;
    per100g: NutrientVector;
  }[];
}

export type ProfileResult = UserProfile;
