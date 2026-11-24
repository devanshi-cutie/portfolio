/**
 * Cloudinary delivery URLs. Client-safe: no secrets, no SDK.
 *
 * Media with a `local:` public id (preview mode) map to `/api/dev-media/<path>`,
 * where width/height/crop are ignored.
 */
import type { MediaItem } from "@/core/types/content";
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

function deliveryUrl(resource: "image" | "video", transforms: string[], publicId: string, ext = ""): string {
  const cloud = cloudName();
  if (!cloud) return "";
  const t = transforms.filter(Boolean).join(",");
  return `https://res.cloudinary.com/${cloud}/${resource}/upload/${t ? `${t}/` : ""}${encodeId(publicId)}${ext}`;
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

const offsetOf = (media: MediaItem, offset?: number): number => {
  const value = typeof offset === "number" ? offset : media.posterOffset;
  return Number.isFinite(value) && value > 0 ? Math.round(value * 10) / 10 : 0;
};

/**
 * Image delivery URL (`f_auto,q_auto`). Accepts a MediaItem or a bare public id.
 * A video MediaItem yields a still frame (its poster) instead; for `local:` media
 * the raw file URL is returned.
 */
export function imageUrl(media: MediaItem | string, opts: ImageUrlOptions = {}): string {
  const publicId = typeof media === "string" ? media : media.publicId;
  if (isLocalPublicId(publicId)) return localMediaUrl(publicId);

  if (typeof media !== "string" && media.resourceType === "video") {
    return deliveryUrl(
      "video",
      [`so_${offsetOf(media)}`, ...sizeTransforms(opts), "f_auto", "q_auto"],
      publicId,
      ".jpg",
    );
  }
  return deliveryUrl("image", [...sizeTransforms(opts), "f_auto", "q_auto"], publicId);
}

/** Video delivery URL (`q_auto,vc_auto`, `.mp4`), optionally width-limited. */
export function videoUrl(media: MediaItem, opts: { width?: number } = {}): string {
  if (isLocalPublicId(media.publicId)) return localMediaUrl(media.publicId);
  const width = px(opts.width);
  return deliveryUrl(
    "video",
    [...(width !== null ? ["c_limit", `w_${width}`] : []), "q_auto", "vc_auto"],
    media.publicId,
    ".mp4",
  );
}

/** A jpg frame of the video at `offset` seconds (default: the item's posterOffset). `null` for local media. */
export function videoPosterUrl(media: MediaItem, opts: { width?: number; offset?: number } = {}): string | null {
  if (isLocalPublicId(media.publicId)) return null;
  const width = px(opts.width);
  const url = deliveryUrl(
    "video",
    [`so_${offsetOf(media, opts.offset)}`, ...(width !== null ? ["c_limit", `w_${width}`] : []), "q_auto"],
    media.publicId,
    ".jpg",
  );
  return url || null;
}

/** Thumbnail for grids: image URL for images, poster for videos (`null` for local videos). */
export function thumbUrl(media: MediaItem, width: number): string | null {
  if (media.resourceType === "video") return videoPosterUrl(media, { width });
  const url = imageUrl(media, { width, crop: "limit" });
  return url || null;
}
