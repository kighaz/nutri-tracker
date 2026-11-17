"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { BookOpen, CalendarDays, Camera, HelpCircle, Loader2, LogOut, Settings } from "lucide-react";
import { getProfile } from "@/app/actions/diary";
import { useI18n } from "@/lib/i18n";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import { resolveTargets, toDateKey } from "@/lib/targets";
import { DEFAULT_PROFILE, type ResolvedItem, type UserProfile } from "@/types/nutrition";
import { AppGuideModal } from "./AppGuideModal";
import { AuthModal, EPHEMERAL_KEY } from "./AuthModal";
import { LegalModal } from "./LegalModal";
import { CaptureModule } from "./CaptureModule";
import { DecompositionCard } from "./DecompositionCard";
import { DiaryCalendar } from "./DiaryCalendar";
import { RecipeBuilder } from "./RecipeBuilder";
import { TargetEditor } from "./TargetEditor";

type Tab = "log" | "diary" | "recipes";

const GUIDE_SEEN_KEY = "nutri_tracker_guide_seen";

export function AppShell() {
  const { t, setLang } = useI18n();
  const [authState, setAuthState] = useState<"loading" | "ready" | "signedOut">("loading");
  const [tab, setTab] = useState<Tab>("log");
  const [profile, setProfile] = useState<UserProfile>(DEFAULT_PROFILE);
  const [items, setItems] = useState<ResolvedItem[] | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [diaryDate, setDiaryDate] = useState(() => toDateKey(new Date()));
  const [refreshKey, setRefreshKey] = useState(0);
  const [guideOpen, setGuideOpen] = useState(false);
  const [legalOpen, setLegalOpen] = useState(false);

  useEffect(() => {
    try {
      if (!window.localStorage.getItem(GUIDE_SEEN_KEY)) setGuideOpen(true);
    } catch {
      /* storage unavailable (private mode): skip auto-open */
    }
  }, []);

  const closeGuide = useCallback(() => {
    setGuideOpen(false);
    try {
      window.localStorage.setItem(GUIDE_SEEN_KEY, "true");
    } catch {
      /* storage unavailable */
    }
  }, []);

  const loadProfile = useCallback(async () => {
    const res = await getProfile();
    if (res.ok) {
      setProfile(res.data);
      if (res.data.preferred_language) setLang(res.data.preferred_language);
    }
  }, [setLang]);

  useEffect(() => {
    let cancelled = false;
    // Hard fallback: never stay on the loading screen more than 4 s.
    const timeout = setTimeout(() => {
      if (!cancelled) setAuthState((s) => (s === "loading" ? "signedOut" : s));
    }, 4000);
    (async () => {
      try {
        const supabase = createSupabaseBrowserClient();
        // "Stay signed in" unchecked: drop the session once the browser session has ended.
        let ephemeralExpired = false;
        try {
          ephemeralExpired =
            window.localStorage.getItem(EPHEMERAL_KEY) === "1" && window.sessionStorage.getItem(EPHEMERAL_KEY) !== "1";
        } catch {
          /* storage unavailable */
        }
        if (ephemeralExpired) await supabase.auth.signOut();
        const { data } = await supabase.auth.getSession();
        if (cancelled) return;
        if (data.session) {
          await loadProfile();
          if (!cancelled) setAuthState("ready");
        } else setAuthState("signedOut");
      } catch {
        if (!cancelled) setAuthState("signedOut");
      } finally {
        clearTimeout(timeout);
      }
    })();
    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [loadProfile]);

  async function signOut() {
    await createSupabaseBrowserClient().auth.signOut();
    setProfile(DEFAULT_PROFILE);
    setItems(null);
    setSettingsOpen(false);
    setAuthState("signedOut");
  }

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
        <div className="flex items-center gap-1">
          <button onClick={() => setGuideOpen(true)} aria-label={t("guide.open")} title={t("guide.open")} className="rounded-full p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800">
            <HelpCircle className="h-5 w-5" />
          </button>
        {authState === "ready" && (
          <>
            <button onClick={signOut} aria-label={t("auth.signOut")} title={t("auth.signOut")} className="rounded-full p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800">
              <LogOut className="h-5 w-5" />
            </button>
            <button onClick={() => setSettingsOpen(true)} aria-label={t("nav.settings")} className="rounded-full p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800">
              <Settings className="h-5 w-5" />
            </button>
          </>
        )}
        </div>
      </header>

      <main className="flex-1 space-y-4 px-4 pb-28 pt-4">
        {authState === "loading" && (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin" aria-label={t("common.loading")} />
          </div>
        )}
        {authState === "signedOut" && (
          <AuthModal
            onOpenLegal={() => setLegalOpen(true)}
            onAuthenticated={async () => {
              await loadProfile();
              setAuthState("ready");
            }}
          />
        )}

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
        {authState === "ready" && (
          <p className="pt-4 text-center">
            <button onClick={() => setLegalOpen(true)} className="text-xs text-neutral-500 underline">
              {t("legal.open")}
            </button>
          </p>
        )}
      </main>

      {authState === "ready" && (
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
      )}

      <AppGuideModal open={guideOpen} onClose={closeGuide} onOpenLegal={() => setLegalOpen(true)} />
      <LegalModal open={legalOpen} onClose={() => setLegalOpen(false)} />
      {settingsOpen && <TargetEditor open profile={profile} onClose={() => setSettingsOpen(false)} onSaved={setProfile} />}
    </div>
  );
}
