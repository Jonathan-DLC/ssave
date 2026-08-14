"use client";

import { useState, useCallback, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { FormatSelector, type Format } from "@/components/FormatSelector";
import { DownloadButton, type DownloadState } from "@/components/DownloadButton";
import { DownloadProgressButton, IDLE_PROGRESS, type Progress } from "@/components/DownloadProgressButton";
import { FRAMED_MEDIA_TYPE, readFrames } from "@/lib/downloadProtocol";
import { LinkIcon, AlertCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";

type Platform = "youtube" | "twitter" | null;

interface ResolutionOption {
  id: string;
  resolution: string;
  label: string;
  sizeBytes?: number;
}

// Identifica la descarga que no viene de un botón de resolución (MP3 y fallback).
const DEFAULT_DOWNLOAD_ID = "__default__";

// Custom brand icons (not available in lucide-react)
function YoutubeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
    </svg>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
    </svg>
  );
}

function detectPlatform(url: string): Platform {
  const trimmed = url.trim();
  if (!trimmed) return null;

  const ytRegex = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be|m\.youtube\.com)\/.+/i;
  const twRegex = /^(https?:\/\/)?(www\.)?(twitter\.com|x\.com)\/.+\/status\/.+/i;

  if (ytRegex.test(trimmed)) return "youtube";
  if (twRegex.test(trimmed)) return "twitter";
  return null;
}

const platformConfig = {
  youtube: {
    label: "YouTube",
    icon: YoutubeIcon,
    color: "text-red-500",
    bgColor: "bg-red-50",
    borderColor: "border-red-200",
  },
  twitter: {
    label: "X (Twitter)",
    icon: XIcon,
    color: "text-sky-500",
    bgColor: "bg-sky-50",
    borderColor: "border-sky-200",
  },
};

export function ConverterCard() {
  const [url, setUrl] = useState("");
  const [platform, setPlatform] = useState<Platform>(null);
  const [format, setFormat] = useState<Format>("mp4");
  const [downloadState, setDownloadState] = useState<DownloadState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [resolutions, setResolutions] = useState<ResolutionOption[] | null>(null);
  const [isFetchingResolutions, setIsFetchingResolutions] = useState(false);
  const [activeDownloadId, setActiveDownloadId] = useState<string | null>(null);
  const [progress, setProgress] = useState<Progress>(IDLE_PROGRESS);
  const { t } = useLanguage();

  // Detect platform on URL change
  useEffect(() => {
    const detected = detectPlatform(url);
    setPlatform(detected);

    // Reset states
    setResolutions(null);
    if (downloadState === "success" || downloadState === "error") {
      setDownloadState("idle");
      setErrorMessage(null);
    }
  }, [url, format]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto fetch resolutions when valid MP4 URL is pasted
  useEffect(() => {
    if (platform && format === "mp4" && url.trim().length > 5) {
      const fetchResolutions = async () => {
        setIsFetchingResolutions(true);
        setErrorMessage(null);
        try {
          const res = await fetch("/api/info", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url: url.trim(), platform }),
          });
          if (res.ok) {
            const data = await res.json();
            setResolutions(data.resolutions);
          } else {
            const data = await res.json().catch(() => ({}));
            setErrorMessage(data.error || "Error al buscar calidades");
          }
        } catch {
          setErrorMessage("Error de conexión");
        } finally {
          setIsFetchingResolutions(false);
        }
      };
      
      const timeoutId = setTimeout(fetchResolutions, 800);
      return () => clearTimeout(timeoutId);
    }
  }, [url, platform, format]);

  const handleDownload = useCallback(async (qualityId?: string) => {
    if (!url.trim() || !platform) return;

    setDownloadState("loading");
    setActiveDownloadId(qualityId ?? DEFAULT_DOWNLOAD_ID);
    setProgress(IDLE_PROGRESS);
    setErrorMessage(null);

    try {
      const response = await fetch("/api/convert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim(), format, qualityId }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({ error: "Error desconocido" }));
        throw new Error(data.error || `Error ${response.status}`);
      }

      // Get the filename from the response headers
      const contentDisposition = response.headers.get("Content-Disposition");
      let filename = `download.${format}`;
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="?([^";\n]+)"?/);
        if (match) filename = match[1];
      }

      if (!response.body) throw new Error("La respuesta llegó vacía");

      const reader = response.body.getReader();
      const chunks: BlobPart[] = [];
      let blobType = response.headers.get("Content-Type") ?? "application/octet-stream";
      let received = 0;
      let lastRender = 0;

      // Un video grande llega en miles de chunks; renderizar en cada uno satura
      // el hilo principal sin que el usuario note la diferencia.
      const publish = (next: Progress, force = false) => {
        const now = Date.now();
        if (!force && now - lastRender < 150) return;
        lastRender = now;
        setProgress(next);
      };

      // El video llega con las líneas de progreso por delante; el resto de los
      // formatos son bytes crudos desde el primer chunk.
      if (response.headers.get("Content-Type") === FRAMED_MEDIA_TYPE) {
        let last: Progress = { phase: "downloading", bytes: 0 };

        const { leftover, ready } = await readFrames(reader, (frame) => {
          last =
            frame.type === "merging"
              ? { ...last, phase: "merging" }
              : { phase: "downloading", bytes: frame.bytes, total: frame.totalBytes, speed: frame.speed };
          publish(last, frame.type === "merging");
        });
        filename = ready.filename;
        blobType = ready.contentType;

        if (leftover.length > 0) {
          chunks.push(leftover);
          received = leftover.length;
        }
        publish({ phase: "transferring", bytes: received, total: ready.sizeBytes }, true);

        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
          received += value.length;
          publish({ phase: "transferring", bytes: received, total: ready.sizeBytes });
        }
      } else {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
          received += value.length;
          publish({ phase: "transferring", bytes: received });
        }
      }

      const blob = new Blob(chunks, { type: blobType });
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(downloadUrl);

      setDownloadState("success");
      setActiveDownloadId(null);
      setTimeout(() => setDownloadState("idle"), 3000);
    } catch (error) {
      setDownloadState("error");
      setActiveDownloadId(null);
      setErrorMessage(error instanceof Error ? error.message : "Error al procesar la descarga");
      setTimeout(() => setDownloadState("idle"), 4000);
    }
  }, [url, platform, format]);

  const showPlatformBadge = url.trim().length > 5;
  const isValidUrl = platform !== null;

  return (
    <div className="w-full max-w-lg mx-auto animate-fade-in" style={{ animationDelay: "0.1s", opacity: 0 }}>
      <div className="glass-card rounded-2xl p-6 sm:p-8 space-y-6">
        {/* Title */}
        <div className="text-center space-y-2">
          <h2 className="text-lg font-semibold text-foreground">
            {t("pasteLink")}
          </h2>
          <p className="text-sm text-muted-foreground">
            {t("supportedPlatforms")}
          </p>
        </div>

        {/* URL Input */}
        <div className="space-y-3">
          <div className="relative">
            <LinkIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <Input
              id="url-input"
              type="url"
              placeholder={t("placeholderUrl")}
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="pl-10 pr-4"
            />
          </div>

          {/* Platform Detection Badge */}
          {showPlatformBadge && (
            <div className="animate-scale-in">
              {platform ? (
                <div
                  className={cn(
                    "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border transition-all duration-200",
                    platformConfig[platform].bgColor,
                    platformConfig[platform].color,
                    platformConfig[platform].borderColor
                  )}
                >
                  {(() => {
                    const Icon = platformConfig[platform].icon;
                    return <Icon className="w-3 h-3" />;
                  })()}
                  <span>{platformConfig[platform].label} {t("detected")}</span>
                </div>
              ) : (
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border border-amber-200 bg-amber-50 text-amber-600">
                  <AlertCircle className="w-3 h-3" />
                  <span>URL no soportada</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Format Selector */}
        {isValidUrl && (
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Formato
            </label>
            <FormatSelector
              selected={format}
              onSelect={setFormat}
            />
          </div>
        )}

        {/* Download Button / Resolutions */}
        {format === "mp4" && platform ? (
          isFetchingResolutions ? (
            <div className="flex flex-col gap-2">
              <Button disabled className="w-full rounded-xl bg-[#0ea5e9]/50 text-white h-12 shadow-md">
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                <span className="font-semibold text-[15px]">Buscando resoluciones...</span>
              </Button>
            </div>
          ) : resolutions && resolutions.length > 0 ? (
            <div className="flex flex-col gap-2.5 animate-scale-in">
              {resolutions.map((res) => (
                <DownloadProgressButton
                  key={res.id}
                  label={res.label}
                  downloading={downloadState === "loading" && activeDownloadId === res.id}
                  progress={progress}
                  fallbackTotal={res.sizeBytes}
                  onClick={() => handleDownload(res.id)}
                  disabled={downloadState === "loading"}
                />
              ))}
            </div>
          ) : (
            <DownloadButton
              state={downloadState}
              onClick={() => handleDownload()}
              disabled={!isValidUrl || downloadState === "loading"}
              receivedBytes={progress.bytes}
            />
          )
        ) : (
          <DownloadButton
            state={downloadState}
            onClick={() => handleDownload()}
            disabled={!isValidUrl || downloadState === "loading"}
            receivedBytes={progress.bytes}
          />
        )}

        {/* Error Message */}
        {errorMessage && (
          <p className="text-xs text-destructive text-center animate-fade-in">
            {errorMessage}
          </p>
        )}
      </div>
    </div>
  );
}
