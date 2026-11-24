/**
 * Cloudinary delivery URLs. Client-safe: no secrets, no SDK.
 *
 * Non-destructive edits (`MediaItem.edits`) are applied at delivery time as
 * chained transformation components, BEFORE the size/format component:
 *
 *   a_hflip / a_vflip → a_<deg> → c_crop (relative 0–1) → e_brightness / e_contrast / e_saturation
 *     → [videoUrl: so_,eo_ trim] → resize + format (+ so_<frame> for posters)
 *
 * The crop uses RELATIVE coordinates (decimals of the rotated frame) rather than
 * pixels: Cloudinary may downscale very large images rotated by an arbitrary
 * angle, which would put pixel coordinates out of bounds. Relative values also
 * work when the original width/height are unknown.
 *
 * Media with a `local:` public id (preview mode) map to `/api/dev-media/<path>`;
 * width/height/crop AND edits are ignored there (the raw file is streamed).
 */
import { cropPixels, rotatedBox } from "@/core/lib/media-edits";
import type { MediaEdits, MediaItem } from "@/core/types/content";
import { isLocalPublicId, localMediaUrl } from "./paths";

export interface ImageUrlOptions {
  width?: number;
  height?: number;
  crop?: "fill" | "limit" | "fit";
  gravity?: "auto" | "face";
}

const cloudName = (): string => (process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ?? "").trim();

const px = (n: number | undefined): number | null =>
  typeof n === "number" && Number.isFinite(n) && n > 0 ? Math.round(n) : null;

/** Encode each path segment of a public id, keeping the slashes. */
const encodeId = (publicId: string): string =>
  publicId
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");

/**
 * Builds a delivery URL from chained components. Each entry of `components` is
 * one `/`-separated component, given as its comma-joined parts; empty ones are dropped.
 */
function deliveryUrl(resource: "image" | "video", components: string[][], publicId: string, ext = ""): string {
  const cloud = cloudName();
  if (!cloud) return "";
  const chain = components
    .map((parts) => parts.filter(Boolean).join(","))
    .filter(Boolean)
    .join("/");
  return `https://res.cloudinary.com/${cloud}/${resource}/upload/${chain ? `${chain}/` : ""}${encodeId(publicId)}${ext}`;
}

function sizeTransforms(opts: ImageUrlOptions): string[] {
  const width = px(opts.width);
  const height = px(opts.height);
  if (width === null && height === null) return [];
  const crop = opts.crop ?? (width !== null && height !== null ? "fill" : "limit");
  const out = [`c_${crop}`];
  if (width !== null) out.push(`w_${width}`);
  if (height !== null) out.push(`h_${height}`);
  if (crop === "fill") out.push(`g_${opts.gravity ?? "auto"}`);
  return out;
}

const limitWidth = (width: number | null): string[] => (width !== null ? ["c_limit", `w_${width}`] : []);

/** Percent (0–100) → Cloudinary relative value, always with a decimal point ("0.5", "1.0"). */
const rel = (percent: number): string => {
  const s = (Math.min(100, Math.max(0, percent)) / 100).toFixed(6).replace(/0+$/, "");
  return s.endsWith(".") ? `${s}0` : s;
};

const secs = (n: number): string => String(Math.round(n * 100) / 100);

/** Edit components in contract order: flip → rotate → crop → adjustments. */
function editComponents(edits: MediaEdits | null): string[][] {
  if (!edits) return [];
  const out: string[][] = [];
  if (edits.flipH) out.push(["a_hflip"]);
  if (edits.flipV) out.push(["a_vflip"]);
  if (edits.rotation !== 0) out.push([`a_${edits.rotation}`]);
  if (edits.crop) {
    const { x, y, width, height } = edits.crop;
    out.push(["c_crop", `x_${rel(x)}`, `y_${rel(y)}`, `w_${rel(width)}`, `h_${rel(height)}`]);
  }
  if (edits.brightness !== 0) out.push([`e_brightness:${edits.brightness}`]);
  if (edits.contrast !== 0) out.push([`e_contrast:${edits.contrast}`]);
  if (edits.saturation !== 0) out.push([`e_saturation:${edits.saturation}`]);
  return out;
}

/** Trim component for video delivery (`so_`/`eo_` on the original timeline). */
function trimComponent(edits: MediaEdits | null): string[] {
  if (!edits) return [];
  const out: string[] = [];
  if (edits.trimStart !== null) out.push(`so_${secs(edits.trimStart)}`);
  if (edits.trimEnd !== null) out.push(`eo_${secs(edits.trimEnd)}`);
  return out;
}

/**
 * Poster frame second: the requested offset (default posterOffset) clamped into
 * the trimmed range, so the poster always shows a frame that will play.
 */
function posterSecond(media: MediaItem, offset?: number): number {
  const requested = typeof offset === "number" && Number.isFinite(offset) ? offset : media.posterOffset;
  const start = media.edits?.trimStart ?? 0;
  const endLimit = media.edits?.trimEnd ?? media.duration ?? Number.POSITIVE_INFINITY;
  const value = Number.isFinite(requested) ? requested : 0;
  const clamped = Math.min(Math.max(value, start), Math.max(start, endLimit - 0.1));
  return clamped > 0 ? Math.round(clamped * 10) / 10 : 0;
}

/** Edited still frame of a video (`so_` selects the frame in the final component — verified equivalent to `so_` first). */
function posterUrl(media: MediaItem, size: string[], format: string[], offset?: number): string {
  return deliveryUrl(
    "video",
    [...editComponents(media.edits), [`so_${posterSecond(media, offset)}`, ...size, ...format]],
    media.publicId,
    ".jpg",
  );
}

/**
 * Image delivery URL (`f_auto,q_auto`) with the item's edits applied. Accepts a
 * MediaItem or a bare public id (no edits). A video MediaItem yields its edited
 * poster frame instead; for `local:` media the raw file URL is returned.
 */
export function imageUrl(media: MediaItem | string, opts: ImageUrlOptions = {}): string {
  const publicId = typeof media === "string" ? media : media.publicId;
  if (isLocalPublicId(publicId)) return localMediaUrl(publicId);
  if (typeof media === "string") {
    return deliveryUrl("image", [[...sizeTransforms(opts), "f_auto", "q_auto"]], publicId);
  }
  if (media.resourceType === "video") return posterUrl(media, sizeTransforms(opts), ["f_auto", "q_auto"]);
  return deliveryUrl(
    "image",
    [...editComponents(media.edits), [...sizeTransforms(opts), "f_auto", "q_auto"]],
    publicId,
  );
}

/** Video delivery URL (`q_auto,vc_auto`, `.mp4`) with edits and trim applied, optionally width-limited. */
export function videoUrl(media: MediaItem, opts: { width?: number } = {}): string {
  if (isLocalPublicId(media.publicId)) return localMediaUrl(media.publicId);
  return deliveryUrl(
    "video",
    [...editComponents(media.edits), trimComponent(media.edits), [...limitWidth(px(opts.width)), "q_auto", "vc_auto"]],
    media.publicId,
    ".mp4",
  );
}

/**
 * An edited jpg frame of the video at `offset` seconds (default: posterOffset,
 * clamped into the trim range). `null` for local media.
 */
export function videoPosterUrl(media: MediaItem, opts: { width?: number; offset?: number } = {}): string | null {
  if (isLocalPublicId(media.publicId)) return null;
  return posterUrl(media, limitWidth(px(opts.width)), ["q_auto"], opts.offset) || null;
}

/** Thumbnail for grids: edited image URL for images, edited poster for videos (`null` for local videos). */
export function thumbUrl(media: MediaItem, width: number): string | null {
  if (media.resourceType === "video") return videoPosterUrl(media, { width });
  const url = imageUrl(media, { width, crop: "limit" });
  return url || null;
}

/**
 * Displayed size after rotation + crop, in pixels of the original (Cloudinary
 * may scale huge arbitrary-angle rotations down, but the aspect ratio holds).
 * `null` when the original size is unknown. `local:` media ignore edits.
 */
export function editedDimensions(media: MediaItem): { width: number; height: number } | null {
  const { width, height } = media;
  if (!width || !height) return null;
  const edits = isLocalPublicId(media.publicId) ? null : media.edits;
  if (!edits) return { width, height };
  const crop = cropPixels(edits, width, height);
  if (crop) return { width: crop.width, height: crop.height };
  const box = rotatedBox(width, height, edits.rotation);
  return { width: Math.round(box.width), height: Math.round(box.height) };
}

/** UNEDITED image proxy for the editor (`c_limit`, `f_auto,q_auto`); a video yields its unedited frame at posterOffset. */
export function sourceImageUrl(media: MediaItem, opts: { width?: number } = {}): string {
  if (isLocalPublicId(media.publicId)) return localMediaUrl(media.publicId);
  const size = limitWidth(px(opts.width));
  if (media.resourceType === "video") {
    const second = Number.isFinite(media.posterOffset) && media.posterOffset > 0 ? Math.round(media.posterOffset * 10) / 10 : 0;
    return deliveryUrl("video", [[`so_${second}`, ...size, "f_auto", "q_auto"]], media.publicId, ".jpg");
  }
  return deliveryUrl("image", [[...size, "f_auto", "q_auto"]], media.publicId);
}

/** UNEDITED, untrimmed video proxy for the editor (`.mp4`, `q_auto,vc_auto`). */
export function sourceVideoUrl(media: MediaItem, opts: { width?: number } = {}): string {
  if (isLocalPublicId(media.publicId)) return localMediaUrl(media.publicId);
  return deliveryUrl("video", [[...limitWidth(px(opts.width)), "q_auto", "vc_auto"]], media.publicId, ".mp4");
}
