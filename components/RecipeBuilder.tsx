"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { deleteRecipe, listRecipes, saveRecipe } from "@/app/actions/diary";
import { useI18n } from "@/lib/i18n";
import type { RecipeSummary } from "@/types/diary";
import { MACRO_KEYS, MICRO_KEYS, computeRecipe, type ResolvedItem } from "@/types/nutrition";
import { formatAmount } from "./NutrientBars";
import { FoodSearchModal, SourceBadge } from "./FoodSearchModal";

interface Row {
  item: ResolvedItem;
  grams: number;
}

export function RecipeBuilder() {
  const { t, nutrient } = useI18n();
  const [name, setName] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [cooked, setCooked] = useState("");
  const [servings, setServings] = useState("1");
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [recipes, setRecipes] = useState<RecipeSummary[]>([]);

  const refresh = useCallback(async () => {
    const res = await listRecipes();
    if (res.ok) setRecipes(res.data);
  }, []);
  useEffect(() => {
    let stale = false;
    listRecipes().then((res) => {
      if (!stale && res.ok) setRecipes(res.data);
    });
    return () => {
      stale = true;
    };
  }, []);

  const calc = computeRecipe(
    rows.map((r) => ({ grams: r.grams, per100g: r.item.per100g })),
    cooked ? Number(cooked) : null,
    Number(servings) || 1,
  );

  async function save() {
    setSaving(true);
    setMessage(null);
    const res = await saveRecipe({
      name,
      cookedWeightG: cooked ? Number(cooked) : null,
      totalServings: Number(servings) || 1,
      ingredients: rows.map((r) => ({
        name: r.item.name,
        source: r.item.source,
        source_ref_id: r.item.source_ref_id,
        grams: r.grams,
        per100g: r.item.per100g,
      })),
    });
    setSaving(false);
    if (res.ok) {
      setMessage({ ok: true, text: t("recipe.saved") });
      setName("");
      setRows([]);
      setCooked("");
      setServings("1");
      refresh();
    } else setMessage({ ok: false, text: t(res.error) });
  }

  return (
    <div className="space-y-6">
      <section className="space-y-4 rounded-2xl border border-neutral-200 p-4 dark:border-neutral-800">
        <h2 className="text-lg font-semibold">{t("recipe.title")}</h2>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t("recipe.name")}
          maxLength={160}
          className="w-full rounded-xl border border-neutral-300 bg-transparent px-3 py-3 text-base dark:border-neutral-700"
        />

        <div>
          <h3 className="mb-2 text-sm font-semibold">{t("recipe.ingredients")}</h3>
          <ul className="space-y-2">
            {rows.map((r, idx) => (
              <li key={r.item.id} className="flex items-center gap-2 rounded-xl bg-neutral-50 p-2 dark:bg-neutral-900">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{r.item.name}</p>
                  <SourceBadge source={r.item.source} />
                </div>
                <input
                  type="number"
                  inputMode="decimal"
                  min={1}
                  value={r.grams}
                  onChange={(e) => setRows(rows.map((x, i) => (i === idx ? { ...x, grams: Math.max(0, Number(e.target.value)) } : x)))}
                  aria-label={`${r.item.name} (g)`}
                  className="w-20 rounded-lg border border-neutral-300 bg-transparent px-2 py-1 text-right tabular-nums dark:border-neutral-700"
                />
                <span className="text-sm">g</span>
                <button onClick={() => setRows(rows.filter((_, i) => i !== idx))} aria-label={t("common.delete")} className="rounded-full p-2 text-red-600 hover:bg-neutral-200 dark:hover:bg-neutral-800">
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
          <button onClick={() => setSearching(true)} className="mt-2 flex items-center gap-1 rounded-xl border border-dashed border-neutral-400 px-3 py-2 text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800">
            <Plus className="h-4 w-4" /> {t("recipe.addIngredient")}
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="text-sm">
            {t("recipe.cookedWeight")}
            <input
              type="number"
              inputMode="decimal"
              min={1}
              value={cooked}
              onChange={(e) => setCooked(e.target.value)}
              placeholder={String(Math.round(calc.raw_weight_g))}
              className="mt-1 w-full rounded-xl border border-neutral-300 bg-transparent px-3 py-2 dark:border-neutral-700"
            />
          </label>
          <label className="text-sm">
            {t("recipe.servings")}
            <input
              type="number"
              inputMode="decimal"
              min={1}
              step={0.5}
              value={servings}
              onChange={(e) => setServings(e.target.value)}
              className="mt-1 w-full rounded-xl border border-neutral-300 bg-transparent px-3 py-2 dark:border-neutral-700"
            />
          </label>
        </div>

        {rows.length > 0 && (
          <div className="overflow-x-auto">
            <p className="mb-2 text-xs text-neutral-500">
              {t("recipe.rawWeight")}: {Math.round(calc.raw_weight_g)} g · {t("recipe.servingWeight")}: {Math.round(calc.serving_weight_g)} g
            </p>
            <table className="w-full text-sm tabular-nums">
              <thead>
                <tr className="text-left text-xs text-neutral-500">
                  <th className="py-1 font-medium" />
                  <th className="py-1 text-right font-medium">{t("common.per100g")}</th>
                  <th className="py-1 text-right font-medium">{t("common.perServing")}</th>
                </tr>
              </thead>
              <tbody>
                {[...MACRO_KEYS, ...MICRO_KEYS].map((k) => (
                  <tr key={k} className="border-t border-neutral-200 dark:border-neutral-800">
                    <td className="py-1">{nutrient(k)}</td>
                    <td className="py-1 text-right">{formatAmount(k, calc.per100g[k])}</td>
                    <td className="py-1 text-right">{formatAmount(k, calc.perServing[k])}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex items-center gap-3">
          <button
            onClick={save}
            disabled={saving || !name.trim() || rows.length === 0 || rows.every((r) => r.grams <= 0)}
            className="flex items-center gap-2 rounded-xl bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {t("common.save")}
          </button>
          {message && <span className={`text-sm ${message.ok ? "text-green-700 dark:text-green-400" : "text-red-600"}`}>{message.text}</span>}
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">{t("recipe.myRecipes")}</h2>
        {recipes.length === 0 && <p className="text-sm text-neutral-500">{t("recipe.empty")}</p>}
        <ul className="space-y-2">
          {recipes.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-3 rounded-xl border border-neutral-200 p-3 dark:border-neutral-800">
              <div className="min-w-0">
                <p className="truncate font-medium">{r.name}</p>
                <p className="text-xs text-neutral-500">
                  {Math.round(r.per100g.calories_kcal)} kcal / 100 g · {Math.round(r.serving_weight_g)} g × {r.total_servings}
                </p>
              </div>
              <button
                onClick={async () => {
                  await deleteRecipe(r.id);
                  refresh();
                }}
                aria-label={t("common.delete")}
                className="rounded-full p-2 text-red-600 hover:bg-neutral-100 dark:hover:bg-neutral-800"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      </section>

      {searching && (
        <FoodSearchModal
          open
          grams={100}
          onClose={() => setSearching(false)}
          onPick={(item) => setRows((prev) => [...prev, { item, grams: item.grams || 100 }])}
        />
      )}
    </div>
  );
}
