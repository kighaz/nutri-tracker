"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, ScanBarcode, X } from "lucide-react";
import { useI18n } from "@/lib/i18n";

interface NativeDetector {
  detect(source: CanvasImageSource): Promise<{ rawValue: string }[]>;
}
type DetectorCtor = new (opts: { formats: string[] }) => NativeDetector;

const FORMATS = ["ean_13", "ean_8", "upc_a", "upc_e"];
const BARCODE_RE = /^\d{8,14}$/;

function getDetectorCtor(): DetectorCtor | null {
  const ctor = (window as unknown as { BarcodeDetector?: DetectorCtor }).BarcodeDetector;
  return ctor ?? null;
}

/** Decode a barcode from a still photo (works over plain HTTP, no getUserMedia needed). */
async function decodeFromFile(file: File): Promise<string | null> {
  const Ctor = getDetectorCtor();
  if (Ctor) {
    const bitmap = await createImageBitmap(file);
    try {
      const found = await new Ctor({ formats: FORMATS }).detect(bitmap);
      if (found[0]) return found[0].rawValue;
    } finally {
      bitmap.close();
    }
  }
  const { BrowserMultiFormatReader } = await import("@zxing/browser");
  const url = URL.createObjectURL(file);
  try {
    const result = await new BrowserMultiFormatReader().decodeFromImageUrl(url);
    return result.getText();
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function BarcodeScanner({
  onDetected,
  onClose,
}: {
  onDetected: (barcode: string) => void;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const videoRef = useRef<HTMLVideoElement>(null);
  const photoRef = useRef<HTMLInputElement>(null);
  const [manual, setManual] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  // getUserMedia only exists in secure contexts (HTTPS / localhost).
  const liveSupported = typeof navigator !== "undefined" && Boolean(navigator.mediaDevices?.getUserMedia);

  useEffect(() => {
    if (!liveSupported) return;
    let stopped = false;
    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setInterval> | undefined;
    let controls: { stop: () => void } | undefined;

    const cleanup = () => {
      stopped = true;
      if (timer) clearInterval(timer);
      controls?.stop();
      stream?.getTracks().forEach((tr) => tr.stop());
    };
    const done = (code: string) => {
      if (stopped || !BARCODE_RE.test(code)) return;
      cleanup();
      onDetected(code);
    };

    (async () => {
      const video = videoRef.current;
      if (!video) return;
      try {
        const Ctor = getDetectorCtor();
        if (Ctor) {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: { ideal: "environment" } },
            audio: false,
          });
          if (stopped) return cleanup();
          video.srcObject = stream;
          await video.play();
          const detector = new Ctor({ formats: FORMATS });
          timer = setInterval(async () => {
            try {
              const found = await detector.detect(video);
              if (found[0]) done(found[0].rawValue);
            } catch {
              /* frame not ready */
            }
          }, 250);
        } else {
          const { BrowserMultiFormatReader } = await import("@zxing/browser");
          if (stopped) return;
          controls = await new BrowserMultiFormatReader().decodeFromConstraints(
            { video: { facingMode: { ideal: "environment" } }, audio: false },
            video,
            (result) => {
              if (result) done(result.getText());
            },
          );
          if (stopped) controls.stop();
        }
      } catch {
        if (!stopped) setMessage("scan.camError");
      }
    })();

    return cleanup;
  }, [liveSupported, onDetected]);

  async function handlePhoto(file: File | undefined) {
    if (!file) return;
    setMessage("scan.reading");
    try {
      const code = await decodeFromFile(file);
      if (code && BARCODE_RE.test(code)) onDetected(code);
      else setMessage("scan.noCode");
    } catch {
      setMessage("scan.noCode");
    } finally {
      if (photoRef.current) photoRef.current.value = "";
    }
  }

  function submitManual(e: React.FormEvent) {
    e.preventDefault();
    const code = manual.replace(/\s/g, "");
    if (BARCODE_RE.test(code)) onDetected(code);
    else setMessage("scan.invalid");
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center" role="dialog" aria-modal="true">
      <div className="w-full max-w-md space-y-3 rounded-t-2xl bg-white p-4 shadow-xl dark:bg-neutral-900 sm:rounded-2xl">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <ScanBarcode className="h-5 w-5" aria-hidden /> {t("scan.title")}
          </h2>
          <button onClick={onClose} aria-label={t("common.close")} className="rounded-full p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800">
            <X className="h-5 w-5" />
          </button>
        </div>

        {liveSupported ? (
          <div className="relative overflow-hidden rounded-xl bg-black">
            <video ref={videoRef} playsInline muted className="aspect-[4/3] w-full object-cover" />
            <div className="pointer-events-none absolute inset-x-8 top-1/2 h-0.5 -translate-y-1/2 bg-red-500/80" />
          </div>
        ) : (
          <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">{t("scan.insecure")}</p>
        )}

        <p className="text-xs text-neutral-500">{t("scan.hint")}</p>
        {message && <p className="text-sm text-red-600">{t(message)}</p>}

        <button
          type="button"
          onClick={() => photoRef.current?.click()}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-neutral-300 py-3 text-sm font-medium hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800"
        >
          <Camera className="h-4 w-4" aria-hidden /> {t("scan.photoFallback")}
        </button>
        <input ref={photoRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => handlePhoto(e.target.files?.[0])} />

        <form onSubmit={submitManual} className="flex gap-2">
          <input
            value={manual}
            onChange={(e) => setManual(e.target.value)}
            inputMode="numeric"
            placeholder={t("scan.manual")}
            className="min-w-0 flex-1 rounded-xl border border-neutral-300 bg-transparent px-3 py-2 dark:border-neutral-700"
          />
          <button type="submit" className="rounded-xl bg-neutral-900 px-4 py-2 text-sm font-medium text-white dark:bg-white dark:text-neutral-900">
            OK
          </button>
        </form>
      </div>
    </div>
  );
}
