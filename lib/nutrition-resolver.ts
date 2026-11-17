import type { SupabaseClient } from "@supabase/supabase-js";
import {
  NUTRIENT_KEYS,
  mergeMissing,
  saltGramsToSodiumMg,
  scaleNutrients,
  toCanonical,
  type FoodCandidate,
  type FoodType,
  type Lang,
  type NutrientKey,
  type NutrientVector,
  type PartialNutrients,
  type ResolvedItem,
  type SourceType,
} from "@/types/nutrition";

const EXTERNAL_TIMEOUT_MS = 6000;

// ---------------------------------------------------------------------------
// Detected item (output of the Gemini step)
// ---------------------------------------------------------------------------
export interface DetectedItem {
  name_fr: string;
  name_en: string;
  name_de?: string;
  grams: number;
  confidence: number;
  food_type: FoodType;
  matched_custom_id: string | null;
  barcode: string | null;
  estimate: PartialNutrients; // Gemini per-100g estimate (canonical units)
}

// ---------------------------------------------------------------------------
// Text matching
// ---------------------------------------------------------------------------
export function normalizeText(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/œ/g, "oe")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(s: string): string[] {
  return normalizeText(s)
    .split(" ")
    .filter((t) => t.length >= 2)
    .map((t) => t.replace(/(s|x)$/, ""));
}

function bigrams(s: string): string[] {
  const n = normalizeText(s).replace(/\s/g, "");
  const out: string[] = [];
  for (let i = 0; i < n.length - 1; i++) out.push(n.slice(i, i + 2));
  return out;
}

function dice(a: string, b: string): number {
  const A = bigrams(a);
  const B = bigrams(b);
  if (!A.length || !B.length) return normalizeText(a) === normalizeText(b) ? 1 : 0;
  const counts = new Map<string, number>();
  for (const g of A) counts.set(g, (counts.get(g) ?? 0) + 1);
  let hit = 0;
  for (const g of B) {
    const c = counts.get(g) ?? 0;
    if (c > 0) {
      hit++;
      counts.set(g, c - 1);
    }
  }
  return (2 * hit) / (A.length + B.length);
}

/** 0..1 — how well `candidate` answers `query` (query-token coverage + bigram similarity). */
export function matchScore(query: string, candidate: string): number {
  if (normalizeText(query) === normalizeText(candidate)) return 1;
  const q = tokens(query);
  const c = tokens(candidate);
  if (!q.length || !c.length) return 0;
  const covered = q.filter((t) => c.some((x) => x === t || x.startsWith(t) || t.startsWith(x))).length;
  return 0.7 * (covered / q.length) + 0.3 * dice(query, candidate);
}

function bestScore(queries: string[], candidate: string): number {
  return Math.max(0, ...queries.filter(Boolean).map((q) => matchScore(q, candidate)));
}

// ---------------------------------------------------------------------------
// Step A — user's custom foods & recipes
// ---------------------------------------------------------------------------
export interface CustomEntry {
  kind: "custom_recipe" | "custom_food";
  id: string;
  name: string;
  aliases: string[];
  per100g: NutrientVector;
  serving_weight_g: number | null;
}

export type CustomCatalog = CustomEntry[];

type Row = Record<string, unknown>;

function rowToVector(row: Row): NutrientVector {
  const v = {} as NutrientVector;
  for (const k of NUTRIENT_KEYS) v[k] = Number(row[k] ?? 0) || 0;
  return v;
}

export async function loadCustomCatalog(
  supabase: SupabaseClient,
  userId: string,
): Promise<CustomCatalog> {
  const [foods, recipes] = await Promise.all([
    supabase.from("custom_foods").select("*").eq("user_id", userId),
    supabase.from("custom_recipes").select("*").eq("user_id", userId),
  ]);
  const out: CustomCatalog = [];
  for (const r of (recipes.data ?? []) as Row[]) {
    out.push({
      kind: "custom_recipe",
      id: String(r.id),
      name: String(r.name),
      aliases: (r.aliases as string[] | null) ?? [],
      per100g: rowToVector(r),
      serving_weight_g: r.serving_weight_g != null ? Number(r.serving_weight_g) : null,
    });
  }
  for (const f of (foods.data ?? []) as Row[]) {
    out.push({
      kind: "custom_food",
      id: String(f.id),
      name: String(f.name),
      aliases: (f.aliases as string[] | null) ?? [],
      per100g: rowToVector(f),
      serving_weight_g: null,
    });
  }
  return out;
}

/** Text injected in the Gemini prompt so homemade dishes are recognised. */
export function buildCustomContext(catalog: CustomCatalog): string {
  if (!catalog.length) return "(none)";
  return catalog
    .slice(0, 200)
    .map((e) => {
      const alias = e.aliases.length ? ` | aliases: ${e.aliases.join(", ")}` : "";
      const serving = e.serving_weight_g ? ` | 1 serving ≈ ${Math.round(e.serving_weight_g)} g` : "";
      return `- id=${e.id} | ${e.kind === "custom_recipe" ? "RECIPE" : "FOOD"} | ${e.name}${alias}${serving}`;
    })
    .join("\n");
}

const CUSTOM_MATCH_THRESHOLD = 0.82;

export function findCustomMatch(
  catalog: CustomCatalog,
  item: Pick<DetectedItem, "name_fr" | "name_en" | "name_de" | "matched_custom_id">,
): CustomEntry | null {
  if (item.matched_custom_id) {
    const byId = catalog.find((e) => e.id === item.matched_custom_id);
    if (byId) return byId;
  }
  const queries = [item.name_fr, item.name_en, item.name_de ?? ""].filter(Boolean);
  let best: { e: CustomEntry; s: number } | null = null;
  for (const e of catalog) {
    const s = bestScore(queries, e.name);
    const sa = Math.max(0, ...e.aliases.map((a) => bestScore(queries, a)));
    const score = Math.max(s, sa);
    if (!best || score > best.s) best = { e, s: score };
  }
  return best && best.s >= CUSTOM_MATCH_THRESHOLD ? best.e : null;
}

export function searchCustomCatalog(catalog: CustomCatalog, query: string, limit = 5): FoodCandidate[] {
  return catalog
    .map((e) => ({ e, s: Math.max(matchScore(query, e.name), ...e.aliases.map((a) => matchScore(query, a))) }))
    .filter((x) => x.s >= 0.5)
    .sort((a, b) => b.s - a.s)
    .slice(0, limit)
    .map(({ e }) => ({
      id: e.id,
      name: e.name,
      brand: null,
      source: e.kind,
      per100g: e.per100g,
      serving_weight_g: e.serving_weight_g,
    }));
}

// ---------------------------------------------------------------------------
// Step B — OpenFoodFacts
// ---------------------------------------------------------------------------
const OFF_FIELDS = "code,product_name,product_name_fr,product_name_en,product_name_de,brands,nutriments,serving_quantity";

const OFF_KEYS: Record<NutrientKey, string> = {
  calories_kcal: "energy-kcal",
  protein_g: "proteins",
  carbs_g: "carbohydrates",
  fat_g: "fat",
  fiber_g: "fiber",
  sugar_g: "sugars",
  iron_mg: "iron",
  calcium_mg: "calcium",
  magnesium_mg: "magnesium",
  potassium_mg: "potassium",
  zinc_mg: "zinc",
  sodium_mg: "sodium",
  vitamin_a_mcg: "vitamin-a",
  vitamin_b12_mcg: "vitamin-b12",
  vitamin_c_mg: "vitamin-c",
  vitamin_d_mcg: "vitamin-d",
  vitamin_e_mg: "vitamin-e",
  vitamin_k_mcg: "vitamin-k",
  folate_mcg: "vitamin-b9",
};

function mapOffNutriments(n: Record<string, unknown> | undefined): PartialNutrients {
  const out: PartialNutrients = {};
  if (!n) return out;
  for (const key of NUTRIENT_KEYS) {
    const base = OFF_KEYS[key];
    // OFF "_100g" fields are in grams (kcal for energy-kcal, kJ for energy).
    let raw = n[`${base}_100g`];
    let unit: string = key === "calories_kcal" ? "kcal" : "g";
    if (raw === undefined && key === "folate_mcg") raw = n["folates_100g"];
    if (raw === undefined && key === "calories_kcal" && n["energy_100g"] !== undefined) {
      raw = n["energy_100g"];
      unit = "kj";
    }
    if (raw === undefined && key === "sodium_mg" && n["salt_100g"] !== undefined) {
      const salt = Number(n["salt_100g"]);
      if (Number.isFinite(salt) && salt >= 0) out[key] = saltGramsToSodiumMg(salt);
      continue;
    }
    if (raw === undefined || raw === null || raw === "") continue;
    const v = toCanonical(key, raw, unit);
    if (v !== undefined) out[key] = v;
  }
  return out;
}

interface OffProduct {
  code?: string;
  product_name?: string;
  product_name_fr?: string;
  product_name_en?: string;
  product_name_de?: string;
  brands?: string;
  nutriments?: Record<string, unknown>;
  serving_quantity?: number | string;
}

function offToCandidate(p: OffProduct, lang: Lang): FoodCandidate | null {
  const localized = lang === "fr" ? p.product_name_fr : lang === "de" ? p.product_name_de : p.product_name_en;
  const name =
    localized || p.product_name || p.product_name_fr || p.product_name_en || p.product_name_de;
  if (!name || !p.code) return null;
  const per100g = mapOffNutriments(p.nutriments);
  if (per100g.calories_kcal === undefined) return null;
  const serving = Number(p.serving_quantity);
  return {
    id: p.code,
    name,
    brand: p.brands ? p.brands.split(",")[0].trim() : null,
    source: "openfoodfacts",
    per100g,
    serving_weight_g: Number.isFinite(serving) && serving > 0 ? serving : null,
  };
}

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(EXTERNAL_TIMEOUT_MS),
      headers: { Accept: "application/json", "User-Agent": "NutriTrackerPWA/1.0" },
      cache: "no-store",
    });
    if (!res.ok) return null; // 429 / 5xx -> degrade gracefully
    return (await res.json()) as T;
  } catch {
    return null; // timeout / network
  }
}

export async function searchOpenFoodFacts(query: string, lang: Lang, limit = 6): Promise<FoodCandidate[]> {
  const host = lang === "fr" ? "fr.openfoodfacts.org" : lang === "de" ? "de.openfoodfacts.org" : "world.openfoodfacts.org";
  const url =
    `https://${host}/cgi/search.pl?search_terms=${encodeURIComponent(query)}` +
    `&search_simple=1&action=process&json=1&page_size=${limit * 2}&lc=${lang}` +
    `&fields=${OFF_FIELDS}`;
  const data = await fetchJson<{ products?: OffProduct[] }>(url);
  return (data?.products ?? [])
    .map((p) => offToCandidate(p, lang))
    .filter((c): c is FoodCandidate => c !== null)
    .slice(0, limit);
}

export async function fetchOpenFoodFactsBarcode(barcode: string, lang: Lang): Promise<FoodCandidate | null> {
  if (!/^\d{8,14}$/.test(barcode)) return null;
  const url = `https://world.openfoodfacts.org/api/v2/product/${barcode}.json?fields=${OFF_FIELDS}&lc=${lang}`;
  const data = await fetchJson<{ status?: number; product?: OffProduct }>(url);
  if (!data?.product || data.status === 0) return null;
  return offToCandidate({ ...data.product, code: data.product.code ?? barcode }, lang);
}

// ---------------------------------------------------------------------------
// Step B — USDA FoodData Central
// ---------------------------------------------------------------------------
interface UsdaNutrient {
  nutrientId?: number;
  nutrientNumber?: string;
  unitName?: string;
  value?: number;
}
interface UsdaFood {
  fdcId: number;
  description: string;
  brandOwner?: string;
  foodNutrients?: UsdaNutrient[];
}

// nutrientNumber (legacy) and nutrientId (new) -> our key. First hit wins.
const USDA_IDS: Record<NutrientKey, { numbers: string[]; ids: number[] }> = {
  calories_kcal: { numbers: ["208"], ids: [1008, 2047, 2048] },
  protein_g: { numbers: ["203"], ids: [1003] },
  carbs_g: { numbers: ["205"], ids: [1005] },
  fat_g: { numbers: ["204"], ids: [1004] },
  fiber_g: { numbers: ["291"], ids: [1079] },
  sugar_g: { numbers: ["269", "269.3"], ids: [2000, 1063] },
  iron_mg: { numbers: ["303"], ids: [1089] },
  calcium_mg: { numbers: ["301"], ids: [1087] },
  magnesium_mg: { numbers: ["304"], ids: [1090] },
  potassium_mg: { numbers: ["306"], ids: [1092] },
  zinc_mg: { numbers: ["309"], ids: [1095] },
  sodium_mg: { numbers: ["307"], ids: [1093] },
  vitamin_a_mcg: { numbers: ["320"], ids: [1106] }, // RAE
  vitamin_b12_mcg: { numbers: ["418"], ids: [1178] },
  vitamin_c_mg: { numbers: ["401"], ids: [1162] },
  vitamin_d_mcg: { numbers: ["328"], ids: [1114] },
  vitamin_e_mg: { numbers: ["323"], ids: [1109] },
  vitamin_k_mcg: { numbers: ["430"], ids: [1185] },
  folate_mcg: { numbers: ["435"], ids: [1190] }, // DFE
};

function mapUsdaNutrients(list: UsdaNutrient[] | undefined): PartialNutrients {
  const out: PartialNutrients = {};
  if (!list) return out;
  for (const key of NUTRIENT_KEYS) {
    const m = USDA_IDS[key];
    const hit = list.find(
      (n) =>
        (n.nutrientNumber !== undefined && m.numbers.includes(String(n.nutrientNumber))) ||
        (n.nutrientId !== undefined && m.ids.includes(n.nutrientId)),
    );
    if (!hit || hit.value === undefined) continue;
    const v = toCanonical(key, hit.value, hit.unitName ?? undefined);
    if (v !== undefined) out[key] = v;
  }
  // Energy only reported in kJ (nutrient 1062 / 268)
  if (out.calories_kcal === undefined) {
    const kj = list.find((n) => n.nutrientId === 1062 || n.nutrientNumber === "268");
    if (kj?.value !== undefined) out.calories_kcal = toCanonical("calories_kcal", kj.value, "kJ");
  }
  return out;
}

export async function searchUsda(query: string, limit = 6): Promise<FoodCandidate[]> {
  const apiKey = process.env.USDA_API_KEY;
  if (!apiKey) return [];
  const url =
    `https://api.nal.usda.gov/fdc/v1/foods/search?query=${encodeURIComponent(query)}` +
    `&dataType=${encodeURIComponent("Foundation,SR Legacy")}&pageSize=${limit}&api_key=${apiKey}`;
  const data = await fetchJson<{ foods?: UsdaFood[] }>(url);
  return (data?.foods ?? [])
    .map((f): FoodCandidate => ({
      id: String(f.fdcId),
      name: f.description,
      brand: f.brandOwner ?? null,
      source: "usda",
      per100g: mapUsdaNutrients(f.foodNutrients),
      serving_weight_g: null,
    }))
    .filter((c) => c.per100g.calories_kcal !== undefined);
}

// ---------------------------------------------------------------------------
// Step C — merge + resolve
// ---------------------------------------------------------------------------
function pickBest(
  candidates: FoodCandidate[],
  queries: string[],
  minScore: number,
): FoodCandidate | null {
  let best: { c: FoodCandidate; s: number } | null = null;
  for (const c of candidates) {
    const s = bestScore(queries, c.name);
    if (!best || s > best.s) best = { c, s };
  }
  return best && best.s >= minScore ? best.c : null;
}

function buildItem(args: {
  name_fr: string;
  name_en: string;
  name_de?: string;
  lang: Lang;
  grams: number;
  confidence: number;
  source: SourceType;
  source_ref_id: string | null;
  source_label: string | null;
  primary: PartialNutrients;
  estimate: PartialNutrients | null;
  serving_weight_g: number | null;
}): ResolvedItem {
  const { vector, backfilled, missing } = mergeMissing(args.primary, args.estimate);
  const grams = Math.max(1, Math.round(args.grams));
  return {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2),
    name:
      (args.lang === "fr" ? args.name_fr : args.lang === "de" ? args.name_de : args.name_en) ||
      args.name_fr ||
      args.name_en,
    name_fr: args.name_fr,
    name_en: args.name_en,
    name_de: args.name_de,
    grams,
    confidence: Math.min(1, Math.max(0, args.confidence)),
    source: args.source,
    source_ref_id: args.source_ref_id,
    source_label: args.source_label,
    per100g: vector,
    nutrients: scaleNutrients(vector, grams),
    backfilled_keys: backfilled,
    missing_keys: missing,
    serving_weight_g: args.serving_weight_g,
  };
}

/** Wrap an already-chosen candidate (e.g. from the swap modal) into a ResolvedItem. */
export function resolveFromCandidate(
  candidate: FoodCandidate,
  opts: {
    lang: Lang;
    grams: number;
    confidence?: number;
    estimate: PartialNutrients | null;
    name_fr?: string;
    name_en?: string;
    name_de?: string;
  },
): ResolvedItem {
  return buildItem({
    name_fr: opts.name_fr ?? candidate.name,
    name_en: opts.name_en ?? candidate.name,
    name_de: opts.name_de,
    lang: opts.lang,
    grams: opts.grams || candidate.serving_weight_g || 100,
    confidence: opts.confidence ?? 1,
    source: candidate.source,
    source_ref_id: candidate.id,
    source_label: candidate.brand ? `${candidate.name} (${candidate.brand})` : candidate.name,
    // custom entries are complete; external ones may be partial -> backfill from estimate
    primary: candidate.per100g,
    estimate: candidate.source === "custom_food" || candidate.source === "custom_recipe" ? null : opts.estimate,
    serving_weight_g: candidate.serving_weight_g,
  });
}

/**
 * Priority 1: custom recipe/food -> Priority 2: OpenFoodFacts / USDA (order depends on
 * food type) -> Priority 3: Gemini estimate. External hits are backfilled field-by-field
 * from the Gemini estimate; any API failure silently falls through to the next step.
 */
export async function resolveDetectedItem(
  item: DetectedItem,
  catalog: CustomCatalog,
  lang: Lang,
): Promise<ResolvedItem> {
  const common = {
    name_fr: item.name_fr,
    name_en: item.name_en,
    name_de: item.name_de,
    lang,
    grams: item.grams,
    confidence: item.confidence,
  };

  // Step A
  const custom = findCustomMatch(catalog, item);
  if (custom) {
    return buildItem({
      ...common,
      grams: item.grams > 0 ? item.grams : (custom.serving_weight_g ?? 100),
      source: custom.kind,
      source_ref_id: custom.id,
      source_label: custom.name,
      primary: custom.per100g,
      estimate: null,
      serving_weight_g: custom.serving_weight_g,
    });
  }

  // Step B
  const queries = [item.name_fr, item.name_en, item.name_de ?? ""].filter(Boolean);
  const offQuery =
    (lang === "fr" ? item.name_fr : lang === "de" ? item.name_de : item.name_en) || item.name_en || item.name_fr;
  const usdaQuery = item.name_en || item.name_fr;
  const minScore = item.food_type === "dish" ? 0.65 : 0.5;

  const barcodeHit = item.barcode ? await fetchOpenFoodFactsBarcode(item.barcode, lang) : null;

  const [offRes, usdaRes] = await Promise.allSettled([
    barcodeHit
      ? Promise.resolve<FoodCandidate[]>([barcodeHit])
      : searchOpenFoodFacts(offQuery, lang),
    item.food_type === "dish" ? Promise.resolve<FoodCandidate[]>([]) : searchUsda(usdaQuery),
  ]);
  const offHit = barcodeHit
    ? barcodeHit
    : pickBest(offRes.status === "fulfilled" ? offRes.value : [], queries, minScore);
  const usdaHit = pickBest(usdaRes.status === "fulfilled" ? usdaRes.value : [], queries, minScore);

  const ordered =
    item.food_type === "packaged" || barcodeHit ? [offHit, usdaHit] : [usdaHit, offHit];
  const chosen = ordered.find((c): c is FoodCandidate => c !== null) ?? null;

  if (chosen) {
    // Step C: only missing fields are taken from the Gemini estimate
    return resolveFromCandidate(chosen, {
      lang,
      grams: item.grams,
      confidence: item.confidence,
      estimate: item.estimate,
      name_fr: item.name_fr,
      name_en: item.name_en,
      name_de: item.name_de,
    });
  }

  // Priority 3: pure AI estimate
  return buildItem({
    ...common,
    source: "ai_estimate",
    source_ref_id: null,
    source_label: null,
    primary: item.estimate,
    estimate: null,
    serving_weight_g: null,
  });
}

/** Instant bilingual search: custom catalog first, then OpenFoodFacts and USDA in parallel. */
export async function searchAllSources(
  query: string,
  lang: Lang,
  catalog: CustomCatalog,
): Promise<FoodCandidate[]> {
  const q = query.trim();
  if (!q) return [];
  const custom = searchCustomCatalog(catalog, q);
  const [off, usda] = await Promise.allSettled([
    /^\d{8,14}$/.test(q)
      ? fetchOpenFoodFactsBarcode(q, lang).then((c) => (c ? [c] : []))
      : searchOpenFoodFacts(q, lang, 6),
    searchUsda(q, 6),
  ]);
  return [
    ...custom,
    ...(off.status === "fulfilled" ? off.value : []),
    ...(usda.status === "fulfilled" ? usda.value : []),
  ];
}
