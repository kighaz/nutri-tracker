"use client";

import { useEffect, useState } from "react";
import { Loader2, Search, X } from "lucide-react";
import { completeCandidate, searchFoods } from "@/app/actions/analyze-food";
import { useI18n } from "@/lib/i18n";
import type { FoodCandidate, ResolvedItem } from "@/types/nutrition";

export function SourceBadge({ source }: { source: ResolvedItem["source"] }) {
  const { source: label } = useI18n();
  const color: Record<ResolvedItem["source"], string> = {
    custom_recipe: "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-200",
    custom_food: "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-200",
    openfoodfacts: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200",
    usda: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200",
    ai_estimate: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200",
    manual: "bg-neutral-200 text-neutral-800 dark:bg-neutral-800 dark:text-neutral-200",
  };
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${color[source]}`}>{label(source)}</span>;
}

/** Per-session cache of search results so repeated ingredient lookups are instant. */
const SEARCH_CACHE = new Map<string, FoodCandidate[]>();
const SEARCH_CACHE_MAX = 80;

function cacheSearch(key: string, value: FoodCandidate[]) {
  if (SEARCH_CACHE.size >= SEARCH_CACHE_MAX) SEARCH_CACHE.delete(SEARCH_CACHE.keys().next().value as string);
  SEARCH_CACHE.set(key, value);
}

/** Trilingual food search (custom -> OpenFoodFacts -> USDA). Used for swapping and for recipe ingredients. */
export function FoodSearchModal({
  open,
  initialQuery = "",
  grams,
  onPick,
  onPickCandidate,
  onClose,
}: {
  open: boolean;
  initialQuery?: string;
  grams: number;
  onPick: (item: ResolvedItem) => void;
  /** When set, the modal closes immediately and the caller completes the candidate in the background. */
  onPickCandidate?: (candidate: FoodCandidate) => void;
  onClose: () => void;
}) {
  const { t, lang } = useI18n();
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<FoodCandidate[]>([]);
  const [doneQuery, setDoneQuery] = useState("");
  const [picking, setPicking] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const q = query.trim();
  const searchable = q.length >= 2;
  const loading = searchable && doneQuery !== q;

  useEffect(() => {
    if (!open || !searchable) return;
    let stale = false;
    const cacheKey = `${lang}|${q.toLowerCase()}`;
    const hit = SEARCH_CACHE.get(cacheKey);
    const timer = setTimeout(async () => {
      if (hit) {
        setResults(hit);
        setDoneQuery(q);
        setError(null);
        return;
      }
      const res = await searchFoods(q, lang);
      if (stale) return;
      setDoneQuery(q);
      if (res.ok) {
        cacheSearch(cacheKey, res.candidates);
        setResults(res.candidates);
        setError(null);
      } else setError(res.error);
    }, hit ? 0 : 300);
    return () => {
      stale = true;
      clearTimeout(timer);
    };
  }, [q, searchable, lang, open]);

  if (!open) return null;

  async function pick(c: FoodCandidate) {
    if (onPickCandidate) {
      onPickCandidate(c);
      onClose();
      return;
    }
    setPicking(c.id);
    const res = await completeCandidate(c, grams, lang);
    setPicking(null);
    if (res.ok) {
      onPick(res.item);
      onClose();
    } else setError(res.error);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center" role="dialog" aria-modal="true">
      <div className="flex max-h-[85dvh] w-full max-w-lg flex-col rounded-t-2xl bg-white p-4 shadow-xl dark:bg-neutral-900 sm:rounded-2xl">
        <div className="mb-3 flex items-center gap-2">
          <Search className="h-5 w-5 text-neutral-500" aria-hidden />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("swap.placeholder")}
            className="min-w-0 flex-1 bg-transparent py-2 text-base outline-none"
          />
          {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
          <button onClick={onClose} aria-label={t("common.close")} className="rounded-full p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800">
            <X className="h-5 w-5" />
          </button>
        </div>
        {error && <p className="mb-2 text-sm text-red-600">{t(error)}</p>}
        <ul className="-mx-1 flex-1 overflow-y-auto">
          {(searchable ? results : []).map((c) => (
            <li key={`${c.source}-${c.id}`}>
              <button
                disabled={picking !== null}
                onClick={() => pick(c)}
                className="flex w-full items-center justify-between gap-3 rounded-lg px-2 py-2 text-left hover:bg-neutral-100 disabled:opacity-60 dark:hover:bg-neutral-800"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{c.name}</span>
                  <span className="block truncate text-xs text-neutral-500">
                    {c.brand ? `${c.brand} · ` : ""}
                    {Math.round(c.per100g.calories_kcal ?? 0)} kcal / 100 g
                  </span>
                </span>
                {picking === c.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <SourceBadge source={c.source} />}
              </button>
            </li>
          ))}
          {!loading && searchable && results.length === 0 && (
            <li className="px-2 py-6 text-center text-sm text-neutral-500">{t("swap.none")}</li>
          )}
        </ul>
      </div>
    </div>
  );
}
