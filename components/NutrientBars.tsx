"use client";

import { useI18n } from "@/lib/i18n";
import { LIMIT_KEYS, STATUS_BAR_CLASS, progressStatus, type ResolvedTarget } from "@/lib/targets";
import {
  MACRO_KEYS,
  MICRO_KEYS,
  NUTRIENT_UNITS,
  type NutrientKey,
  type NutrientVector,
} from "@/types/nutrition";

export function formatAmount(key: NutrientKey, v: number): string {
  const unit = NUTRIENT_UNITS[key];
  const digits = unit === "kcal" || v >= 100 ? 0 : v >= 10 ? 1 : 2;
  return `${v.toLocaleString(undefined, { maximumFractionDigits: digits })} ${unit === "mcg" ? "µg" : unit}`;
}

function Row({ k, value, target }: { k: NutrientKey; value: number; target: ResolvedTarget }) {
  const { nutrient } = useI18n();
  const pct = target.value > 0 ? (value / target.value) * 100 : 0;
  const status = progressStatus(k, pct);
  return (
    <li className="space-y-1">
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className="font-medium">
          {nutrient(k)}
          {LIMIT_KEYS.has(k) && <span className="ml-1 text-xs text-neutral-500">(max)</span>}
        </span>
        <span className="tabular-nums text-neutral-600 dark:text-neutral-400">
          {formatAmount(k, value)} / {formatAmount(k, target.value)} · {Math.round(pct)}%
        </span>
      </div>
      <div
        className="h-2 w-full overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800"
        role="progressbar"
        aria-valuenow={Math.round(pct)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={nutrient(k)}
      >
        <div className={`h-full rounded-full transition-all ${STATUS_BAR_CLASS[status]}`} style={{ width: `${Math.min(100, pct)}%` }} />
      </div>
    </li>
  );
}

export function NutrientBars({
  totals,
  targets,
}: {
  totals: NutrientVector;
  targets: Record<NutrientKey, ResolvedTarget>;
}) {
  const { t } = useI18n();
  return (
    <div className="space-y-5">
      <section>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">{t("common.macros")}</h3>
        <ul className="space-y-3">
          {MACRO_KEYS.map((k) => (
            <Row key={k} k={k} value={totals[k]} target={targets[k]} />
          ))}
        </ul>
      </section>
      <section>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">{t("common.micros")}</h3>
        <ul className="space-y-3">
          {MICRO_KEYS.map((k) => (
            <Row key={k} k={k} value={totals[k]} target={targets[k]} />
          ))}
        </ul>
      </section>
    </div>
  );
}
