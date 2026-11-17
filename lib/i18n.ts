"use client";

import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import type { ActivityLevel, Lang, MealType, NutrientKey, SourceType } from "@/types/nutrition";

export const DEFAULT_LANG: Lang = "fr";

export const NUTRIENT_LABELS: Record<NutrientKey, Record<Lang, string>> = {
  calories_kcal: { fr: "Calories", en: "Calories" },
  protein_g: { fr: "Protéines", en: "Protein" },
  carbs_g: { fr: "Glucides", en: "Carbs" },
  fat_g: { fr: "Lipides", en: "Fat" },
  fiber_g: { fr: "Fibres", en: "Fiber" },
  sugar_g: { fr: "Sucres", en: "Sugar" },
  iron_mg: { fr: "Fer", en: "Iron" },
  calcium_mg: { fr: "Calcium", en: "Calcium" },
  magnesium_mg: { fr: "Magnésium", en: "Magnesium" },
  potassium_mg: { fr: "Potassium", en: "Potassium" },
  zinc_mg: { fr: "Zinc", en: "Zinc" },
  sodium_mg: { fr: "Sodium", en: "Sodium" },
  vitamin_a_mcg: { fr: "Vitamine A", en: "Vitamin A" },
  vitamin_b12_mcg: { fr: "Vitamine B12", en: "Vitamin B12" },
  vitamin_c_mg: { fr: "Vitamine C", en: "Vitamin C" },
  vitamin_d_mcg: { fr: "Vitamine D", en: "Vitamin D" },
  vitamin_e_mg: { fr: "Vitamine E", en: "Vitamin E" },
  vitamin_k_mcg: { fr: "Vitamine K", en: "Vitamin K" },
  folate_mcg: { fr: "Folates (B9)", en: "Folate (B9)" },
};

export const UNIT_LABELS = { kcal: "kcal", g: "g", mg: "mg", mcg: "µg" } as const;

type Dict = Record<string, string>;

const fr: Dict = {
  "app.name": "Nutri Tracker",
  "nav.log": "Repas",
  "nav.diary": "Journal",
  "nav.recipes": "Recettes",
  "nav.settings": "Réglages",
  "common.save": "Enregistrer",
  "common.cancel": "Annuler",
  "common.delete": "Supprimer",
  "common.edit": "Modifier",
  "common.close": "Fermer",
  "common.search": "Rechercher",
  "common.loading": "Chargement…",
  "common.error": "Une erreur est survenue",
  "common.grams": "grammes",
  "common.total": "Total",
  "common.per100g": "Pour 100 g",
  "common.perServing": "Par portion",
  "common.macros": "Macronutriments",
  "common.micros": "Micronutriments",
  "capture.title": "Ajouter un repas",
  "capture.takePhoto": "Prendre une photo",
  "capture.choosePhoto": "Choisir une photo",
  "capture.textPlaceholder": "Ex. : poulet rôti, riz et haricots verts",
  "capture.analyze": "Analyser",
  "capture.analyzing": "Analyse en cours…",
  "capture.photoDiscarded": "La photo est analysée puis supprimée immédiatement.",
  "capture.cameraDenied": "Accès à la caméra refusé.",
  "decomp.title": "Composition du repas",
  "decomp.confidence": "Confiance",
  "decomp.swap": "Changer l'aliment",
  "decomp.remove": "Retirer",
  "decomp.addToDiary": "Ajouter au journal",
  "decomp.backfilled": "Valeurs complétées par l'IA",
  "decomp.noItems": "Aucun aliment détecté.",
  "source.custom_recipe": "Recette perso",
  "source.custom_food": "Aliment perso",
  "source.openfoodfacts": "OpenFoodFacts",
  "source.usda": "USDA",
  "source.ai_estimate": "Estimation IA",
  "source.manual": "Manuel",
  "meal.breakfast": "Petit-déjeuner",
  "meal.lunch": "Déjeuner",
  "meal.dinner": "Dîner",
  "meal.snack": "Collation",
  "recipe.title": "Nouvelle recette",
  "recipe.name": "Nom de la recette",
  "recipe.addIngredient": "Ajouter un ingrédient",
  "recipe.cookedWeight": "Poids final cuit (g)",
  "recipe.servings": "Nombre de portions",
  "recipe.rawWeight": "Poids cru total",
  "recipe.servingWeight": "Poids d'une portion",
  "diary.title": "Journal",
  "diary.day": "Jour",
  "diary.week": "Semaine",
  "diary.month": "Mois",
  "diary.today": "Aujourd'hui",
  "diary.empty": "Aucun repas enregistré.",
  "targets.title": "Objectifs nutritionnels",
  "targets.auto": "Recommandé (auto)",
  "targets.manual": "Manuel",
  "targets.age": "Âge",
  "targets.weight": "Poids (kg)",
  "targets.height": "Taille (cm)",
  "targets.sex": "Sexe",
  "targets.male": "Homme",
  "targets.female": "Femme",
  "targets.activity": "Activité",
  "activity.sedentary": "Sédentaire",
  "activity.light": "Légère",
  "activity.moderate": "Modérée",
  "activity.active": "Active",
  "activity.very_active": "Très active",
  "settings.language": "Langue",
  "auth.required": "Connectez-vous pour utiliser vos recettes et votre journal.",
  "swap.placeholder": "Rechercher un aliment (FR / EN)…",
  "swap.none": "Aucun résultat.",
  "diary.avgPerDay": "Moyenne par jour sur la semaine",
  "recipe.ingredients": "Ingrédients",
  "recipe.myRecipes": "Mes recettes",
  "recipe.empty": "Aucune recette enregistrée.",
  "recipe.saved": "Recette enregistrée",
  "auth.partial": "Certaines données personnalisées sont indisponibles.",
  "error.unauthenticated": "Non connecté",
  "error.noInput": "Ajoutez une photo ou décrivez votre repas.",
  "error.imageTooLarge": "Image trop volumineuse.",
  "error.aiUnavailable": "L'IA est indisponible, réessayez dans un instant.",
};

const en: Dict = {
  "app.name": "Nutri Tracker",
  "nav.log": "Log meal",
  "nav.diary": "Diary",
  "nav.recipes": "Recipes",
  "nav.settings": "Settings",
  "common.save": "Save",
  "common.cancel": "Cancel",
  "common.delete": "Delete",
  "common.edit": "Edit",
  "common.close": "Close",
  "common.search": "Search",
  "common.loading": "Loading…",
  "common.error": "Something went wrong",
  "common.grams": "grams",
  "common.total": "Total",
  "common.per100g": "Per 100 g",
  "common.perServing": "Per serving",
  "common.macros": "Macronutrients",
  "common.micros": "Micronutrients",
  "capture.title": "Add a meal",
  "capture.takePhoto": "Take a photo",
  "capture.choosePhoto": "Choose a photo",
  "capture.textPlaceholder": "e.g. roast chicken, rice and green beans",
  "capture.analyze": "Analyze",
  "capture.analyzing": "Analyzing…",
  "capture.photoDiscarded": "The photo is analyzed, then discarded immediately.",
  "capture.cameraDenied": "Camera access denied.",
  "decomp.title": "Meal breakdown",
  "decomp.confidence": "Confidence",
  "decomp.swap": "Swap item",
  "decomp.remove": "Remove",
  "decomp.addToDiary": "Add to diary",
  "decomp.backfilled": "Values completed by AI",
  "decomp.noItems": "No food detected.",
  "source.custom_recipe": "Custom Recipe",
  "source.custom_food": "Custom Food",
  "source.openfoodfacts": "OpenFoodFacts",
  "source.usda": "USDA",
  "source.ai_estimate": "AI Estimate",
  "source.manual": "Manual",
  "meal.breakfast": "Breakfast",
  "meal.lunch": "Lunch",
  "meal.dinner": "Dinner",
  "meal.snack": "Snack",
  "recipe.title": "New recipe",
  "recipe.name": "Recipe name",
  "recipe.addIngredient": "Add ingredient",
  "recipe.cookedWeight": "Final cooked weight (g)",
  "recipe.servings": "Number of servings",
  "recipe.rawWeight": "Total raw weight",
  "recipe.servingWeight": "Serving weight",
  "diary.title": "Diary",
  "diary.day": "Day",
  "diary.week": "Week",
  "diary.month": "Month",
  "diary.today": "Today",
  "diary.empty": "No meals logged.",
  "targets.title": "Nutrient targets",
  "targets.auto": "Recommended (auto)",
  "targets.manual": "Manual",
  "targets.age": "Age",
  "targets.weight": "Weight (kg)",
  "targets.height": "Height (cm)",
  "targets.sex": "Sex",
  "targets.male": "Male",
  "targets.female": "Female",
  "targets.activity": "Activity",
  "activity.sedentary": "Sedentary",
  "activity.light": "Light",
  "activity.moderate": "Moderate",
  "activity.active": "Active",
  "activity.very_active": "Very active",
  "settings.language": "Language",
  "auth.required": "Sign in to use your recipes and diary.",
  "swap.placeholder": "Search a food (FR / EN)…",
  "swap.none": "No results.",
  "diary.avgPerDay": "Daily average over the week",
  "recipe.ingredients": "Ingredients",
  "recipe.myRecipes": "My recipes",
  "recipe.empty": "No saved recipes.",
  "recipe.saved": "Recipe saved",
  "auth.partial": "Some personal data is unavailable.",
  "error.unauthenticated": "Not signed in",
  "error.noInput": "Add a photo or describe your meal.",
  "error.imageTooLarge": "Image too large.",
  "error.aiUnavailable": "AI is unavailable, please retry shortly.",
};

export const DICTIONARY: Record<Lang, Dict> = { fr, en };

export function translate(lang: Lang, key: string): string {
  return DICTIONARY[lang][key] ?? DICTIONARY[DEFAULT_LANG][key] ?? key;
}

export interface I18nValue {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string) => string;
  nutrient: (key: NutrientKey) => string;
  source: (s: SourceType) => string;
  meal: (m: MealType) => string;
  activity: (a: ActivityLevel) => string;
}

const I18nContext = createContext<I18nValue | null>(null);
const STORAGE_KEY = "nutri.lang";
const listeners = new Set<() => void>();

function subscribe(cb: () => void) {
  listeners.add(cb);
  window.addEventListener("storage", cb);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", cb);
  };
}

function readLang(): Lang {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved === "fr" || saved === "en") return saved;
  } catch {
    /* storage unavailable */
  }
  return DEFAULT_LANG;
}

export function I18nProvider({
  children,
  initialLang = DEFAULT_LANG,
}: {
  children: ReactNode;
  initialLang?: Lang;
}) {
  const lang = useSyncExternalStore(subscribe, readLang, () => initialLang);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback((l: Lang) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, l);
    } catch {
      /* storage unavailable */
    }
    listeners.forEach((f) => f());
  }, []);

  const value = useMemo<I18nValue>(
    () => ({
      lang,
      setLang,
      t: (key) => translate(lang, key),
      nutrient: (key) => NUTRIENT_LABELS[key][lang],
      source: (s) => translate(lang, `source.${s}`),
      meal: (m) => translate(lang, `meal.${m}`),
      activity: (a) => translate(lang, `activity.${a}`),
    }),
    [lang, setLang],
  );

  return createElement(I18nContext.Provider, { value }, children);
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used inside <I18nProvider>");
  return ctx;
}
