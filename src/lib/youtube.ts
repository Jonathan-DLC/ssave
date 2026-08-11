import { create } from 'youtube-dl-exec';
import path from 'path';
import os from 'os';

// Explicitly construct the path to the yt-dlp binary to avoid Next.js __dirname issues
const binaryName = os.platform() === 'win32' ? 'yt-dlp.exe' : 'yt-dlp';
const binaryPath = path.join(process.cwd(), 'node_modules', 'youtube-dl-exec', 'bin', binaryName);
const youtubedl = create(binaryPath);

export interface YouTubeFormat {
  format_id: string;
  ext: string;
  resolution: string;
  vcodec: string;
  acodec: string;
  width?: number;
  height?: number;
}

export interface VideoInfo {
  title: string;
  formats: YouTubeFormat[];
}

/**
 * Get video info from a YouTube URL
 */
export async function getYouTubeInfo(url: string): Promise<VideoInfo> {
  const output = await youtubedl(url, {
    dumpJson: true,
    noWarnings: true,
    preferFreeFormats: true,
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
  });
  
  // youtubedl with --get-url returns the URL as stdout (or sometimes multiple URLs separated by newline if using +)
  // If it returns two URLs (video and audio), just use the video URL for browser downloads or let yt-dlp merge them
  // Actually, if we use getUrl with a combined format `137+140`, it returns two URLs.
  // We'll just return the first one, which is the video.
  const urls = (typeof output === 'string' ? output : output.toString()).trim().split("\n");
  return urls[0];
}

import { spawn } from 'child_process';

/**
 * Streams a YouTube video to a Web ReadableStream using yt-dlp + ffmpeg
 */
export function streamYouTubeVideo(url: string, qualityId?: string): ReadableStream {
  const formatStr = qualityId ? `${qualityId}+bestaudio/best` : "best";

  const platformMap: Record<string, string> = {
    win32: "win32-x64",
    darwin: process.arch === "arm64" ? "darwin-arm64" : "darwin-x64",
    linux: process.arch === "arm64" ? "linux-arm64" : (process.arch === "ia32" ? "linux-ia32" : "linux-x64")
  };
  
  const platformFolder = platformMap[os.platform()] || "win32-x64";
  const ffmpegBinary = os.platform() === 'win32' ? 'ffmpeg.exe' : 'ffmpeg';
  const ffmpegPath = path.join(process.cwd(), 'node_modules', '@ffmpeg-installer', platformFolder, ffmpegBinary);

  const ytDlpProcess = spawn(binaryPath, [
    '--ffmpeg-location', ffmpegPath,
    '-f', formatStr,
    '-o', '-',
    '--no-warnings',
    url
  ]);

  return new ReadableStream({
    start(controller) {
      ytDlpProcess.stdout.on('data', (chunk) => {
        controller.enqueue(new Uint8Array(chunk));
      });
      ytDlpProcess.stdout.on('end', () => {
        controller.close();
      });
      ytDlpProcess.on('error', (err) => {
        console.error("yt-dlp process error", err);
        controller.error(err);
      });
    },
    cancel() {
      ytDlpProcess.kill();
    }
  });
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
