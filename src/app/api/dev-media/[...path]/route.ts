import { createReadStream } from "node:fs";
import { realpath, stat } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";

/**
 * Preview-mode media: streams files from SEED_DATA_DIR (default ./data) so the
 * site can be viewed before Cloudinary/Supabase exist. Development only (404 in
 * production). Supports HTTP Range requests, which video playback needs.
 */

const CONTENT_TYPES: Record<string, string> = {
  ".mp4": "video/mp4",
  ".m4v": "video/mp4",
  ".mov": "video/quicktime",
  ".webm": "video/webm",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".avif": "image/avif",
};

type Ctx = { params: Promise<{ path: string[] }> };

const notFound = () => new Response("Not found", { status: 404 });
const badRequest = () => new Response("Bad request", { status: 400 });

/** Resolves the request to a regular file inside the data dir, or a Response to send instead. */
async function resolveFile(ctx: Ctx): Promise<{ file: string; size: number } | Response> {
  if (process.env.NODE_ENV === "production") return notFound();

  const dataDir = path.resolve(/* turbopackIgnore: true */ process.cwd(), process.env.SEED_DATA_DIR || "./data");
  let realDataDir: string;
  try {
    if (!(await stat(dataDir)).isDirectory()) return notFound();
    realDataDir = await realpath(dataDir);
  } catch {
    return notFound();
  }

  const { path: segments } = await ctx.params;
  if (!Array.isArray(segments) || segments.length === 0) return notFound();
  for (const segment of segments) {
    if (
      segment === "" ||
      segment === "." ||
      segment === ".." ||
      segment.includes("/") ||
      segment.includes("\\") ||
      segment.includes("\0") ||
      segment.includes(":")
    ) {
      return badRequest();
    }
  }

  const candidate = path.resolve(dataDir, ...segments);
  if (!candidate.startsWith(dataDir + path.sep)) return badRequest();

  try {
    // realpath also defeats symlinks that point outside the data dir.
    const real = await realpath(candidate);
    if (!real.startsWith(realDataDir + path.sep)) return badRequest();
    const info = await stat(real);
    if (!info.isFile()) return notFound();
    return { file: real, size: info.size };
  } catch {
    return notFound();
  }
}

/** Parses a single `bytes=` range. `null` = no/ignored range, `"invalid"` = unsatisfiable. */
function parseRange(header: string | null, size: number): { start: number; end: number } | null | "invalid" {
  if (!header) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match) return null; // multi-range or unknown unit: serve the whole file
  const [, rawStart, rawEnd] = match;
  if (rawStart === "" && rawEnd === "") return "invalid";

  let start: number;
  let end: number;
  if (rawStart === "") {
    const suffix = Number(rawEnd);
    if (suffix === 0) return "invalid";
    start = Math.max(0, size - suffix);
    end = size - 1;
  } else {
    start = Number(rawStart);
    end = rawEnd === "" ? size - 1 : Math.min(Number(rawEnd), size - 1);
  }
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start > end || start >= size) return "invalid";
  return { start, end };
}

function baseHeaders(file: string): Headers {
  return new Headers({
    "Content-Type": CONTENT_TYPES[path.extname(file).toLowerCase()] ?? "application/octet-stream",
    "Accept-Ranges": "bytes",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
}

const toWeb = (file: string, opts: { start: number; end: number }) =>
  Readable.toWeb(createReadStream(file, opts)) as unknown as ReadableStream<Uint8Array>;

export async function GET(request: Request, ctx: Ctx) {
  const resolved = await resolveFile(ctx);
  if (resolved instanceof Response) return resolved;
  const { file, size } = resolved;
  const headers = baseHeaders(file);

  const range = parseRange(request.headers.get("range"), size);
  if (range === "invalid") {
    headers.set("Content-Range", `bytes */${size}`);
    return new Response(null, { status: 416, headers });
  }

  if (range) {
    headers.set("Content-Range", `bytes ${range.start}-${range.end}/${size}`);
    headers.set("Content-Length", String(range.end - range.start + 1));
    return new Response(toWeb(file, range), { status: 206, headers });
  }

  headers.set("Content-Length", String(size));
  if (size === 0) return new Response(null, { status: 200, headers });
  return new Response(toWeb(file, { start: 0, end: size - 1 }), { status: 200, headers });
}

export async function HEAD(_request: Request, ctx: Ctx) {
  const resolved = await resolveFile(ctx);
  if (resolved instanceof Response) return new Response(null, { status: resolved.status });
  const headers = baseHeaders(resolved.file);
  headers.set("Content-Length", String(resolved.size));
  return new Response(null, { status: 200, headers });
}
