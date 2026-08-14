import { NextRequest, NextResponse } from "next/server";
import { PassThrough, Readable } from "stream";
import { getYouTubeInfo, getYouTubeDirectUrl, sanitizeFilename, downloadYouTubeVideo, classifyYouTubeError, type YouTubeErrorKind } from "@/lib/youtube";
import { getTwitterVideoUrl } from "@/lib/twitter";
import { transcodeToMp3Stream } from "@/lib/ffmpeg";
import { FRAMED_MEDIA_TYPE, type DownloadFrame } from "@/lib/downloadProtocol";

// yt-dlp y ffmpeg son binarios: no corren en el runtime edge.
export const runtime = "nodejs";
// Techo de Fluid Compute en plan Hobby. Videos largos igual se cortan acá.
export const maxDuration = 300;

// El merge normalmente da mp4, pero si yt-dlp cae a otro contenedor conviene
// declararlo de verdad en vez de mentir con video/mp4.
const MEDIA_TYPES: Record<string, string> = {
  mp4: "video/mp4",
  mkv: "video/x-matroska",
  webm: "video/webm",
};

const YOUTUBE_ERRORS: Record<YouTubeErrorKind, { status: number; message: string }> = {
  blocked: { status: 429, message: "YouTube está bloqueando al servidor. Probá de nuevo en unos minutos." },
  private: { status: 403, message: "El video es privado o requiere membresía." },
  unavailable: { status: 404, message: "El video no existe o fue eliminado." },
  unknown: { status: 500, message: "Error al procesar YouTube." },
};

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
        if (format === "mp3") {
          const info = await getYouTubeInfo(url);
          const filename = sanitizeFilename(info.title);
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
              "Content-Disposition": `attachment; filename="${encodeURIComponent(filename)}.mp3"`,
            },
          });
        }

        // La respuesta empieza a salir de inmediato con líneas de progreso y
        // termina con los bytes del archivo. Ver src/lib/downloadProtocol.ts.
        const body = new PassThrough();

        const send = (frame: DownloadFrame) => {
          if (!body.writableEnded) body.write(`${JSON.stringify(frame)}\n`);
        };

        // Deliberadamente sin await: la respuesta tiene que volver ya para que
        // el cliente empiece a leer el progreso.
        (async () => {
          try {
            const media = await downloadYouTubeVideo(url, qualityId, send);

            send({
              type: "ready",
              sizeBytes: media.sizeBytes,
              filename: `${sanitizeFilename(media.title)}.${media.ext}`,
              contentType: MEDIA_TYPES[media.ext] ?? "application/octet-stream",
            });

            media.stream.pipe(body);
          } catch (error) {
            console.error("YouTube error:", error);
            // Los headers ya salieron, así que el fallo viaja como frame en vez
            // de como código de estado.
            send({ type: "error", message: YOUTUBE_ERRORS[classifyYouTubeError(error)].message });
            body.end();
          }
        })();

        return new NextResponse(Readable.toWeb(body) as ReadableStream, {
          headers: {
            "Content-Type": FRAMED_MEDIA_TYPE,
            "Cache-Control": "no-store",
          },
        });
      } catch (error) {
        console.error("YouTube error:", error);
        const { status, message } = YOUTUBE_ERRORS[classifyYouTubeError(error)];
        return NextResponse.json({ error: message }, { status });
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
