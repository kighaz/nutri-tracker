"use client";

import { useRef, useState } from "react";
import { Camera, ImageIcon, Loader2, Search } from "lucide-react";
import { analyzeFood } from "@/app/actions/analyze-food";
import { compressImage } from "@/lib/image";
import { useI18n } from "@/lib/i18n";
import type { ResolvedItem } from "@/types/nutrition";

export function CaptureModule({
  onResult,
}: {
  onResult: (items: ResolvedItem[], warnings: string[]) => void;
}) {
  const { t, lang } = useI18n();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const img = await compressImage(file); // in-memory canvas downscale
      const res = await analyzeFood({
        imageBase64: img.base64,
        mimeType: img.mimeType,
        text: text.trim() || undefined,
        lang,
      });
      if (res.ok) onResult(res.items, res.warnings);
      else setError(res.error);
    } catch {
      setError("common.error");
    } finally {
      setBusy(false);
      if (cameraRef.current) cameraRef.current.value = "";
      if (galleryRef.current) galleryRef.current.value = "";
    }
  }

  async function handleText(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setBusy(true);
    setError(null);
    const res = await analyzeFood({ text, lang });
    setBusy(false);
    if (res.ok) onResult(res.items, res.warnings);
    else setError(res.error);
  }

  return (
    <section className="space-y-4 rounded-2xl border border-neutral-200 p-4 dark:border-neutral-800">
      <h2 className="text-lg font-semibold">{t("capture.title")}</h2>

      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          disabled={busy}
          onClick={() => cameraRef.current?.click()}
          className="flex flex-col items-center gap-1 rounded-xl bg-green-600 px-3 py-4 text-white hover:bg-green-700 disabled:opacity-60"
        >
          <Camera className="h-6 w-6" aria-hidden />
          <span className="text-sm font-medium">{t("capture.takePhoto")}</span>
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => galleryRef.current?.click()}
          className="flex flex-col items-center gap-1 rounded-xl border border-neutral-300 px-3 py-4 hover:bg-neutral-100 disabled:opacity-60 dark:border-neutral-700 dark:hover:bg-neutral-800"
        >
          <ImageIcon className="h-6 w-6" aria-hidden />
          <span className="text-sm font-medium">{t("capture.choosePhoto")}</span>
        </button>
        <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => handleFile(e.target.files?.[0])} />
        <input ref={galleryRef} type="file" accept="image/*" hidden onChange={(e) => handleFile(e.target.files?.[0])} />
      </div>

      <form onSubmit={handleText} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" aria-hidden />
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={t("capture.textPlaceholder")}
            maxLength={500}
            className="w-full rounded-xl border border-neutral-300 bg-transparent py-3 pl-9 pr-3 text-base dark:border-neutral-700"
          />
        </div>
        <button
          type="submit"
          disabled={busy || !text.trim()}
          className="rounded-xl bg-neutral-900 px-4 py-3 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-neutral-900"
        >
          {busy ? <Loader2 className="h-5 w-5 animate-spin" aria-label={t("capture.analyzing")} /> : t("capture.analyze")}
        </button>
      </form>

      <p className="text-xs text-neutral-500">{t("capture.photoDiscarded")}</p>
      {busy && <p className="text-sm text-neutral-600 dark:text-neutral-400">{t("capture.analyzing")}</p>}
      {error && <p className="text-sm text-red-600">{t(error)}</p>}
    </section>
  );
}
