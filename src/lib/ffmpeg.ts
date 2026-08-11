import path from "path";
import os from "os";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const ffmpeg = require("fluent-ffmpeg");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { PassThrough } = require("stream");

// Setup ffmpeg path
const platformMap: Record<string, string> = {
  win32: "win32-x64",
  darwin: process.arch === "arm64" ? "darwin-arm64" : "darwin-x64",
  linux: process.arch === "arm64" ? "linux-arm64" : (process.arch === "ia32" ? "linux-ia32" : "linux-x64")
};

const platformFolder = platformMap[os.platform()] || "win32-x64";
const binaryName = os.platform() === 'win32' ? 'ffmpeg.exe' : 'ffmpeg';
const ffmpegPath = path.join(process.cwd(), 'node_modules', '@ffmpeg-installer', platformFolder, binaryName);

ffmpeg.setFfmpegPath(ffmpegPath);

export function transcodeToMp3Stream(inputUrl: string) {
  const passThrough = new PassThrough();

  ffmpeg(inputUrl)
    .noVideo()
    .audioCodec("libmp3lame")
    .format("mp3")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .on("error", (err: any) => console.error("FFmpeg error:", err))
    .pipe(passThrough);

  return passThrough;
}
