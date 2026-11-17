"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import { useI18n } from "@/lib/i18n";

// Public on purpose: set these in Vercel > Settings > Environment Variables (they are inlined at build time).
const OPERATOR = [
  process.env.NEXT_PUBLIC_OPERATOR_NAME,
  process.env.NEXT_PUBLIC_OPERATOR_ADDRESS,
  process.env.NEXT_PUBLIC_OPERATOR_EMAIL,
]
  .filter(Boolean)
  .join(" · ");

export function LegalModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useI18n();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  const h = "mb-1 text-base font-semibold";
  const p = "text-sm leading-relaxed text-neutral-700 break-words dark:text-neutral-300";

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 sm:items-center sm:p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="legal-title"
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl bg-white shadow-xl sm:rounded-3xl dark:bg-neutral-950"
      >
        <div className="flex items-center justify-between gap-3 border-b border-neutral-200 px-4 py-3 dark:border-neutral-800">
          <h2 id="legal-title" className="min-w-0 text-lg font-bold break-words">
            {t("legal.title")}
          </h2>
          <button onClick={onClose} aria-label={t("common.close")} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-800">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto overflow-x-hidden px-4 py-4">
          <section className="space-y-2">
            <h3 className={h}>{t("legal.disclaimer.title")}</h3>
            <p className={p}>{t("legal.disclaimer.body")}</p>
          </section>

          <section className="space-y-2">
            <h3 className={h}>{t("legal.privacy.title")}</h3>
            {["controller", "data", "photos", "processors", "storage", "retention", "rights"].map((k) => (
              <p key={k} className={p}>
                {t(`legal.privacy.${k}`)}
              </p>
            ))}
          </section>

          <section className="space-y-2">
            <h3 className={h}>{t("legal.notice.title")}</h3>
            <p className={p}>{t("legal.notice.body")}</p>
            {OPERATOR && (
              <p className={p}>
                <span className="font-semibold">{t("legal.notice.operator")} : </span>
                {OPERATOR}
              </p>
            )}
          </section>

          <section className="space-y-2">
            <h3 className={h}>{t("legal.terms.title")}</h3>
            <p className={p}>{t("legal.terms.body")}</p>
          </section>
        </div>

        <div className="border-t border-neutral-200 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] dark:border-neutral-800">
          <button onClick={onClose} className="min-h-12 w-full rounded-xl bg-green-600 px-4 py-3 text-base font-semibold text-white hover:bg-green-700">
            {t("common.close")}
          </button>
        </div>
      </div>
    </div>
  );
}
