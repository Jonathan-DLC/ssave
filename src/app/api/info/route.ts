import { NextRequest, NextResponse } from "next/server";
import { getYouTubeInfo, classifyYouTubeError, type YouTubeErrorKind } from "@/lib/youtube";
import { getTwitterVideoUrl } from "@/lib/twitter";

// yt-dlp es un binario: no corre en el runtime edge.
export const runtime = "nodejs";
// Solo lee metadatos, no descarga nada.
export const maxDuration = 60;

const YOUTUBE_ERRORS: Record<YouTubeErrorKind, { status: number; message: string }> = {
  blocked: { status: 429, message: "YouTube está bloqueando al servidor. Probá de nuevo en unos minutos." },
  private: { status: 403, message: "El video es privado o requiere membresía." },
  unavailable: { status: 404, message: "El video no existe o fue eliminado." },
  unknown: { status: 500, message: "Error al obtener resoluciones." },
};

export interface ResolutionOption {
  id: string; // url for twitter, format_id for youtube
  resolution: string; // e.g. "1280x720"
  label: string; // e.g. "HD 720p"
  sizeBytes?: number; // estimado, permite mostrar progreso real en el cliente
}

export async function POST(request: NextRequest) {
  try {
    const { url, platform } = await request.json();

    if (!url || !platform) {
      return NextResponse.json({ error: "URL y plataforma son requeridos." }, { status: 400 });
    }

    const resolutions: ResolutionOption[] = [];

    if (platform === "youtube") {
      const info = await getYouTubeInfo(url);
      
      // Filter formats to only include those with video.
      // yt-dlp will handle merging audio automatically when downloading.
      // Se excluye HLS: ya trae audio incorporado, sale como MPEG-TS en vez de
      // MP4 y no reporta tamaño, así que no sirve para mostrar progreso.
      const validFormats = info.formats.filter(
        (f) => f.ext === "mp4" && f.vcodec !== "none" && f.height && f.protocol === "https"
      );
      
      // Sort descending by height
      validFormats.sort((a, b) => (b.height || 0) - (a.height || 0));

      // La descarga combina el formato elegido con `bestaudio`, así que el peso
      // total es la suma de ambos. Se aproxima con la pista de audio más pesada.
      const audioBytes = Math.max(
        0,
        ...info.formats
          .filter((f) => f.vcodec === "none" && f.acodec !== "none")
          .map((f) => f.filesize || f.filesize_approx || 0)
      );

      // Deduplicate by height (keep only one format per resolution)
      const seenHeights = new Set<number>();

      validFormats.forEach((format) => {
        if (format.height && !seenHeights.has(format.height)) {
          seenHeights.add(format.height);
          const height = format.height;
          const isHD = height >= 720;
          const label = isHD ? `HD ${format.width}x${height}` : `${format.width}x${height}`;
          const videoBytes = format.filesize || format.filesize_approx || 0;

          resolutions.push({
            id: format.format_id,
            resolution: `${format.width}x${height}`,
            label,
            sizeBytes: videoBytes ? videoBytes + audioBytes : undefined,
          });
        }
      });
      
    } else if (platform === "twitter") {
      const info = await getTwitterVideoUrl(url);
      
      // Deduplicate variants by resolution
      const seenResolutions = new Set<string>();
      
      info.variants.forEach((variant) => {
        if (!seenResolutions.has(variant.resolution)) {
          seenResolutions.add(variant.resolution);
          
          // Parse width and height from "480x852"
          const parts = variant.resolution.split("x");
          let isHD = false;
          if (parts.length === 2) {
            const width = parseInt(parts[0], 10);
            const height = parseInt(parts[1], 10);
            isHD = Math.max(width, height) >= 720;
          }
          
          const label = isHD ? `HD ${variant.resolution}` : variant.resolution;
          
          resolutions.push({
            id: variant.url, // For Twitter, the ID is just the direct URL
            resolution: variant.resolution,
            label,
          });
        }
      });
    }

    return NextResponse.json({ resolutions });
  } catch (error) {
    console.error("API Info error:", error);
    const { status, message } = YOUTUBE_ERRORS[classifyYouTubeError(error)];
    return NextResponse.json({ error: message }, { status });
  }
}
