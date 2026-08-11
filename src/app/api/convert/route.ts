import { NextRequest, NextResponse } from "next/server";
import { getYouTubeInfo, getYouTubeDirectUrl, sanitizeFilename, streamYouTubeVideo } from "@/lib/youtube";
import { getTwitterVideoUrl } from "@/lib/twitter";
import { transcodeToMp3Stream } from "@/lib/ffmpeg";

type Platform = "youtube" | "twitter" | null;

function detectPlatform(url: string): Platform {
  const ytRegex = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be|m\.youtube\.com)\/.+/i;
  const twRegex = /^(https?:\/\/)?(www\.)?(twitter\.com|x\.com)\/.+\/status\/.+/i;
  if (ytRegex.test(url)) return "youtube";
  if (twRegex.test(url)) return "twitter";
  return null;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { url, format, qualityId } = body;

    if (!url || !format) {
      return NextResponse.json({ error: "URL y formato son requeridos." }, { status: 400 });
    }

    const platform = detectPlatform(url);
    if (!platform) {
      return NextResponse.json({ error: "URL no soportada." }, { status: 400 });
    }

    // Handle YouTube
    if (platform === "youtube") {
      try {
        const info = await getYouTubeInfo(url);
        const filename = sanitizeFilename(info.title);
        const extension = format;
        const contentType = format === "mp3" ? "audio/mpeg" : "video/mp4";

        if (format === "mp3") {
          const directUrl = await getYouTubeDirectUrl(url, "mp3");
          const passThrough = transcodeToMp3Stream(directUrl);
          // Convert Node stream to Web ReadableStream
          const readableStream = new ReadableStream({
            start(controller) {
              passThrough.on("data", (chunk: Buffer) => controller.enqueue(new Uint8Array(chunk)));
              passThrough.on("end", () => controller.close());
              passThrough.on("error", (err: Error) => controller.error(err));
            },
            cancel() {
              passThrough.destroy();
            },
          });

          return new NextResponse(readableStream, {
            headers: {
              "Content-Type": "audio/mpeg",
              "Content-Disposition": `attachment; filename="${encodeURIComponent(filename)}.${extension}"`,
            },
          });
        }

        // For MP4, use the streamYouTubeVideo helper which merges video+audio via yt-dlp to stdout
        const stream = streamYouTubeVideo(url, qualityId);

        return new NextResponse(stream, {
          headers: {
            "Content-Type": contentType,
            "Content-Disposition": `attachment; filename="${encodeURIComponent(filename)}.${extension}"`,
          },
        });
      } catch (error) {
        console.error("YouTube error:", error);
        return NextResponse.json({ error: "Error al procesar YouTube." }, { status: 500 });
      }
    }

    // Handle Twitter/X
    if (platform === "twitter") {
      try {
        const tweetData = await getTwitterVideoUrl(url);
        if (!tweetData.videoUrl) throw new Error("Sin video en el tweet");

        const filename = sanitizeFilename(tweetData.title || "twitter_video");

        if (format === "mp4") {
          // If a qualityId was provided, it's the direct URL for that variant
          const targetUrl = qualityId || tweetData.videoUrl;
          
          const response = await fetch(targetUrl);
          return new NextResponse(response.body, {
            headers: {
              "Content-Type": "video/mp4",
              "Content-Disposition": `attachment; filename="${filename}.mp4"`,
            },
          });
        }

        // Si es MP3, transcodificamos usando ffmpeg
        if (format === "mp3") {
          const passThrough = transcodeToMp3Stream(tweetData.videoUrl);

          // Convert Node stream to Web ReadableStream
          const readableStream = new ReadableStream({
            start(controller) {
              passThrough.on("data", (chunk: Buffer) => controller.enqueue(new Uint8Array(chunk)));
              passThrough.on("end", () => controller.close());
              passThrough.on("error", (err: Error) => controller.error(err));
            },
            cancel() {
              passThrough.destroy();
            },
          });

          return new NextResponse(readableStream, {
            headers: {
              "Content-Type": "audio/mpeg",
              "Content-Disposition": `attachment; filename="${filename}.mp3"`,
            },
          });
        }
      } catch (error) {
        console.error("Twitter error:", error);
        return NextResponse.json({ error: "Error al procesar X (Twitter)." }, { status: 500 });
      }
    }

    return NextResponse.json({ error: "Plataforma no manejada." }, { status: 500 });
  } catch (error) {
    console.error("API error:", error);
    return NextResponse.json({ error: "Error interno del servidor." }, { status: 500 });
  }
}
