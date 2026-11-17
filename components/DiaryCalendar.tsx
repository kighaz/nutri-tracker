"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Trash2 } from "lucide-react";
import { deleteMeal, getDailyTotals, getMeals } from "@/app/actions/diary";
import { useI18n } from "@/lib/i18n";
import {
  STATUS_BAR_CLASS,
  addDays,
  parseDateKey,
  progressStatus,
  toDateKey,
  weekStart,
  type ResolvedTarget,
} from "@/lib/targets";
import type { DailyTotals, LoggedMeal } from "@/types/diary";
import { emptyNutrients, sumNutrients, type NutrientKey } from "@/types/nutrition";
import { NutrientBars, formatAmount } from "./NutrientBars";

type Mode = "day" | "week" | "month";

function monthGrid(dateKey: string): string[] {
  const d = parseDateKey(dateKey);
  const first = toDateKey(new Date(d.getFullYear(), d.getMonth(), 1));
  const start = weekStart(first);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  const end = addDays(weekStart(toDateKey(last)), 6);
  const days: string[] = [];
  for (let cur = start; cur <= end; cur = addDays(cur, 1)) days.push(cur);
  return days;
}

export function DiaryCalendar({
  targets,
  refreshKey,
  initialDate,
}: {
  targets: Record<NutrientKey, ResolvedTarget>;
  refreshKey: number;
  initialDate: string;
}) {
  const { t, lang, meal, nutrient } = useI18n();
  const [mode, setMode] = useState<Mode>("day");
  const [date, setDate] = useState(initialDate);
  const [totals, setTotals] = useState<DailyTotals>({});
  const [meals, setMeals] = useState<LoggedMeal[]>([]);
  const [loadedKey, setLoadedKey] = useState("");
  const today = toDateKey(new Date());


  const range = useMemo(() => {
    if (mode === "day") return { from: date, to: date };
    if (mode === "week") return { from: weekStart(date), to: addDays(weekStart(date), 6) };
    const g = monthGrid(date);
    return { from: g[0], to: g[g.length - 1] };
  }, [mode, date]);

  const totalsKey = `${range.from}|${range.to}|${refreshKey}`;
  const mealsKey = `${date}|${refreshKey}`;
  const loading = loadedKey !== `${totalsKey}#${mealsKey}`;

  const fetchTotals = useCallback(() => getDailyTotals(range.from, range.to), [range]);

  useEffect(() => {
    let stale = false;
    fetchTotals().then((tot) => {
      if (stale) return;
      if (tot.ok) setTotals(tot.data);
      setLoadedKey((k) => `${totalsKey}#${k.split("#")[1] ?? ""}`);
    });
    return () => {
      stale = true;
    };
  }, [fetchTotals, totalsKey]);

  useEffect(() => {
    let stale = false;
    getMeals(date, date).then((ml) => {
      if (stale) return;
      if (ml.ok) setMeals(ml.data);
      setLoadedKey((k) => `${k.split("#")[0]}#${mealsKey}`);
    });
    return () => {
      stale = true;
    };
  }, [date, mealsKey]);

  async function reload() {
    const [tot, ml] = await Promise.all([fetchTotals(), getMeals(date, date)]);
    if (tot.ok) setTotals(tot.data);
    if (ml.ok) setMeals(ml.data);
  }

  function step(dir: 1 | -1) {
    if (mode === "day") setDate(addDays(date, dir));
    else if (mode === "week") setDate(addDays(date, 7 * dir));
    else {
      const d = parseDateKey(date);
      setDate(toDateKey(new Date(d.getFullYear(), d.getMonth() + dir, 1)));
    }
  }

  const locale = lang === "fr" ? "fr-FR" : lang === "de" ? "de-DE" : "en-US";
  const title =
    mode === "month"
      ? parseDateKey(date).toLocaleDateString(locale, { month: "long", year: "numeric" })
      : mode === "week"
        ? `${parseDateKey(range.from).toLocaleDateString(locale, { day: "numeric", month: "short" })} – ${parseDateKey(range.to).toLocaleDateString(locale, { day: "numeric", month: "short" })}`
        : parseDateKey(date).toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long" });

  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart(date), i)), [date]);
  const weekdayLabels = weekDays.map((d) => parseDateKey(d).toLocaleDateString(locale, { weekday: "narrow" }));

  const barTotals = useMemo(() => {
    return totals[date] ?? emptyNutrients(); // selected day, in every view
  }, [totals, date]);

  function dayDot(d: string) {
    const v = totals[d];
    if (!v) return null;
    const pct = (v.calories_kcal / targets.calories_kcal.value) * 100;
    return STATUS_BAR_CLASS[progressStatus("calories_kcal", pct)];
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="inline-flex rounded-xl border border-neutral-300 p-0.5 dark:border-neutral-700" role="tablist">
          {(["day", "week", "month"] as Mode[]).map((m) => (
            <button
              key={m}
              role="tab"
              aria-selected={mode === m}
              onClick={() => setMode(m)}
              className={`rounded-lg px-3 py-1.5 text-sm ${mode === m ? "bg-green-600 text-white" : ""}`}
            >
              {t(`diary.${m}`)}
            </button>
          ))}
        </div>
        <button onClick={() => setDate(today)} className="text-sm text-green-700 underline dark:text-green-400">
          {t("diary.today")}
        </button>
      </div>

      <div className="flex items-center justify-between">
        <button onClick={() => step(-1)} aria-label="‹" className="rounded-full p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <h2 className="text-base font-semibold capitalize">{title}</h2>
        <button onClick={() => step(1)} aria-label="›" className="rounded-full p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800">
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      {mode === "month" && (
        <div className="grid grid-cols-7 gap-1 text-center text-sm">
          {weekdayLabels.map((l, i) => (
            <span key={i} className="py-1 text-xs uppercase text-neutral-500">
              {l}
            </span>
          ))}
          {monthGrid(date).map((d) => {
            const inMonth = parseDateKey(d).getMonth() === parseDateKey(date).getMonth();
            const dot = dayDot(d);
            return (
              <button
                key={d}
                onClick={() => setDate(d)}
                aria-pressed={d === date}
                className={`flex aspect-square flex-col items-center justify-center rounded-lg ${inMonth ? "" : "opacity-40"} ${d === today ? "ring-2 ring-green-600" : ""} ${d === date ? "bg-green-600 text-white" : "hover:bg-neutral-100 dark:hover:bg-neutral-800"}`}
              >
                <span>{parseDateKey(d).getDate()}</span>
                <span className={`mt-0.5 h-1.5 w-1.5 rounded-full ${dot ?? "bg-transparent"}`} />
              </button>
            );
          })}
        </div>
      )}

      {mode === "week" && (
        <div className="grid grid-cols-7 gap-1 text-center text-sm">
          {weekDays.map((d, i) => (
            <button
              key={d}
              onClick={() => setDate(d)}
              aria-pressed={d === date}
              className={`flex flex-col items-center rounded-lg py-2 ${d === date ? "bg-green-600/15 ring-2 ring-green-600" : "hover:bg-neutral-100 dark:hover:bg-neutral-800"} ${d === today && d !== date ? "ring-2 ring-green-300" : ""}`}
            >
              <span className="text-xs uppercase text-neutral-500">{weekdayLabels[i]}</span>
              <span>{parseDateKey(d).getDate()}</span>
              <span className={`mt-1 h-1.5 w-1.5 rounded-full ${dayDot(d) ?? "bg-transparent"}`} />
              <span className="mt-1 text-[10px] tabular-nums text-neutral-500">{totals[d] ? Math.round(totals[d].calories_kcal) : "–"}</span>
            </button>
          ))}
        </div>
      )}

      {mode !== "day" && (
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold capitalize">
            {parseDateKey(date).toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long" })}
          </h3>
          <button onClick={() => setMode("day")} className="text-sm text-green-700 underline dark:text-green-400">
            {t("diary.editInDay")}
          </button>
        </div>
      )}

        <div className="space-y-3">
          {meals.length === 0 && !loading && <p className="text-sm text-neutral-500">{t("diary.empty")}</p>}
          {meals.map((m) => {
            const mealTotal = sumNutrients(m.items.map((i) => i.nutrients));
            return (
              <div key={m.id} className="rounded-xl border border-neutral-200 p-3 dark:border-neutral-800">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium">{meal(m.meal_type)}</h3>
                  <div className="flex items-center gap-2">
                    <span className="text-sm tabular-nums text-neutral-500">{formatAmount("calories_kcal", mealTotal.calories_kcal)}</span>
                    <button
                      onClick={async () => {
                        await deleteMeal(m.id);
                        reload();
                      }}
                      aria-label={t("common.delete")}
                      className="rounded-full p-1.5 text-red-600 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <ul className="mt-1 space-y-0.5 text-sm text-neutral-600 dark:text-neutral-400">
                  {m.items.map((i) => (
                    <li key={i.id} className="flex justify-between gap-2">
                      <span className="truncate">
                        {i.item_name} · {Math.round(i.grams)} g
                      </span>
                      <span className="tabular-nums">{Math.round(i.nutrients.calories_kcal)} kcal</span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>

      <div className="rounded-2xl border border-neutral-200 p-4 dark:border-neutral-800">
        <NutrientBars totals={barTotals} targets={targets} />
      </div>
      {loading && <span className="sr-only">{nutrient("calories_kcal")}…</span>}
    </section>
  );
}
