"use client";

import { useState } from "react";
import { Loader2, X } from "lucide-react";
import { saveProfile } from "@/app/actions/diary";
import { useI18n } from "@/lib/i18n";
import { resolveTargets } from "@/lib/targets";
import {
  MACRO_KEYS,
  MICRO_KEYS,
  NUTRIENT_UNITS,
  type ActivityLevel,
  type NutrientKey,
  type UserProfile,
} from "@/types/nutrition";
import { formatAmount } from "./NutrientBars";

const ACTIVITIES: ActivityLevel[] = ["sedentary", "light", "moderate", "active", "very_active"];

export function TargetEditor({
  open,
  profile,
  onClose,
  onSaved,
}: {
  open: boolean;
  profile: UserProfile;
  onClose: () => void;
  onSaved: (p: UserProfile) => void;
}) {
  const { t, nutrient, activity, lang, setLang } = useI18n();
  const [draft, setDraft] = useState<UserProfile>(profile);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;
  const resolved = resolveTargets(draft);
  const numOrNull = (v: string) => (v === "" ? null : Number(v));

  function setMode(k: NutrientKey, manual: boolean) {
    const next = { ...draft.nutrient_targets };
    if (manual) next[k] = { mode: "manual", value: resolved[k].value };
    else delete next[k];
    setDraft({ ...draft, nutrient_targets: next });
  }

  async function save() {
    setSaving(true);
    setError(null);
    const res = await saveProfile({ ...draft, preferred_language: lang });
    setSaving(false);
    if (res.ok) {
      onSaved({ ...draft, preferred_language: lang });
      onClose();
    } else setError(res.error);
  }

  const field = "mt-1 w-full rounded-lg border border-neutral-300 bg-transparent px-2 py-2 dark:border-neutral-700 dark:bg-neutral-900";

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50" role="dialog" aria-modal="true">
      <div className="flex h-full w-full max-w-md flex-col bg-white shadow-xl dark:bg-neutral-950">
        <div className="flex items-center justify-between border-b border-neutral-200 p-4 dark:border-neutral-800">
          <h2 className="text-lg font-semibold">{t("targets.title")}</h2>
          <button onClick={onClose} aria-label={t("common.close")} className="rounded-full p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto p-4">
          <div className="flex items-center gap-2 text-sm">
            <span>{t("settings.language")}</span>
            {(["fr", "en"] as const).map((l) => (
              <button key={l} onClick={() => setLang(l)} className={`rounded-lg px-3 py-1 ${lang === l ? "bg-green-600 text-white" : "border border-neutral-300 dark:border-neutral-700"}`}>
                {l.toUpperCase()}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <label>
              {t("targets.age")}
              <input type="number" min={1} max={120} value={draft.age ?? ""} onChange={(e) => setDraft({ ...draft, age: numOrNull(e.target.value) })} className={field} />
            </label>
            <label>
              {t("targets.sex")}
              <select value={draft.sex ?? "male"} onChange={(e) => setDraft({ ...draft, sex: e.target.value as "male" | "female" })} className={field}>
                <option value="male">{t("targets.male")}</option>
                <option value="female">{t("targets.female")}</option>
              </select>
            </label>
            <label>
              {t("targets.weight")}
              <input type="number" min={20} max={400} step={0.1} value={draft.weight_kg ?? ""} onChange={(e) => setDraft({ ...draft, weight_kg: numOrNull(e.target.value) })} className={field} />
            </label>
            <label>
              {t("targets.height")}
              <input type="number" min={80} max={250} value={draft.height_cm ?? ""} onChange={(e) => setDraft({ ...draft, height_cm: numOrNull(e.target.value) })} className={field} />
            </label>
            <label className="col-span-2">
              {t("targets.activity")}
              <select value={draft.activity_level} onChange={(e) => setDraft({ ...draft, activity_level: e.target.value as ActivityLevel })} className={field}>
                {ACTIVITIES.map((a) => (
                  <option key={a} value={a}>
                    {activity(a)}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {[
            ["common.macros", MACRO_KEYS],
            ["common.micros", MICRO_KEYS],
          ].map(([title, keys]) => (
            <section key={title as string}>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">{t(title as string)}</h3>
              <ul className="space-y-2">
                {(keys as readonly NutrientKey[]).map((k) => {
                  const r = resolved[k];
                  const manual = r.mode === "manual";
                  return (
                    <li key={k} className="flex items-center gap-2 text-sm">
                      <span className="min-w-0 flex-1 truncate">{nutrient(k)}</span>
                      <button
                        onClick={() => setMode(k, !manual)}
                        className={`rounded-lg px-2 py-1 text-xs ${manual ? "bg-green-600 text-white" : "border border-neutral-300 dark:border-neutral-700"}`}
                        aria-pressed={manual}
                      >
                        {manual ? t("targets.manual") : t("targets.auto")}
                      </button>
                      {manual ? (
                        <span className="flex w-28 items-center gap-1">
                          <input
                            type="number"
                            min={0}
                            step="any"
                            value={draft.nutrient_targets[k]?.value ?? ""}
                            onChange={(e) =>
                              setDraft({
                                ...draft,
                                nutrient_targets: { ...draft.nutrient_targets, [k]: { mode: "manual", value: Number(e.target.value) } },
                              })
                            }
                            aria-label={nutrient(k)}
                            className="w-full rounded-lg border border-neutral-300 bg-transparent px-2 py-1 text-right tabular-nums dark:border-neutral-700"
                          />
                          <span className="text-xs text-neutral-500">{NUTRIENT_UNITS[k] === "mcg" ? "µg" : NUTRIENT_UNITS[k]}</span>
                        </span>
                      ) : (
                        <span className="w-28 text-right tabular-nums text-neutral-600 dark:text-neutral-400">{formatAmount(k, r.auto)}</span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>

        <div className="border-t border-neutral-200 p-4 dark:border-neutral-800">
          {error && <p className="mb-2 text-sm text-red-600">{t(error)}</p>}
          <button onClick={save} disabled={saving} className="flex w-full items-center justify-center gap-2 rounded-xl bg-green-600 py-3 font-medium text-white hover:bg-green-700 disabled:opacity-60">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {t("common.save")}
          </button>
        </div>
      </div>
    </div>
  );
}
