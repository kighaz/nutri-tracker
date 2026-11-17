"use client";

import { useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { LANG_NAMES, useI18n } from "@/lib/i18n";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import { LANGS } from "@/types/nutrition";

/** Marker used to honour an unchecked "Stay signed in": the session is dropped when the browser is closed. */
export const EPHEMERAL_KEY = "nutri.ephemeral";

export function AuthModal({ onAuthenticated, onOpenLegal }: { onAuthenticated: () => void; onOpenLegal: () => void }) {
  const { t, lang, setLang } = useI18n();
  const [consent, setConsent] = useState(false);
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [stay, setStay] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  function remember() {
    try {
      if (stay) window.localStorage.removeItem(EPHEMERAL_KEY);
      else {
        window.localStorage.setItem(EPHEMERAL_KEY, "1");
        window.sessionStorage.setItem(EPHEMERAL_KEY, "1");
      }
    } catch {
      /* storage unavailable: session persists, which is the safe default */
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setMessage(null);
    if (password.length < 6) {
      setMessage({ ok: false, text: t("auth.weak") });
      return;
    }
    if (mode === "signup" && !consent) {
      setMessage({ ok: false, text: t("auth.ageRequired") });
      return;
    }
    setBusy(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const creds = { email: email.trim(), password };
      if (mode === "signup") {
        // Consent proof (age >= 16 + privacy policy) is stored in the user's auth metadata.
        const { data, error } = await supabase.auth.signUp({
          ...creds,
          options: { data: { age_confirmed_16: true, privacy_consent_at: new Date().toISOString() } },
        });
        if (error) throw error;
        if (data.session) {
          remember();
          onAuthenticated();
        } else {
          // Email confirmation is enabled in Supabase: no session until the link is clicked.
          setMessage({ ok: true, text: t("auth.checkEmail") });
          setMode("signin");
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword(creds);
        if (error) throw error;
        remember();
        onAuthenticated();
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message.toLowerCase() : "";
      setMessage({
        ok: false,
        text: msg.includes("invalid login") || msg.includes("credentials") ? t("auth.invalid") : msg.includes("password") ? t("auth.weak") : t("auth.failed"),
      });
    } finally {
      setBusy(false);
    }
  }

  const field = "w-full rounded-xl border border-neutral-300 bg-transparent px-3 py-3 text-base dark:border-neutral-700";

  return (
    <div className="mx-auto w-full max-w-sm space-y-5 py-8">
      <div className="flex justify-center gap-2 text-sm">
        {LANGS.map((l) => (
          <button
            key={l}
            type="button"
            onClick={() => setLang(l)}
            className={`rounded-lg px-3 py-1 ${lang === l ? "bg-green-600 text-white" : "border border-neutral-300 dark:border-neutral-700"}`}
          >
            {LANG_NAMES[l]}
          </button>
        ))}
      </div>

      <form onSubmit={submit} className="space-y-4 rounded-2xl border border-neutral-200 p-5 dark:border-neutral-800">
        <h2 className="text-xl font-semibold">{mode === "signin" ? t("auth.signIn") : t("auth.signUp")}</h2>
        <input
          type="email"
          required
          autoComplete="email"
          inputMode="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t("auth.email")}
          aria-label={t("auth.email")}
          className={field}
        />
        <input
          type="password"
          required
          minLength={6}
          autoComplete={mode === "signin" ? "current-password" : "new-password"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={t("auth.password")}
          aria-label={t("auth.password")}
          className={field}
        />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={stay} onChange={(e) => setStay(e.target.checked)} className="h-4 w-4 accent-green-600" />
          {t("auth.stay")}
        </label>
        {mode === "signup" && (
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-green-600" />
            <span className="min-w-0 break-words">{t("auth.ageConsent")}</span>
          </label>
        )}
        {message && <p className={`text-sm ${message.ok ? "text-green-700 dark:text-green-400" : "text-red-600"}`}>{message.text}</p>}
        <button
          type="submit"
          disabled={busy}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-green-600 py-3 font-medium text-white hover:bg-green-700 disabled:opacity-60"
        >
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          {mode === "signin" ? t("auth.signIn") : t("auth.signUp")}
        </button>
        <button
          type="button"
          onClick={() => {
            setMode(mode === "signin" ? "signup" : "signin");
            setMessage(null);
          }}
          className="w-full text-center text-sm text-green-700 underline dark:text-green-400"
        >
          {mode === "signin" ? t("auth.noAccount") : t("auth.haveAccount")}
        </button>
      </form>
      <button type="button" onClick={onOpenLegal} className="w-full text-center text-xs text-neutral-500 underline">
        {t("legal.open")}
      </button>
    </div>
  );
}
