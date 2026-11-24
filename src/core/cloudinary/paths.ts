import { cloudinaryFolder } from "@/core/config/env";

/** Prefix of media ids served from `/data` in preview mode. */
export const LOCAL_PREFIX = "local:";

export function isLocalPublicId(publicId: string): boolean {
  return publicId.startsWith(LOCAL_PREFIX);
}

/** `local:Jewellery/a b.mp4` -> `/api/dev-media/Jewellery/a%20b.mp4` (each segment encoded). */
export function localMediaUrl(publicId: string): string {
  const relative = publicId.slice(LOCAL_PREFIX.length);
  const encoded = relative
    .split("/")
    .filter((segment) => segment !== "")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  return `/api/dev-media/${encoded}`;
}

/**
 * True when `path` (a folder or public_id) is the creator's root folder or sits
 * inside it. Rejects traversal segments, backslashes and absolute paths.
 */
export function isUnderRoot(path: string, root: string = cloudinaryFolder()): boolean {
  if (typeof path !== "string" || path === "" || path.length > 512) return false;
  if (path.startsWith("/") || path.includes("\\") || path.includes("\0")) return false;
  const segments = path.split("/");
  if (segments.some((s) => s === "" || s === "." || s === "..")) return false;
  return path === root || path.startsWith(`${root}/`);
}
