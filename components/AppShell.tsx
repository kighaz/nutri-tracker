"use client";

import { useEffect, useMemo, useState } from "react";
import { BookOpen, CalendarDays, Camera, Loader2, Settings } from "lucide-react";
import { getProfile } from "@/app/actions/diary";
import { useI18n } from "@/lib/i18n";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import { resolveTargets, toDateKey } from "@/lib/targets";
import { DEFAULT_PROFILE, type ResolvedItem, type UserProfile } from "@/types/nutrition";
import { CaptureModule } from "./CaptureModule";
import { DecompositionCard } from "./DecompositionCard";
import { DiaryCalendar } from "./DiaryCalendar";
import { RecipeBuilder } from "./RecipeBuilder";
import { TargetEditor } from "./TargetEditor";

type Tab = "log" | "diary" | "recipes";

export function AppShell() {
  const { t } = useI18n();
  const [authState, setAuthState] = useState<"loading" | "ready" | "failed">("loading");
  const [tab, setTab] = useState<Tab>("log");
  const [profile, setProfile] = useState<UserProfile>(DEFAULT_PROFILE);
  const [items, setItems] = useState<ResolvedItem[] | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [diaryDate, setDiaryDate] = useState(() => toDateKey(new Date()));
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const supabase = createSupabaseBrowserClient();
        const { data } = await supabase.auth.getSession();
        if (!data.session) {
          // Single-user personal app: silent anonymous session (enable "Anonymous sign-ins" in Supabase).
          const { error } = await supabase.auth.signInAnonymously();
          if (error) throw error;
        }
        const res = await getProfile();
        if (cancelled) return;
        if (res.ok) setProfile(res.data);
        setAuthState("ready");
      } catch {
        if (!cancelled) setAuthState("failed");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const targets = useMemo(() => resolveTargets(profile), [profile]);

  const tabs: { id: Tab; icon: typeof Camera; label: string }[] = [
    { id: "log", icon: Camera, label: t("nav.log") },
    { id: "diary", icon: CalendarDays, label: t("nav.diary") },
    { id: "recipes", icon: BookOpen, label: t("nav.recipes") },
  ];

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col">
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-neutral-200 bg-white/90 px-4 py-3 backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/90">
        <h1 className="text-lg font-bold text-green-700 dark:text-green-400">{t("app.name")}</h1>
        <button onClick={() => setSettingsOpen(true)} aria-label={t("nav.settings")} className="rounded-full p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800">
          <Settings className="h-5 w-5" />
        </button>
      </header>

      <main className="flex-1 space-y-4 px-4 pb-28 pt-4">
        {authState === "loading" && (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin" aria-label={t("common.loading")} />
          </div>
        )}
        {authState === "failed" && <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">{t("auth.required")}</p>}

        {authState === "ready" && tab === "log" && (
          <>
            <CaptureModule
              onResult={(res, w) => {
                setItems(res);
                setWarnings(w);
              }}
            />
            {warnings.length > 0 && items && <p className="text-xs text-neutral-500">{t("auth.partial")}</p>}
            {items && (
              <DecompositionCard
                items={items}
                onChange={setItems}
                onDiscard={() => setItems(null)}
                onSaved={(date) => {
                  setItems(null);
                  setDiaryDate(date);
                  setRefreshKey((k) => k + 1);
                  setTab("diary");
                }}
              />
            )}
          </>
        )}
        {authState === "ready" && tab === "diary" && <DiaryCalendar key={diaryDate} targets={targets} refreshKey={refreshKey} initialDate={diaryDate} />}
        {authState === "ready" && tab === "recipes" && <RecipeBuilder />}
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-neutral-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/95">
        <ul className="mx-auto flex max-w-2xl">
          {tabs.map(({ id, icon: Icon, label }) => (
            <li key={id} className="flex-1">
              <button
                onClick={() => setTab(id)}
                aria-current={tab === id ? "page" : undefined}
                className={`flex w-full flex-col items-center gap-0.5 py-2.5 text-xs ${tab === id ? "font-semibold text-green-700 dark:text-green-400" : "text-neutral-500"}`}
              >
                <Icon className="h-5 w-5" aria-hidden />
                {label}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      {settingsOpen && <TargetEditor open profile={profile} onClose={() => setSettingsOpen(false)} onSaved={setProfile} />}
    </div>
  );
}
