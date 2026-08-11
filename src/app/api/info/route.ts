import { NextRequest, NextResponse } from "next/server";
import { getYouTubeInfo } from "@/lib/youtube";
import { getTwitterVideoUrl } from "@/lib/twitter";

export interface ResolutionOption {
  id: string; // url for twitter, format_id for youtube
  resolution: string; // e.g. "1280x720"
  label: string; // e.g. "HD 720p"
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
      const validFormats = info.formats.filter(
        (f) => f.ext === "mp4" && f.vcodec !== "none" && f.height
      );
      
      // Sort descending by height
      validFormats.sort((a, b) => (b.height || 0) - (a.height || 0));
      
      // Deduplicate by height (keep only one format per resolution)
      const seenHeights = new Set<number>();
      
      validFormats.forEach((format) => {
        if (format.height && !seenHeights.has(format.height)) {
          seenHeights.add(format.height);
          const height = format.height;
          const isHD = height >= 720;
          const label = isHD ? `HD ${format.width}x${height}` : `${format.width}x${height}`;
          
          resolutions.push({
            id: format.format_id,
            resolution: `${format.width}x${height}`,
            label,
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
    return NextResponse.json({ error: "Error al obtener resoluciones." }, { status: 500 });
  }
}
