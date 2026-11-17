"use server";

import { GoogleGenAI } from "@google/genai";
import { createSupabaseServerClient } from "@/lib/supabase";
import {
  buildCustomContext,
  loadCustomCatalog,
  resolveDetectedItem,
  resolveFromCandidate,
  searchAllSources,
  type CustomCatalog,
  type DetectedItem,
} from "@/lib/nutrition-resolver";
import {
  NUTRIENT_KEYS,
  NUTRIENT_UNITS,
  toCanonical,
  type AnalyzeFoodInput,
  type AnalyzeFoodResult,
  type FoodCandidate,
  type FoodType,
  type Lang,
  type PartialNutrients,
  type ResolvedItem,
  type SearchFoodsResult,
} from "@/types/nutrition";

// Primary model. For high-volume testing use "gemini-3.5-flash-lite".
const GEMINI_MODEL = "gemini-3.8-flash";
const GEMINI_FALLBACK_MODEL = "gemini-3.5-flash-lite"; // used on 429/5xx of the primary

const MAX_BASE64_CHARS = 1_400_000; // ~1 MB of image data after client-side compression
const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);

// ---------------------------------------------------------------------------
// JSON schema for structured output
// ---------------------------------------------------------------------------
const nutrientProperties = Object.fromEntries(
  NUTRIENT_KEYS.map((k) => [k, { type: "number", minimum: 0 }]),
);

const DETECTION_SCHEMA = {
  type: "object",
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name_fr: { type: "string" },
          name_en: { type: "string" },
          grams: { type: "number", minimum: 1 },
          confidence: { type: "number", minimum: 0, maximum: 1 },
          food_type: { type: "string", enum: ["whole_food", "packaged", "dish"] },
          matched_custom_id: { type: ["string", "null"] },
          barcode: { type: ["string", "null"] },
          nutrients_per_100g: {
            type: "object",
            properties: nutrientProperties,
            required: [...NUTRIENT_KEYS],
          },
        },
        required: [
          "name_fr",
          "name_en",
          "grams",
          "confidence",
          "food_type",
          "matched_custom_id",
          "barcode",
          "nutrients_per_100g",
        ],
      },
    },
  },
  required: ["items"],
} as const;

const UNIT_LEGEND = NUTRIENT_KEYS.map((k) => `${k} (${NUTRIENT_UNITS[k]})`).join(", ");

function buildSystemInstruction(catalog: CustomCatalog, hasImage: boolean): string {
  return [
    "You are a precise clinical-nutrition assistant fluent in French and English.",
    hasImage
      ? "Decompose the meal in the photo into individual food items (one entry per distinct food on the plate)."
      : "Decompose the user's text into individual food items. If quantities are given, honour them; otherwise assume one typical adult portion.",
    "For each item give: name_fr, name_en (both languages, concrete wording that includes cooking state, e.g. 'chicken breast, roasted'), estimated edible weight in grams, confidence 0..1, food_type (whole_food | packaged | dish), barcode (digits only if clearly readable on a package, else null).",
    "USER'S SAVED CUSTOM RECIPES / FOODS (match against these first):",
    buildCustomContext(catalog),
    "If an item is clearly one of the user's saved entries, set matched_custom_id to its exact id; otherwise null. Never invent ids.",
    `nutrients_per_100g must be a realistic estimate PER 100 g of the item as eaten, using EXACTLY these canonical units: ${UNIT_LEGEND}. Vitamin A in mcg RAE, folate in mcg DFE, vitamin D in mcg, vitamin E in mg alpha-tocopherol. Do not output 0 for a nutrient the food actually contains.`,
    "Respond with JSON only.",
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Gemini calls
// ---------------------------------------------------------------------------
function getAi(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY missing");
  return new GoogleGenAI({ apiKey });
}

type Part = { text: string } | { inlineData: { mimeType: string; data: string } };

async function generateJson(
  ai: GoogleGenAI,
  parts: Part[],
  systemInstruction: string,
  schema: unknown,
): Promise<unknown> {
  const run = async (model: string) => {
    const response = await ai.models.generateContent({
      model,
      contents: [{ role: "user", parts }],
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseJsonSchema: schema,
        temperature: 0.2,
      },
    });
    return JSON.parse(response.text ?? "{}");
  };
  try {
    return await run(GEMINI_MODEL);
  } catch {
    return await run(GEMINI_FALLBACK_MODEL);
  }
}

function sanitizeEstimate(raw: unknown): PartialNutrients {
  const out: PartialNutrients = {};
  if (!raw || typeof raw !== "object") return out;
  for (const k of NUTRIENT_KEYS) {
    // Gemini is instructed to answer in canonical units; this validates range/finite-ness.
    const v = toCanonical(k, (raw as Record<string, unknown>)[k], NUTRIENT_UNITS[k]);
    if (v !== undefined) out[k] = v;
  }
  return out;
}

const FOOD_TYPES: FoodType[] = ["whole_food", "packaged", "dish"];

function parseDetected(json: unknown): DetectedItem[] {
  const items = (json as { items?: unknown[] } | null)?.items;
  if (!Array.isArray(items)) return [];
  const out: DetectedItem[] = [];
  for (const r of items as Record<string, unknown>[]) {
    const name_fr = String(r.name_fr ?? "").trim();
    const name_en = String(r.name_en ?? "").trim();
    if (!name_fr && !name_en) continue;
    const grams = Number(r.grams);
    const conf = Number(r.confidence);
    out.push({
      name_fr: name_fr || name_en,
      name_en: name_en || name_fr,
      grams: Number.isFinite(grams) && grams > 0 ? Math.min(grams, 5000) : 100,
      confidence: Number.isFinite(conf) ? Math.min(1, Math.max(0, conf)) : 0.5,
      food_type: FOOD_TYPES.includes(r.food_type as FoodType) ? (r.food_type as FoodType) : "whole_food",
      matched_custom_id: typeof r.matched_custom_id === "string" ? r.matched_custom_id : null,
      barcode: typeof r.barcode === "string" && /^\d{8,14}$/.test(r.barcode) ? r.barcode : null,
      estimate: sanitizeEstimate(r.nutrients_per_100g),
    });
  }
  return out.slice(0, 20);
}

// ---------------------------------------------------------------------------
// Server action: analyze photo and/or text
// ---------------------------------------------------------------------------
export async function analyzeFood(input: AnalyzeFoodInput): Promise<AnalyzeFoodResult> {
  // Step D: the image lives only in this local variable (RAM); it is never written to disk,
  // Supabase Storage or any table, and the reference is dropped right after the Gemini call.
  let imageBase64: string | undefined = input.imageBase64?.replace(/^data:[^;]+;base64,/, "");
  const mimeType = input.mimeType ?? "image/jpeg";
  const text = input.text?.trim().slice(0, 500);
  const lang: Lang = input.lang === "en" ? "en" : "fr";

  try {
    if (!imageBase64 && !text) return { ok: false, error: "error.noInput" };
    if (imageBase64) {
      if (imageBase64.length > MAX_BASE64_CHARS) return { ok: false, error: "error.imageTooLarge" };
      if (!ALLOWED_MIME.has(mimeType)) return { ok: false, error: "error.imageTooLarge" };
    }

    const supabase = await createSupabaseServerClient();
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id ?? null;
    const warnings: string[] = [];

    let catalog: CustomCatalog = [];
    if (userId) {
      try {
        catalog = await loadCustomCatalog(supabase, userId);
      } catch {
        warnings.push("custom_catalog_unavailable");
      }
    }

    const parts: Part[] = [];
    if (imageBase64) parts.push({ inlineData: { mimeType, data: imageBase64 } });
    parts.push({
      text: text
        ? `Meal description from the user (language: ${lang}): ${text}`
        : `Analyze this meal photo. Reply with names in French and English.`,
    });

    let detected: DetectedItem[];
    try {
      const json = await generateJson(
        getAi(),
        parts,
        buildSystemInstruction(catalog, Boolean(imageBase64)),
        DETECTION_SCHEMA,
      );
      detected = parseDetected(json);
    } catch {
      return { ok: false, error: "error.aiUnavailable" };
    } finally {
      // Discard the photo immediately after JSON extraction.
      parts.length = 0;
      imageBase64 = undefined;
      input.imageBase64 = undefined;
    }

    const settled = await Promise.allSettled(detected.map((d) => resolveDetectedItem(d, catalog, lang)));
    const items: ResolvedItem[] = settled.map((r, i) => {
      if (r.status === "fulfilled") return r.value;
      // Hard failure on one item: fall back to its AI estimate rather than failing the request.
      return resolveFromCandidate(
        {
          id: "",
          name: detected[i].name_en,
          brand: null,
          source: "usda",
          per100g: {},
          serving_weight_g: null,
        },
        { lang, grams: detected[i].grams, confidence: detected[i].confidence, estimate: detected[i].estimate },
      );
    });
    for (const it of items) if (it.source_ref_id === "") it.source = "ai_estimate";

    return { ok: true, items, authenticated: Boolean(userId), warnings };
  } catch {
    return { ok: false, error: "common.error" };
  } finally {
    imageBase64 = undefined;
  }
}

// ---------------------------------------------------------------------------
// Server action: instant bilingual search (swap modal / recipe builder)
// ---------------------------------------------------------------------------
export async function searchFoods(query: string, lang: Lang): Promise<SearchFoodsResult> {
  try {
    const q = query.trim().slice(0, 100);
    if (q.length < 2) return { ok: true, candidates: [] };
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase.auth.getUser();
    const catalog = data.user ? await loadCustomCatalog(supabase, data.user.id) : [];
    const candidates = await searchAllSources(q, lang === "en" ? "en" : "fr", catalog);
    return { ok: true, candidates };
  } catch {
    return { ok: false, error: "common.error" };
  }
}

// ---------------------------------------------------------------------------
// Server action: turn a chosen search candidate into a full item. Missing fields
// of OpenFoodFacts/USDA entries are backfilled with a Gemini text estimate.
// ---------------------------------------------------------------------------
const ESTIMATE_SCHEMA = {
  type: "object",
  properties: { nutrients_per_100g: DETECTION_SCHEMA.properties.items.items.properties.nutrients_per_100g },
  required: ["nutrients_per_100g"],
} as const;

export async function completeCandidate(
  candidate: FoodCandidate,
  grams: number,
  lang: Lang,
): Promise<{ ok: true; item: ResolvedItem } | { ok: false; error: string }> {
  try {
    const safeGrams = Number.isFinite(grams) && grams > 0 ? Math.min(grams, 5000) : 100;
    const isCustom = candidate.source === "custom_food" || candidate.source === "custom_recipe";
    const incomplete = NUTRIENT_KEYS.some((k) => !Number.isFinite(candidate.per100g[k]));
    let estimate: PartialNutrients | null = null;

    if (!isCustom && incomplete) {
      try {
        const json = (await generateJson(
          getAi(),
          [{ text: `Food: ${candidate.name}${candidate.brand ? ` (${candidate.brand})` : ""}` }],
          `You are a nutrition database. Estimate nutrients PER 100 g of the given food in EXACTLY these units: ${UNIT_LEGEND}. Do not output 0 for a nutrient the food actually contains. JSON only.`,
          ESTIMATE_SCHEMA,
        )) as { nutrients_per_100g?: unknown };
        estimate = sanitizeEstimate(json.nutrients_per_100g);
      } catch {
        estimate = null; // graceful: keep partial data, missing fields reported in missing_keys
      }
    }

    return {
      ok: true,
      item: resolveFromCandidate(candidate, { lang, grams: safeGrams, estimate }),
    };
  } catch {
    return { ok: false, error: "common.error" };
  }
}
