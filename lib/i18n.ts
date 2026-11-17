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

export const LANG_NAMES: Record<Lang, string> = { fr: "Français", en: "English", de: "Deutsch" };

export const NUTRIENT_LABELS: Record<NutrientKey, Record<Lang, string>> = {
  calories_kcal: { fr: "Calories", en: "Calories", de: "Kalorien" },
  protein_g: { fr: "Protéines", en: "Protein", de: "Eiweiß" },
  carbs_g: { fr: "Glucides", en: "Carbs", de: "Kohlenhydrate" },
  fat_g: { fr: "Lipides", en: "Fat", de: "Fett" },
  fiber_g: { fr: "Fibres", en: "Fiber", de: "Ballaststoffe" },
  sugar_g: { fr: "Sucres", en: "Sugar", de: "Zucker" },
  iron_mg: { fr: "Fer", en: "Iron", de: "Eisen" },
  calcium_mg: { fr: "Calcium", en: "Calcium", de: "Kalzium" },
  magnesium_mg: { fr: "Magnésium", en: "Magnesium", de: "Magnesium" },
  potassium_mg: { fr: "Potassium", en: "Potassium", de: "Kalium" },
  zinc_mg: { fr: "Zinc", en: "Zinc", de: "Zink" },
  sodium_mg: { fr: "Sodium", en: "Sodium", de: "Natrium" },
  vitamin_a_mcg: { fr: "Vitamine A", en: "Vitamin A", de: "Vitamin A" },
  vitamin_b12_mcg: { fr: "Vitamine B12", en: "Vitamin B12", de: "Vitamin B12" },
  vitamin_c_mg: { fr: "Vitamine C", en: "Vitamin C", de: "Vitamin C" },
  vitamin_d_mcg: { fr: "Vitamine D", en: "Vitamin D", de: "Vitamin D" },
  vitamin_e_mg: { fr: "Vitamine E", en: "Vitamin E", de: "Vitamin E" },
  vitamin_k_mcg: { fr: "Vitamine K", en: "Vitamin K", de: "Vitamin K" },
  folate_mcg: { fr: "Folates (B9)", en: "Folate (B9)", de: "Folsäure (B9)" },
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
  "capture.takePhoto": "Prendre une photo / Take Photo",
  "capture.choosePhoto": "Galerie / Upload",
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
  "scan.button": "Scanner un code-barres",
  "scan.title": "Scanner un code-barres",
  "scan.hint": "Placez le code-barres dans le cadre, bien éclairé.",
  "scan.photoFallback": "Prendre une photo du code-barres",
  "scan.manual": "Ou saisir le code (EAN / UPC)",
  "scan.insecure": "Le scan en direct nécessite HTTPS. Utilisez la photo ou saisissez le code.",
  "scan.camError": "Impossible d'ouvrir la caméra. Utilisez la photo ou saisissez le code.",
  "scan.reading": "Lecture…",
  "scan.noCode": "Aucun code-barres lisible sur la photo.",
  "scan.invalid": "Code-barres invalide (8 à 14 chiffres).",
  "scan.notFound": "Produit introuvable sur OpenFoodFacts. Essayez la photo ou la recherche texte.",
  "swap.placeholder": "Rechercher un aliment (FR / EN / DE)…",
  "swap.none": "Aucun résultat.",
  "diary.avgPerDay": "Moyenne par jour sur la semaine",
  "recipe.ingredients": "Ingrédients",
  "recipe.myRecipes": "Mes recettes",
  "recipe.empty": "Aucune recette enregistrée.",
  "recipe.saved": "Recette enregistrée",
  "auth.partial": "Certaines données personnalisées sont indisponibles.",
  "auth.title": "Connexion",
  "auth.signIn": "Se connecter",
  "auth.signUp": "Créer un compte",
  "auth.email": "E-mail",
  "auth.password": "Mot de passe (6 caractères min.)",
  "auth.stay": "Rester connecté",
  "auth.noAccount": "Pas de compte ? Créer un compte",
  "auth.haveAccount": "Déjà un compte ? Se connecter",
  "auth.signOut": "Se déconnecter",
  "auth.checkEmail": "Compte créé. Confirmez votre e-mail puis connectez-vous.",
  "auth.invalid": "E-mail ou mot de passe incorrect.",
  "auth.weak": "Mot de passe trop court (6 caractères min.).",
  "auth.failed": "Connexion impossible, réessayez.",
  "recipe.bulkTitle": "Ajout rapide (collez tous les ingrédients)",
  "recipe.bulkPlaceholder": "200g poulet, 150g riz cuit, 10g huile d'olive",
  "recipe.bulkAdd": "Analyser et ajouter",
  "recipe.bulkFailed": "Certains ingrédients ont été estimés par l'IA.",
  "recipe.resolving": "Calcul en cours…",
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
  "capture.takePhoto": "Prendre une photo / Take Photo",
  "capture.choosePhoto": "Galerie / Upload",
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
  "scan.button": "Scan a barcode",
  "scan.title": "Scan a barcode",
  "scan.hint": "Hold the barcode inside the frame with good lighting.",
  "scan.photoFallback": "Take a photo of the barcode",
  "scan.manual": "Or type the code (EAN / UPC)",
  "scan.insecure": "Live scanning needs HTTPS. Use the photo option or type the code.",
  "scan.camError": "Could not open the camera. Use the photo option or type the code.",
  "scan.reading": "Reading…",
  "scan.noCode": "No readable barcode in the photo.",
  "scan.invalid": "Invalid barcode (8 to 14 digits).",
  "scan.notFound": "Product not found on OpenFoodFacts. Try a photo or text search.",
  "swap.placeholder": "Search a food (FR / EN / DE)…",
  "swap.none": "No results.",
  "diary.avgPerDay": "Daily average over the week",
  "recipe.ingredients": "Ingredients",
  "recipe.myRecipes": "My recipes",
  "recipe.empty": "No saved recipes.",
  "recipe.saved": "Recipe saved",
  "auth.partial": "Some personal data is unavailable.",
  "auth.title": "Sign in",
  "auth.signIn": "Sign in",
  "auth.signUp": "Create account",
  "auth.email": "Email",
  "auth.password": "Password (min. 6 characters)",
  "auth.stay": "Stay signed in",
  "auth.noAccount": "No account? Create one",
  "auth.haveAccount": "Already have an account? Sign in",
  "auth.signOut": "Sign out",
  "auth.checkEmail": "Account created. Confirm your email, then sign in.",
  "auth.invalid": "Wrong email or password.",
  "auth.weak": "Password too short (min. 6 characters).",
  "auth.failed": "Could not sign in, please retry.",
  "recipe.bulkTitle": "Quick add (paste all ingredients)",
  "recipe.bulkPlaceholder": "250g Magerquark, 50g oats, 100g blueberries",
  "recipe.bulkAdd": "Analyze and add",
  "recipe.bulkFailed": "Some ingredients were estimated by AI.",
  "recipe.resolving": "Computing…",
  "error.unauthenticated": "Not signed in",
  "error.noInput": "Add a photo or describe your meal.",
  "error.imageTooLarge": "Image too large.",
  "error.aiUnavailable": "AI is unavailable, please retry shortly.",
};

const de: Dict = {
  "app.name": "Nutri Tracker",
  "nav.log": "Mahlzeit",
  "nav.diary": "Tagebuch",
  "nav.recipes": "Rezepte",
  "nav.settings": "Einstellungen",
  "common.save": "Speichern",
  "common.cancel": "Abbrechen",
  "common.delete": "Löschen",
  "common.edit": "Bearbeiten",
  "common.close": "Schließen",
  "common.search": "Suchen",
  "common.loading": "Lädt…",
  "common.error": "Etwas ist schiefgelaufen",
  "common.grams": "Gramm",
  "common.total": "Gesamt",
  "common.per100g": "Pro 100 g",
  "common.perServing": "Pro Portion",
  "common.macros": "Makronährstoffe",
  "common.micros": "Mikronährstoffe",
  "capture.title": "Mahlzeit hinzufügen",
  "capture.takePhoto": "Foto aufnehmen / Take Photo",
  "capture.choosePhoto": "Galerie / Upload",
  "capture.textPlaceholder": "z. B. Brathähnchen, Reis und grüne Bohnen",
  "capture.analyze": "Analysieren",
  "capture.analyzing": "Analyse läuft…",
  "capture.photoDiscarded": "Das Foto wird analysiert und sofort gelöscht.",
  "capture.cameraDenied": "Kamerazugriff verweigert.",
  "decomp.title": "Zusammensetzung der Mahlzeit",
  "decomp.confidence": "Sicherheit",
  "decomp.swap": "Lebensmittel ändern",
  "decomp.remove": "Entfernen",
  "decomp.addToDiary": "Zum Tagebuch hinzufügen",
  "decomp.backfilled": "Werte von der KI ergänzt",
  "decomp.noItems": "Kein Lebensmittel erkannt.",
  "source.custom_recipe": "Eigenes Rezept",
  "source.custom_food": "Eigenes Lebensmittel",
  "source.openfoodfacts": "OpenFoodFacts",
  "source.usda": "USDA",
  "source.ai_estimate": "KI-Schätzung",
  "source.manual": "Manuell",
  "meal.breakfast": "Frühstück",
  "meal.lunch": "Mittagessen",
  "meal.dinner": "Abendessen",
  "meal.snack": "Snack",
  "recipe.title": "Neues Rezept",
  "recipe.name": "Rezeptname",
  "recipe.addIngredient": "Zutat hinzufügen",
  "recipe.cookedWeight": "Endgewicht gekocht (g)",
  "recipe.servings": "Anzahl Portionen",
  "recipe.rawWeight": "Gesamtgewicht roh",
  "recipe.servingWeight": "Portionsgewicht",
  "diary.title": "Tagebuch",
  "diary.day": "Tag",
  "diary.week": "Woche",
  "diary.month": "Monat",
  "diary.today": "Heute",
  "diary.empty": "Keine Mahlzeiten eingetragen.",
  "targets.title": "Nährstoffziele",
  "targets.auto": "Empfohlen (auto)",
  "targets.manual": "Manuell",
  "targets.age": "Alter",
  "targets.weight": "Gewicht (kg)",
  "targets.height": "Größe (cm)",
  "targets.sex": "Geschlecht",
  "targets.male": "Männlich",
  "targets.female": "Weiblich",
  "targets.activity": "Aktivität",
  "activity.sedentary": "Sitzend",
  "activity.light": "Leicht aktiv",
  "activity.moderate": "Mäßig aktiv",
  "activity.active": "Aktiv",
  "activity.very_active": "Sehr aktiv",
  "settings.language": "Sprache",
  "auth.required": "Melden Sie sich an, um Ihre Rezepte und Ihr Tagebuch zu nutzen.",
  "auth.title": "Anmelden",
  "auth.signIn": "Anmelden",
  "auth.signUp": "Konto erstellen",
  "auth.email": "E-Mail",
  "auth.password": "Passwort (mind. 6 Zeichen)",
  "auth.stay": "Angemeldet bleiben",
  "auth.noAccount": "Noch kein Konto? Konto erstellen",
  "auth.haveAccount": "Schon ein Konto? Anmelden",
  "auth.signOut": "Abmelden",
  "auth.checkEmail": "Konto erstellt. Bestätigen Sie Ihre E-Mail und melden Sie sich dann an.",
  "auth.invalid": "E-Mail oder Passwort falsch.",
  "auth.weak": "Passwort zu kurz (mind. 6 Zeichen).",
  "auth.failed": "Anmeldung fehlgeschlagen, bitte erneut versuchen.",
  "scan.button": "Barcode scannen",
  "scan.title": "Barcode scannen",
  "scan.hint": "Halten Sie den Barcode bei guter Beleuchtung in den Rahmen.",
  "scan.photoFallback": "Foto des Barcodes aufnehmen",
  "scan.manual": "Oder Code eingeben (EAN / UPC)",
  "scan.insecure": "Live-Scan benötigt HTTPS. Nutzen Sie das Foto oder geben Sie den Code ein.",
  "scan.camError": "Kamera konnte nicht geöffnet werden. Nutzen Sie das Foto oder geben Sie den Code ein.",
  "scan.reading": "Lese…",
  "scan.noCode": "Kein lesbarer Barcode auf dem Foto.",
  "scan.invalid": "Ungültiger Barcode (8 bis 14 Ziffern).",
  "scan.notFound": "Produkt bei OpenFoodFacts nicht gefunden. Versuchen Sie Foto oder Textsuche.",
  "swap.placeholder": "Lebensmittel suchen (FR / EN / DE)…",
  "swap.none": "Keine Ergebnisse.",
  "diary.avgPerDay": "Tagesdurchschnitt der Woche",
  "recipe.ingredients": "Zutaten",
  "recipe.myRecipes": "Meine Rezepte",
  "recipe.empty": "Keine gespeicherten Rezepte.",
  "recipe.saved": "Rezept gespeichert",
  "recipe.bulkTitle": "Schnelleingabe (alle Zutaten einfügen)",
  "recipe.bulkPlaceholder": "250g Magerquark, 50g Haferflocken, 100g Blaubeeren",
  "recipe.bulkAdd": "Analysieren und hinzufügen",
  "recipe.bulkFailed": "Einige Zutaten wurden von der KI geschätzt.",
  "recipe.resolving": "Berechnung läuft…",
  "auth.partial": "Einige persönliche Daten sind nicht verfügbar.",
  "error.unauthenticated": "Nicht angemeldet",
  "error.noInput": "Foto hinzufügen oder Mahlzeit beschreiben.",
  "error.imageTooLarge": "Bild zu groß.",
  "error.aiUnavailable": "KI nicht verfügbar, bitte gleich erneut versuchen.",
};

export const DICTIONARY: Record<Lang, Dict> = { fr, en, de };

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
    if (saved === "fr" || saved === "en" || saved === "de") return saved;
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
