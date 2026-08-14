"use client";

import { cn, formatBytes } from "@/lib/utils";
import { Download, Check, X, Loader2 } from "lucide-react";

import { useLanguage } from "@/contexts/LanguageContext";

export type DownloadState = "idle" | "loading" | "success" | "error";

interface DownloadButtonProps {
  state: DownloadState;
  onClick: () => void;
  disabled?: boolean;
  receivedBytes?: number;
}

export function DownloadButton({ state, onClick, disabled, receivedBytes = 0 }: DownloadButtonProps) {
  const { t } = useLanguage();
  const isClickable = state === "idle" || state === "error";

  return (
    <button
      type="button"
      onClick={isClickable ? onClick : undefined}
      disabled={disabled || !isClickable}
      className={cn(
        "relative overflow-hidden w-full h-12 rounded-xl text-sm font-semibold transition-all duration-300 flex items-center justify-center gap-2",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        "active:scale-[0.98]",
        {
          // Idle
          "bg-primary text-primary-foreground shadow-md shadow-primary/20 hover:shadow-lg hover:shadow-primary/30 hover:bg-primary/90":
            state === "idle" && !disabled,
          // Disabled
          "bg-muted text-muted-foreground cursor-not-allowed opacity-60":
            disabled,
          // Loading
          "bg-primary/80 text-primary-foreground cursor-wait":
            state === "loading",
          // Success
          "bg-accent text-accent-foreground shadow-md shadow-accent/20":
            state === "success",
          // Error
          "bg-destructive text-destructive-foreground shadow-md shadow-destructive/20 animate-shake":
            state === "error",
        }
      )}
    >
      {state === "idle" && (
        <>
          <Download className="w-4 h-4" />
          <span>{t("download")}</span>
        </>
      )}
      {state === "loading" && (
        <>
          {/* Sin tamaño estimado en MP3, el barrido indica actividad sin fingir un porcentaje. */}
          <span aria-hidden className="absolute inset-0">
            <span className="block h-full w-1/3 bg-white/20 animate-progress-sweep" />
          </span>
          <span className="relative flex items-center gap-2">
            <Loader2 className="w-4 h-4 spinner" />
            <span>{t("downloading")}</span>
            {receivedBytes > 0 && (
              <span className="text-xs font-medium tabular-nums opacity-85">
                {formatBytes(receivedBytes)}
              </span>
            )}
          </span>
        </>
      )}
      {state === "success" && (
        <>
          <Check className="w-4 h-4" />
          <span>{t("success")}</span>
        </>
      )}
      {state === "error" && (
        <>
          <X className="w-4 h-4" />
          <span>{t("error")}</span>
        </>
      )}
    </button>
  );
}
