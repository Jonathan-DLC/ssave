import youtubedl from 'youtube-dl-exec';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import type { DownloadEvent } from './downloadProtocol';
import { spawn } from 'child_process';
import { Readable } from 'stream';
import { writeFileSync, createReadStream } from 'fs';
import { mkdtemp, readdir, stat, rm } from 'fs/promises';
import { tmpdir } from 'os';
import path from 'path';

// El paquete resuelve la ruta del binario contra su propio __dirname y expone
// el resultado en runtime, pero no lo declara en sus tipos. Construirla a mano
// desde process.cwd() rompe en Vercel, donde el cwd es /var/task.
const binaryPath = (youtubedl as unknown as {
  constants: { YOUTUBE_DL_PATH: string };
}).constants.YOUTUBE_DL_PATH;

export interface YouTubeFormat {
  format_id: string;
  ext: string;
  resolution: string;
  vcodec: string;
  acodec: string;
  width?: number;
  height?: number;
  // yt-dlp solo conoce el tamaño exacto en algunos formatos; en el resto
  // devuelve una estimación a partir del bitrate y la duración.
  filesize?: number | null;
  filesize_approx?: number | null;
  // "https" para descarga directa, "m3u8_native" para HLS.
  protocol?: string;
}

export interface VideoInfo {
  title: string;
  formats: YouTubeFormat[];
}

let cachedCookiesPath: string | undefined;

/**
 * Vuelca las cookies a disco porque yt-dlp solo acepta `--cookies` como ruta a
 * un archivo en formato Netscape. En Vercel el único directorio escribible es
 * el temporal, y sobrevive entre invocaciones de la misma instancia.
 */
function getCookiesPath(): string | undefined {
  if (!process.env.YOUTUBE_COOKIES) return undefined;
  if (cachedCookiesPath) return cachedCookiesPath;

  const target = path.join(tmpdir(), 'yt-cookies.txt');
  writeFileSync(target, process.env.YOUTUBE_COOKIES, 'utf8');
  cachedCookiesPath = target;
  return cachedCookiesPath;
}

// yt-dlp necesita un runtime JS para descifrar las firmas de YouTube. Sin uno
// avisa que la extracción está deprecada y devuelve menos formatos. Se apunta
// al Node que ya ejecuta este proceso en lugar de depender del sistema.
const JS_RUNTIME = `node:${process.execPath}` as const;

/**
 * Flags comunes a toda invocación. El proxy es opcional para que el proyecto
 * siga corriendo en local, donde la IP residencial no está bloqueada.
 */
function commonFlags(): { jsRuntimes: `node:${string}`; proxy?: string; cookies?: string } {
  const flags: { jsRuntimes: `node:${string}`; proxy?: string; cookies?: string } = {
    jsRuntimes: JS_RUNTIME,
  };
  if (process.env.YOUTUBE_PROXY) flags.proxy = process.env.YOUTUBE_PROXY;

  const cookies = getCookiesPath();
  if (cookies) flags.cookies = cookies;

  return flags;
}

export type YouTubeErrorKind = 'blocked' | 'private' | 'unavailable' | 'unknown';

/**
 * yt-dlp comunica la causa real por stderr y youtube-dl-exec la adjunta al
 * Error. Distinguirlas evita que un bloqueo por IP se reporte igual que un
 * video borrado, que es lo que hacía imposible diagnosticar en producción.
 */
export function classifyYouTubeError(error: unknown): YouTubeErrorKind {
  const stderr = errorStderr(error);

  if (/confirm you.?re not a bot|Sign in to confirm/i.test(stderr)) return 'blocked';
  if (/Private video|members-only/i.test(stderr)) return 'private';
  if (/Video unavailable|does not exist|has been removed/i.test(stderr)) return 'unavailable';
  return 'unknown';
}

/**
 * Get video info from a YouTube URL
 */
export async function getYouTubeInfo(url: string): Promise<VideoInfo> {
  const output = await youtubedl(url, {
    dumpJson: true,
    noWarnings: true,
    preferFreeFormats: true,
    ...commonFlags(),
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = output as any;

  return {
    title: data.title || "youtube_video",
    formats: data.formats || [],
  };
}

/**
 * Get a direct download URL for a YouTube video
 */
export async function getYouTubeDirectUrl(url: string, format: "mp4" | "mp3", qualityId?: string): Promise<string> {
  let formatStr = format === "mp3" ? "bestaudio" : "best";
  if (qualityId) {
    formatStr = qualityId;
  }

  const output = await youtubedl(url, {
    getUrl: true,
    format: formatStr,
    noWarnings: true,
    ...commonFlags(),
  });

  // Con un formato combinado (137+140) yt-dlp devuelve una URL por línea;
  // la primera es la de video.
  const urls = (typeof output === 'string' ? output : output.toString()).trim().split("\n");
  return urls[0];
}

export interface DownloadedMedia {
  /** Stream de Node para que la ruta pueda encadenarlo con backpressure real. */
  stream: Readable;
  sizeBytes: number;
  ext: string;
  title: string;
}

// Formato propio para el progreso de yt-dlp: sale por stdout, que está libre
// porque el video va a disco. El prefijo lo distingue del resto de la salida.
const PROGRESS_PREFIX = 'SSAVE|';
const PROGRESS_TEMPLATE =
  `${PROGRESS_PREFIX}%(progress.downloaded_bytes)s|%(progress.total_bytes)s|%(progress.total_bytes_estimate)s|%(progress.speed)s|%(progress.eta)s`;

/** yt-dlp escribe "NA" en los campos que todavía no conoce. */
function numOrUndefined(raw: string): number | undefined {
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
}

/**
 * Ejecuta yt-dlp y resuelve cuando termina bien. Al rechazar adjunta el stderr
 * en la misma forma que youtube-dl-exec, para que classifyYouTubeError sirva
 * igual en los dos caminos.
 */
function runYtDlp(args: string[], onEvent?: (event: DownloadEvent) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(binaryPath, args);

    let stderr = "";
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    // Un merge descarga video y audio por separado, así que el contador de
    // yt-dlp vuelve a cero entre uno y otro. Se acumula para que el progreso
    // que ve el usuario avance en una sola dirección.
    let completedBytes = 0;
    let lastBytes = 0;
    let pending = "";

    child.stdout.on('data', (chunk: Buffer) => {
      pending += chunk.toString();
      const lines = pending.split('\n');
      pending = lines.pop() ?? "";

      for (const line of lines) {
        if (line.includes('[Merger]')) {
          onEvent?.({ type: 'merging' });
          continue;
        }
        if (!line.startsWith(PROGRESS_PREFIX)) continue;

        const [rawDone, rawTotal, rawEstimate, rawSpeed, rawEta] = line
          .slice(PROGRESS_PREFIX.length)
          .split('|');

        const done = numOrUndefined(rawDone);
        if (done === undefined) continue;

        if (done < lastBytes) completedBytes += lastBytes;
        lastBytes = done;

        const total = numOrUndefined(rawTotal) ?? numOrUndefined(rawEstimate);

        onEvent?.({
          type: 'progress',
          bytes: completedBytes + done,
          totalBytes: total === undefined ? undefined : completedBytes + total,
          speed: numOrUndefined(rawSpeed),
          eta: numOrUndefined(rawEta),
        });
      }
    });

    child.on('error', (err) => reject(Object.assign(err, { stderr })));
    child.on('close', (code) => {
      if (code === 0) return resolve();
      reject(Object.assign(new Error(`yt-dlp terminó con código ${code}`), { stderr }));
    });
  });
}

// YouTube devuelve 403 sobre URLs recién extraídas de forma intermitente: el
// itag 137 falló 2 de 3 veces al medirlo. `--retries` de yt-dlp no sirve porque
// reintenta la misma URL caducada; hay que volver a extraer, y eso solo pasa en
// una invocación nueva.
const TRANSIENT_ERROR = /HTTP Error 403|unable to download video data|Connection reset|timed out|Temporary failure/i;

function errorStderr(error: unknown): string {
  return typeof error === 'object' && error !== null && 'stderr' in error
    ? String((error as { stderr: unknown }).stderr)
    : String(error);
}

async function runYtDlpWithRetry(
  args: string[],
  workDir: string,
  onEvent?: (event: DownloadEvent) => void,
  attempts = 3,
): Promise<void> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await runYtDlp(args, onEvent);
    } catch (error) {
      if (attempt >= attempts || !TRANSIENT_ERROR.test(errorStderr(error))) throw error;

      console.warn(`yt-dlp falló con error transitorio, reintento ${attempt}/${attempts - 1}`);
      // Un intento fallido puede dejar .part a medias que confundirían al readdir.
      for (const leftover of await readdir(workDir)) {
        await rm(path.join(workDir, leftover), { force: true }).catch(() => {});
      }
    }
  }
}

/**
 * Descarga y mezcla el video en un archivo temporal, y devuelve un stream de
 * ese archivo ya terminado.
 *
 * No se usa `-o -`: mezclar hacia un pipe obliga a yt-dlp a delegar la descarga
 * en ffmpeg, que pide la URL de googlevideo de corrido y cae en el throttling
 * de YouTube (medido: 0.7 MB/s contra 12-20 MB/s dejando descargar a yt-dlp,
 * que trocea por rangos). Escribir a disco además da salida seekable, así que
 * el MP4 sale con su átomo moov en vez de degradar a Matroska.
 */
export async function downloadYouTubeVideo(
  url: string,
  qualityId?: string,
  onEvent?: (event: DownloadEvent) => void,
): Promise<DownloadedMedia> {
  const workDir = await mkdtemp(path.join(tmpdir(), 'ssave-'));

  // El audio se restringe a m4a para que el merge quede MP4 sin recodificar.
  // `bestaudio` a secas elige webm/opus y fuerza un cambio de contenedor.
  const formatStr = qualityId
    ? `${qualityId}+bestaudio[ext=m4a]/${qualityId}+bestaudio/best[ext=mp4]/best`
    : "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best";

  const args = [
    '--ffmpeg-location', ffmpegInstaller.path,
    '--js-runtimes', JS_RUNTIME,
    '-f', formatStr,
    '--merge-output-format', 'mp4',
    // El nombre sale del título, así se obtiene sin una segunda extracción.
    '-o', path.join(workDir, '%(title)s.%(ext)s'),
    '--no-warnings',
    '--no-playlist',
    // YouTube devuelve 403 de forma intermitente sobre URLs válidas; volver a
    // extraer consigue URLs frescas y suele resolverlo.
    '--retries', '5',
    '--extractor-retries', '3',
    '--fragment-retries', '5',
    // Una línea por actualización, en vez de reescribir la misma con \r.
    '--newline',
    '--progress-template', PROGRESS_TEMPLATE,
  ];

  if (process.env.YOUTUBE_PROXY) args.push('--proxy', process.env.YOUTUBE_PROXY);

  const cookies = getCookiesPath();
  if (cookies) args.push('--cookies', cookies);

  args.push(url);

  try {
    await runYtDlpWithRetry(args, workDir, onEvent);

    const files = await readdir(workDir);
    if (files.length === 0) throw new Error("yt-dlp no generó ningún archivo");

    const filePath = path.join(workDir, files[0]);
    const { size } = await stat(filePath);

    const fileStream = createReadStream(filePath);
    // 'close' cubre tanto el final normal como la cancelación del cliente.
    fileStream.on('close', () => {
      rm(workDir, { recursive: true, force: true }).catch(() => {});
    });

    const ext = path.extname(files[0]).slice(1) || "mp4";

    return {
      stream: fileStream,
      sizeBytes: size,
      ext,
      title: path.basename(files[0], path.extname(files[0])) || "youtube_video",
    };
  } catch (error) {
    await rm(workDir, { recursive: true, force: true }).catch(() => {});
    throw error;
  }
}

/**
 * Sanitize a filename to be safe for downloads
 */
export function sanitizeFilename(name: string): string {
  return name
    .replace(/[^\w\s\-_.()áéíóúñü]/gi, "")
    .replace(/\s+/g, "_")
    .substring(0, 100);
}
