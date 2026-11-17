"use client";

import { useState } from "react";
import { ArrowLeftRight, Loader2, Trash2 } from "lucide-react";
import { saveMeal } from "@/app/actions/diary";
import { useI18n } from "@/lib/i18n";
import { toDateKey } from "@/lib/targets";
import {
  MACRO_KEYS,
  MICRO_KEYS,
  scaleNutrients,
  sumNutrients,
  type MealType,
  type ResolvedItem,
} from "@/types/nutrition";
import { formatAmount } from "./NutrientBars";
import { FoodSearchModal, SourceBadge } from "./FoodSearchModal";

const MEAL_TYPES: MealType[] = ["breakfast", "lunch", "dinner", "snack"];

function defaultMeal(): MealType {
  const h = new Date().getHours();
  return h < 10 ? "breakfast" : h < 15 ? "lunch" : h < 18 ? "snack" : "dinner";
}

export function DecompositionCard({
  items,
  onChange,
  onSaved,
  onDiscard,
}: {
  items: ResolvedItem[];
  onChange: (items: ResolvedItem[]) => void;
  onSaved: (date: string) => void;
  onDiscard: () => void;
}) {
  const { t, nutrient, meal } = useI18n();
  const [swapId, setSwapId] = useState<string | null>(null);
  const [mealType, setMealType] = useState<MealType>(defaultMeal);
  const [date, setDate] = useState(() => toDateKey(new Date()));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showMicros, setShowMicros] = useState(false);

  const totals = sumNutrients(items.map((i) => i.nutrients));
  const swapTarget = items.find((i) => i.id === swapId);

  function setGrams(id: string, grams: number) {
    const g = Math.min(5000, Math.max(0, Math.round(grams) || 0));
    onChange(
      items.map((i) =>
        i.id === id ? { ...i, grams: g, nutrients: scaleNutrients(i.per100g, g) } : i, // grams / 100 proportional
      ),
    );
  }

  async function save() {
    setSaving(true);
    setError(null);
    const res = await saveMeal({
      date,
      mealType,
      items: items
        .filter((i) => i.grams > 0)
        .map((i) => ({
          name: i.name,
          source: i.source,
          source_ref_id: i.source_ref_id,
          grams: i.grams,
          confidence: i.confidence,
          nutrients: i.nutrients,
        })),
    });
    setSaving(false);
    if (res.ok) onSaved(date);
    else setError(res.error);
  }

  return (
    <section className="space-y-4 rounded-2xl border border-neutral-200 p-4 dark:border-neutral-800">
      <h2 className="text-lg font-semibold">{t("decomp.title")}</h2>
      {items.length === 0 && <p className="text-sm text-neutral-500">{t("decomp.noItems")}</p>}

      <ul className="space-y-3">
        {items.map((it) => (
          <li key={it.id} className="space-y-2 rounded-xl bg-neutral-50 p-3 dark:bg-neutral-900">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate font-medium">{it.name}</p>
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  <SourceBadge source={it.source} />
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      it.confidence >= 0.75
                        ? "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200"
                        : it.confidence >= 0.5
                          ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200"
                          : "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200"
                    }`}
                  >
                    {t("decomp.confidence")} {Math.round(it.confidence * 100)}%
                  </span>
                  {it.backfilled_keys.length > 0 && (
                    <span
                      className="rounded-full bg-neutral-200 px-2 py-0.5 text-xs dark:bg-neutral-800"
                      title={it.backfilled_keys.map((k) => nutrient(k)).join(", ")}
                    >
                      {t("decomp.backfilled")} ({it.backfilled_keys.length})
                    </span>
                  )}
                </div>
              </div>
              <div className="flex shrink-0">
                <button onClick={() => setSwapId(it.id)} aria-label={t("decomp.swap")} title={t("decomp.swap")} className="rounded-full p-2 hover:bg-neutral-200 dark:hover:bg-neutral-800">
                  <ArrowLeftRight className="h-4 w-4" />
                </button>
                <button onClick={() => onChange(items.filter((x) => x.id !== it.id))} aria-label={t("decomp.remove")} title={t("decomp.remove")} className="rounded-full p-2 text-red-600 hover:bg-neutral-200 dark:hover:bg-neutral-800">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <input
                type="range"
                min={0}
                max={Math.max(500, Math.ceil((it.grams * 2) / 50) * 50)}
                step={5}
                value={it.grams}
                onChange={(e) => setGrams(it.id, Number(e.target.value))}
                aria-label={`${it.name} (g)`}
                className="h-2 flex-1 accent-green-600"
              />
              <label className="flex items-center gap-1 text-sm">
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={5000}
                  value={it.grams}
                  onChange={(e) => setGrams(it.id, Number(e.target.value))}
                  className="w-20 rounded-lg border border-neutral-300 bg-transparent px-2 py-1 text-right tabular-nums dark:border-neutral-700"
                />
                g
              </label>
            </div>

            <p className="text-xs tabular-nums text-neutral-600 dark:text-neutral-400">
              {MACRO_KEYS.slice(0, 4).map((k) => `${nutrient(k)} ${formatAmount(k, it.nutrients[k])}`).join(" · ")}
            </p>
          </li>
        ))}
      </ul>

      <div className="rounded-xl border border-neutral-200 p-3 dark:border-neutral-800">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold">{t("common.total")}</h3>
          <button onClick={() => setShowMicros((v) => !v)} className="text-xs text-green-700 underline dark:text-green-400">
            {t("common.micros")}
          </button>
        </div>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm tabular-nums sm:grid-cols-3">
          {MACRO_KEYS.map((k) => (
            <div key={k} className="flex justify-between gap-2">
              <dt className="text-neutral-500">{nutrient(k)}</dt>
              <dd className="font-medium">{formatAmount(k, totals[k])}</dd>
            </div>
          ))}
        </dl>
        {showMicros && (
          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 border-t border-neutral-200 pt-3 text-sm tabular-nums dark:border-neutral-800 sm:grid-cols-3">
            {MICRO_KEYS.map((k) => (
              <div key={k} className="flex justify-between gap-2">
                <dt className="text-neutral-500">{nutrient(k)}</dt>
                <dd className="font-medium">{formatAmount(k, totals[k])}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <select value={mealType} onChange={(e) => setMealType(e.target.value as MealType)} className="rounded-lg border border-neutral-300 bg-transparent px-2 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900">
          {MEAL_TYPES.map((m) => (
            <option key={m} value={m}>
              {meal(m)}
            </option>
          ))}
        </select>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="rounded-lg border border-neutral-300 bg-transparent px-2 py-2 text-sm dark:border-neutral-700" />
        <div className="ml-auto flex gap-2">
          <button onClick={onDiscard} className="rounded-xl px-3 py-2 text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800">
            {t("common.cancel")}
          </button>
          <button
            onClick={save}
            disabled={saving || items.every((i) => i.grams <= 0)}
            className="flex items-center gap-2 rounded-xl bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {t("decomp.addToDiary")}
          </button>
        </div>
      </div>
      {error && <p className="text-sm text-red-600">{t(error)}</p>}

      {swapTarget && (
        <FoodSearchModal
          open
          initialQuery={swapTarget.name}
          grams={swapTarget.grams}
          onClose={() => setSwapId(null)}
          onPick={(picked) =>
            onChange(items.map((i) => (i.id === swapId ? { ...picked, id: i.id, grams: i.grams, nutrients: scaleNutrients(picked.per100g, i.grams) } : i)))
          }
        />
      )}
    </section>
  );
}
