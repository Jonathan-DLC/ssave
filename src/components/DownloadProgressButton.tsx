"use client";

import { Download, Loader2 } from "lucide-react";
import { cn, formatBytes } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";

export type DownloadPhase = "starting" | "downloading" | "merging" | "transferring";

export interface Progress {
  phase: DownloadPhase;
  bytes: number;
  total?: number;
  speed?: number;
}

export const IDLE_PROGRESS: Progress = { phase: "starting", bytes: 0 };

interface DownloadProgressButtonProps {
  label: string;
  downloading: boolean;
  progress: Progress;
  /** Estimación de /api/info, para los primeros instantes en que yt-dlp todavía no reportó el total. */
  fallbackTotal?: number;
  onClick: () => void;
  disabled?: boolean;
}

export function DownloadProgressButton({
  label,
  downloading,
  progress,
  fallbackTotal,
  onClick,
  disabled,
}: DownloadProgressButtonProps) {
  const { t } = useLanguage();

  const total = progress.total ?? (progress.phase === "downloading" ? fallbackTotal : undefined);

  // Se topea en 99 mientras la descarga sigue: el total puede ser una
  // estimación de yt-dlp y llegar a 100 antes de tiempo haría que mienta.
  const percent =
    downloading && total ? Math.min(99, Math.round((progress.bytes / total) * 100)) : null;

  const phaseLabel = {
    starting: t("preparing"),
    downloading: t("downloadingQuality", { label }),
    merging: t("merging"),
    transferring: t("saving"),
  }[progress.phase];

  return (
    <button
      type="button"
      onClick={downloading ? undefined : onClick}
      disabled={disabled || downloading}
      aria-busy={downloading}
      className={cn(
        "relative w-full h-12 overflow-hidden rounded-xl text-white shadow-md",
        "transition-all duration-200 active:scale-[0.98]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        "disabled:pointer-events-none",
        downloading ? "bg-[#0369a1] cursor-wait" : "bg-[#0ea5e9] hover:bg-[#0284c7]",
        disabled && !downloading && "opacity-60"
      )}
    >
      {downloading && (
        <span
          className="absolute inset-0"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent ?? undefined}
        >
          {percent !== null ? (
            <span
              className="block h-full bg-[#0ea5e9] transition-[width] duration-300 ease-out"
              style={{ width: `${percent}%` }}
            />
          ) : (
            <span className="block h-full w-1/3 bg-[#0ea5e9] animate-progress-sweep" />
          )}
        </span>
      )}

      <span className="relative flex h-full items-center justify-between gap-2 px-4">
        {downloading ? (
          <>
            <span className="flex min-w-0 items-center gap-2">
              <Loader2 className="w-4 h-4 shrink-0 spinner" />
              <span className="truncate text-[15px] font-semibold">{phaseLabel}</span>
            </span>
            {progress.bytes > 0 && progress.phase !== "merging" && (
              <span className="shrink-0 text-xs font-medium tabular-nums text-white/85">
                {formatBytes(progress.bytes)}
                {total ? ` / ${formatBytes(total)}` : ""}
                {progress.speed ? ` · ${formatBytes(progress.speed)}/s` : ""}
              </span>
            )}
          </>
        ) : (
          <span className="flex w-full items-center justify-center gap-2">
            <Download className="w-5 h-5" />
            <span className="text-[15px] font-semibold">
              {t("download")} {label}
            </span>
          </span>
        )}
      </span>
    </button>
  );
}
