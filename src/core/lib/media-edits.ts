/**
 * Non-destructive media edits: defaults, normalization and geometry helpers.
 * Client-safe (used by the admin editor and by the delivery URL builders).
 *
 * Geometry follows react-easy-crop: `crop` is a percentage rectangle of the
 * bounding box of the media AFTER flip + rotation (see `MediaEdits`).
 */
import type { MediaEdits } from "@/core/types/content";

export const DEFAULT_EDITS: MediaEdits = Object.freeze({
  crop: null,
  aspect: null,
  rotation: 0,
  flipH: false,
  flipV: false,
  brightness: 0,
  contrast: 0,
  saturation: 0,
  trimStart: null,
  trimEnd: null,
}) as MediaEdits;

/** Largest adjustment magnitude, and the lower bound Cloudinary accepts for brightness. */
const ADJUST_MIN = -100;
const ADJUST_MAX = 100;
const BRIGHTNESS_MIN = -99;

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const finite = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
const round = (n: number, places: number) => {
  const f = 10 ** places;
  return Math.round(n * f) / f;
};

/** True when the edits change nothing visible (`aspect` is a UI hint only). */
export function isDefaultEdits(e: MediaEdits | null | undefined): boolean {
  if (!e) return true;
  return (
    e.crop === null &&
    e.rotation === 0 &&
    !e.flipH &&
    !e.flipV &&
    e.brightness === 0 &&
    e.contrast === 0 &&
    e.saturation === 0 &&
    e.trimStart === null &&
    e.trimEnd === null
  );
}

/** Wraps any angle into -180..180 and rounds to whole degrees. */
function normalizeRotation(v: unknown): number {
  if (!finite(v)) return 0;
  let deg = Math.round(v) % 360;
  if (deg > 180) deg -= 360;
  if (deg < -180) deg += 360;
  return deg === -0 ? 0 : deg;
}

function normalizeCrop(v: unknown): MediaEdits["crop"] {
  if (!isObj(v) || !finite(v.x) || !finite(v.y) || !finite(v.width) || !finite(v.height)) return null;
  const x = round(clamp(v.x, 0, 100), 4);
  const y = round(clamp(v.y, 0, 100), 4);
  const width = round(clamp(v.width, 0, 100 - x), 4);
  const height = round(clamp(v.height, 0, 100 - y), 4);
  // Below 0.1% of the frame Cloudinary would round the crop to nothing.
  if (width < 0.1 || height < 0.1) return null;
  // A full-frame crop is no crop.
  if (x <= 0.01 && y <= 0.01 && width >= 99.99 && height >= 99.99) return null;
  return { x, y, width, height };
}

const adjustment = (v: unknown, min = ADJUST_MIN): number =>
  finite(v) ? clamp(Math.round(v), min, ADJUST_MAX) : 0;

/**
 * Validates and clamps stored/submitted edits. Never throws: garbage becomes
 * defaults. Returns `null` when the result changes nothing (show the original).
 */
export function normalizeEdits(raw: unknown): MediaEdits | null {
  if (!isObj(raw)) return null;

  let trimStart = finite(raw.trimStart) && raw.trimStart > 0 ? round(raw.trimStart, 2) : null;
  let trimEnd = finite(raw.trimEnd) && raw.trimEnd > 0 ? round(raw.trimEnd, 2) : null;
  if (trimStart !== null && trimEnd !== null && trimEnd <= trimStart) {
    trimStart = null;
    trimEnd = null;
  }

  const edits: MediaEdits = {
    crop: normalizeCrop(raw.crop),
    aspect: typeof raw.aspect === "string" && raw.aspect.length <= 20 ? raw.aspect : null,
    rotation: normalizeRotation(raw.rotation),
    flipH: raw.flipH === true,
    flipV: raw.flipV === true,
    brightness: adjustment(raw.brightness, BRIGHTNESS_MIN),
    contrast: adjustment(raw.contrast),
    saturation: adjustment(raw.saturation),
    trimStart,
    trimEnd,
  };
  return isDefaultEdits(edits) ? null : edits;
}

/** Bounding box of a w×h rectangle rotated by `deg` degrees. */
export function rotatedBox(width: number, height: number, deg: number): { width: number; height: number } {
  const rad = (deg * Math.PI) / 180;
  const cos = Math.abs(Math.cos(rad));
  const sin = Math.abs(Math.sin(rad));
  // Round away float noise (cos 90° ≈ 6e-17) before callers round to pixels.
  return {
    width: round(width * cos + height * sin, 6),
    height: round(width * sin + height * cos, 6),
  };
}

/**
 * The crop rectangle in pixels of the rotated bounding box, or null when there
 * is no crop or the original size is unknown. Always inside the box, ≥1px.
 */
export function cropPixels(
  edits: MediaEdits | null,
  width: number | null,
  height: number | null,
): { x: number; y: number; width: number; height: number } | null {
  if (!edits?.crop || !width || !height) return null;
  const box = rotatedBox(width, height, edits.rotation);
  const bw = Math.round(box.width);
  const bh = Math.round(box.height);
  const x = clamp(Math.round((edits.crop.x / 100) * box.width), 0, bw - 1);
  const y = clamp(Math.round((edits.crop.y / 100) * box.height), 0, bh - 1);
  const w = clamp(Math.round((edits.crop.width / 100) * box.width), 1, bw - x);
  const h = clamp(Math.round((edits.crop.height / 100) * box.height), 1, bh - y);
  return { x, y, width: w, height: h };
}
