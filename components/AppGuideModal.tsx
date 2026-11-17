"use client";

import { useEffect, type ReactNode } from "react";
import { BookOpen, Camera, ShieldCheck, Smartphone, Sparkles, X } from "lucide-react";
import { useI18n } from "@/lib/i18n";

function Section({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900">
      <h3 className="mb-2 flex items-center gap-2 text-base font-semibold break-words">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400">
          {icon}
        </span>
        <span className="min-w-0">{title}</span>
      </h3>
      <div className="space-y-2 text-sm leading-relaxed text-neutral-700 break-words dark:text-neutral-300">{children}</div>
    </section>
  );
}

export function AppGuideModal({ open, onClose, onOpenLegal }: { open: boolean; onClose: () => void; onOpenLegal: () => void }) {
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

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="guide-title"
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl bg-white shadow-xl sm:rounded-3xl dark:bg-neutral-950"
      >
        <div className="flex items-start justify-between gap-3 border-b border-neutral-200 px-4 py-3 dark:border-neutral-800">
          <div className="min-w-0">
            <h2 id="guide-title" className="text-lg font-bold text-green-700 break-words dark:text-green-400">
              {t("guide.title")}
            </h2>
            <p className="text-xs text-neutral-500">{t("guide.subtitle")}</p>
          </div>
          <button
            onClick={onClose}
            aria-label={t("common.close")}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-800"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto overflow-x-hidden px-4 py-4 [-webkit-overflow-scrolling:touch]">
          <Section icon={<Sparkles className="h-4 w-4" />} title={t("guide.s1.title")}>
            <p>{t("guide.s1.body")}</p>
            <div className="flex gap-2 rounded-xl bg-green-50 p-3 text-green-900 dark:bg-green-950/50 dark:text-green-200">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
              <div className="min-w-0">
                <p className="font-semibold">{t("guide.privacy.title")}</p>
                <p>{t("guide.privacy.body")}</p>
              </div>
            </div>
          </Section>

          <Section icon={<Camera className="h-4 w-4" />} title={t("guide.s2.title")}>
            <ol className="list-decimal space-y-1.5 pl-5">
              <li>{t("guide.s2.step1")}</li>
              <li>{t("guide.s2.step2")}</li>
              <li>{t("guide.s2.step3")}</li>
            </ol>
          </Section>

          <Section icon={<BookOpen className="h-4 w-4" />} title={t("guide.s3.title")}>
            <p>{t("guide.s3.recipes")}</p>
            <p>{t("guide.s3.targets")}</p>
          </Section>

          <Section icon={<Smartphone className="h-4 w-4" />} title={t("guide.s4.title")}>
            <p>{t("guide.s4.ios")}</p>
            <p>{t("guide.s4.android")}</p>
          </Section>

          <p className="px-1 text-xs text-neutral-500">
            {t("guide.storageNotice")}{" "}
            <button onClick={onOpenLegal} className="underline">
              {t("legal.open")}
            </button>
          </p>
        </div>

        <div className="border-t border-neutral-200 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] dark:border-neutral-800">
          <button
            onClick={onClose}
            className="min-h-12 w-full rounded-xl bg-green-600 px-4 py-3 text-base font-semibold text-white hover:bg-green-700 active:bg-green-800"
          >
            {t("guide.cta")}
          </button>
        </div>
      </div>
    </div>
  );
}
