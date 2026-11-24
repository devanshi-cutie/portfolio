/**
 * Shrinks files that are over Cloudinary's free-plan limits, using ffmpeg.
 *
 * Outputs go to `.seed-cache/` with a name keyed on the source path, size,
 * mtime and encoder preset, so re-runs reuse them and a changed source or
 * preset produces a fresh file. ffmpeg is only looked up when a compression is
 * actually needed.
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { MB, shortHash, type PlannedMedia } from "./plan";

/** Bump when the ffmpeg arguments change so stale cache entries are not reused. */
const VIDEO_PRESET = "h264-short1080-crf23-medium-aac128-faststart-v1";
const IMAGE_PRESET = "jpeg-max4000-q3-v1";

export interface PreparedFile {
  /** the file to upload: the original or the compressed copy */
  uploadPath: string;
  bytes: number;
  compressed: boolean;
  /** compressed output reused from .seed-cache */
  cached: boolean;
}

export interface CompressOptions {
  cacheDir: string;
  maxVideoBytes: number;
  maxImageBytes: number;
  /** progress lines for long encodes */
  onProgress?: (message: string) => void;
}

export function cachePathFor(item: PlannedMedia, cacheDir: string): string {
  const preset = item.resourceType === "video" ? VIDEO_PRESET : IMAGE_PRESET;
  const key = shortHash(`${item.source}|${item.bytes}|${Math.round(item.mtimeMs)}|${preset}`);
  const leaf = item.publicId.split("/").pop();
  return path.join(cacheDir, `${leaf}-${key}.${item.resourceType === "video" ? "mp4" : "jpg"}`);
}

export function isCached(item: PlannedMedia, cacheDir: string): boolean {
  return fs.existsSync(cachePathFor(item, cacheDir));
}

/* ------------------------------------------------------------- ffmpeg */

export class FfmpegMissingError extends Error {
  constructor() {
    super(
      "ffmpeg is required to compress oversize files but was not found on PATH. " +
        "Install it (https://ffmpeg.org/download.html, or `winget install Gyan.FFmpeg` / `brew install ffmpeg`) and re-run.",
    );
    this.name = "FfmpegMissingError";
  }
}

let ffmpegCheck: Promise<void> | null = null;

/** Resolves when `ffmpeg` runs; rejects with FfmpegMissingError otherwise. Memoised. */
export function ensureFfmpeg(): Promise<void> {
  ffmpegCheck ??= new Promise<void>((resolve, reject) => {
    const child = spawn("ffmpeg", ["-version"], { stdio: "ignore", windowsHide: true });
    child.on("error", () => reject(new FfmpegMissingError()));
    child.on("close", (code) => (code === 0 ? resolve() : reject(new FfmpegMissingError())));
  });
  return ffmpegCheck;
}

/** One encode at a time: libx264 already uses every core, and parallel encodes just thrash. */
let encodeQueue: Promise<unknown> = Promise.resolve();
function serialized<T>(task: () => Promise<T>): Promise<T> {
  const run = encodeQueue.then(task, task);
  encodeQueue = run.catch(() => undefined);
  return run;
}

function runFfmpeg(args: string[], label: string, onProgress?: (message: string) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn("ffmpeg", ["-hide_banner", "-loglevel", "error", "-nostats", "-progress", "pipe:1", ...args], {
      windowsHide: true,
    });
    let stderr = "";
    let lastReport = Date.now();
    let outTime = "";

    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      const match = /out_time=(\d+:\d+:\d+)/.exec(chunk);
      if (match) outTime = match[1];
      if (onProgress && outTime && Date.now() - lastReport > 15_000) {
        lastReport = Date.now();
        onProgress(`encoding ${label}: ${outTime} done`);
      }
    });
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk: string) => {
      stderr = (stderr + chunk).slice(-4000);
    });
    child.on("error", (error: NodeJS.ErrnoException) => {
      reject(error.code === "ENOENT" ? new FfmpegMissingError() : error);
    });
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exited with code ${code}: ${stderr.trim().split("\n").slice(-3).join(" | ")}`));
    });
  });
}

/**
 * H.264 MP4, shorter side scaled to 1080 (never upscaled), CRF 23 / preset medium,
 * AAC 128k, moov atom up front. ffmpeg applies the rotation matrix before the scale
 * filter, so portrait phone clips stay portrait. Metadata (incl. GPS) is dropped.
 */
export function videoArgs(input: string, output: string): string[] {
  const scale =
    "scale=w='if(gte(iw,ih),-2,trunc(min(1080,iw)/2)*2)':h='if(gte(iw,ih),trunc(min(1080,ih)/2)*2,-2)'";
  return [
    "-y",
    "-i", input,
    "-map", "0:v:0",
    "-map", "0:a:0?",
    "-map_metadata", "-1",
    "-vf", scale,
    "-c:v", "libx264",
    "-preset", "medium",
    "-crf", "23",
    "-pix_fmt", "yuv420p",
    "-c:a", "aac",
    "-b:a", "128k",
    "-movflags", "+faststart",
    "-f", "mp4",
    output,
  ];
}

/** JPEG, longest side at most 4000px, quality ~85 (mjpeg -q:v 3), EXIF orientation applied. */
export function imageArgs(input: string, output: string): string[] {
  return [
    "-y",
    "-i", input,
    "-vf", "scale=w='min(4000,iw)':h='min(4000,ih)':force_original_aspect_ratio=decrease",
    "-frames:v", "1",
    "-map_metadata", "-1",
    "-c:v", "mjpeg",
    "-q:v", "3",
    "-pix_fmt", "yuvj420p",
    "-f", "image2",
    "-update", "1",
    output,
  ];
}

/**
 * Returns the file to upload for `item`. Files under the limit are used as-is;
 * oversize ones are compressed into the cache (or the cached copy is reused).
 */
export async function prepareFile(item: PlannedMedia, options: CompressOptions): Promise<PreparedFile> {
  if (!item.compress) {
    return { uploadPath: item.absPath, bytes: item.bytes, compressed: false, cached: false };
  }

  const output = cachePathFor(item, options.cacheDir);
  const limit = item.resourceType === "video" ? options.maxVideoBytes : options.maxImageBytes;
  let cached = true;

  if (!fs.existsSync(output)) {
    cached = false;
    await ensureFfmpeg();
    fs.mkdirSync(options.cacheDir, { recursive: true });
    // Encode to a temp name and rename, so an interrupted run never leaves a
    // truncated file that a later run would mistake for a finished one.
    const partial = `${output}.partial`;
    const args = item.resourceType === "video" ? videoArgs(item.absPath, partial) : imageArgs(item.absPath, partial);
    try {
      await serialized(() => runFfmpeg(args, item.source, options.onProgress));
      fs.renameSync(partial, output);
    } finally {
      fs.rmSync(partial, { force: true });
    }
  }

  const bytes = fs.statSync(output).size;
  if (bytes > limit) {
    throw new Error(
      `still ${(bytes / MB).toFixed(1)} MB after compression (limit ${(limit / MB).toFixed(1)} MB) — trim or re-encode it manually (cached at ${output})`,
    );
  }
  return { uploadPath: output, bytes, compressed: true, cached };
}
