import { z } from "zod";
import { MEDIA_KINDS } from "@/core/types/content";
import type { MediaEdits, MediaKind } from "@/core/types/content";
import type { MediaPatch } from "@/core/types/admin";
import { idSchema, optionalText } from "./common";

export const mediaKindSchema = z.enum(MEDIA_KINDS as unknown as [MediaKind, ...MediaKind[]]);

const pct = z.number().min(0).max(100);
const adjustment = z.number().min(-100).max(100);

/**
 * Non-destructive edits as submitted by the admin editor. Shape and ranges are
 * validated here; `normalizeEdits()` (src/core/lib/media-edits.ts) then clamps,
 * rounds and collapses all-default edits to null before storing.
 */
export const mediaEditsSchema = z
  .object({
    crop: z
      .object({ x: pct, y: pct, width: pct.gt(0), height: pct.gt(0) })
      .refine((c) => c.x + c.width <= 100.01 && c.y + c.height <= 100.01, "Crop must stay inside the frame")
      .nullable(),
    aspect: z.string().max(20).nullable(),
    rotation: z.number().min(-180).max(180),
    flipH: z.boolean(),
    flipV: z.boolean(),
    brightness: adjustment,
    contrast: adjustment,
    saturation: adjustment,
    trimStart: z.number().min(0).max(36000).nullable(),
    trimEnd: z.number().gt(0).max(36000).nullable(),
  })
  .refine((e) => e.trimStart === null || e.trimEnd === null || e.trimEnd > e.trimStart, {
    message: "Trim end must be after trim start",
    path: ["trimEnd"],
  }) satisfies z.ZodType<MediaEdits>;

/** Editable media fields; every key optional. */
export const mediaPatchSchema = z.object({
  kind: mediaKindSchema.optional(),
  title: optionalText(200).optional(),
  caption: optionalText(2000).optional(),
  alt: optionalText(500).optional(),
  collectionId: idSchema.nullable().optional(),
  brandId: idSchema.nullable().optional(),
  featured: z.boolean().optional(),
  published: z.boolean().optional(),
  posterOffset: z.number().min(0).max(36000).optional(),
  edits: mediaEditsSchema.nullable().optional(),
}) satisfies z.ZodType<MediaPatch>;

/** What the server accepts from a Cloudinary upload widget result. */
export const cloudinaryUploadSchema = z.object({
  public_id: z.string().trim().min(1).max(512),
  resource_type: z.enum(["image", "video", "raw"]),
  format: z.string().max(20).nullable(),
  width: z.number().int().nonnegative().nullable(),
  height: z.number().int().nonnegative().nullable(),
  duration: z.number().nonnegative().nullable().optional(),
  bytes: z.number().int().nonnegative().nullable(),
});
