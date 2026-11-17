"use client";

import { useState } from "react";
import { Download, Loader2, Trash2 } from "lucide-react";
import { deleteMyAccount, exportMyData } from "@/app/actions/account";
import { useI18n } from "@/lib/i18n";
import { createSupabaseBrowserClient } from "@/lib/supabase";

/** Self-service RGPD/DSGVO rights: export (Art. 15/20) and erasure (Art. 17). */
export function AccountPanel() {
  const { t } = useI18n();
  const [busy, setBusy] = useState<"export" | "delete" | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function doExport() {
    setBusy("export");
    setError(null);
    const res = await exportMyData();
    setBusy(null);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `nutri-tracker-export-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function doDelete() {
    setBusy("delete");
    setError(null);
    const res = await deleteMyAccount();
    if (!res.ok) {
      setBusy(null);
      setError(res.error);
      return;
    }
    try {
      await createSupabaseBrowserClient().auth.signOut();
      window.localStorage.removeItem("nutri_tracker_guide_seen");
    } catch {
      /* already signed out / storage unavailable */
    }
    window.location.reload();
  }

  return (
    <section className="space-y-3 rounded-2xl border border-neutral-200 p-4 dark:border-neutral-800">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">{t("account.title")}</h3>

      <button
        onClick={doExport}
        disabled={busy !== null}
        className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-neutral-300 px-3 py-2 text-sm font-medium hover:bg-neutral-100 disabled:opacity-60 dark:border-neutral-700 dark:hover:bg-neutral-800"
      >
        {busy === "export" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
        {busy === "export" ? t("account.exporting") : t("account.export")}
      </button>

      {!confirming ? (
        <button
          onClick={() => setConfirming(true)}
          disabled={busy !== null}
          className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-red-300 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-60 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950/40"
        >
          <Trash2 className="h-4 w-4" />
          {t("account.delete")}
        </button>
      ) : (
        <div className="space-y-2 rounded-xl bg-red-50 p-3 dark:bg-red-950/40">
          <p className="text-sm text-red-800 dark:text-red-300">{t("account.deleteWarn")}</p>
          <div className="flex gap-2">
            <button
              onClick={() => setConfirming(false)}
              disabled={busy !== null}
              className="min-h-11 flex-1 rounded-xl border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700"
            >
              {t("common.cancel")}
            </button>
            <button
              onClick={doDelete}
              disabled={busy !== null}
              className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
            >
              {busy === "delete" && <Loader2 className="h-4 w-4 animate-spin" />}
              {busy === "delete" ? t("account.deleting") : t("account.deleteConfirm")}
            </button>
          </div>
        </div>
      )}

      {error && <p className="text-sm text-red-600">{t(error)}</p>}
    </section>
  );
}
