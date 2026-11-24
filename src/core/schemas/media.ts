import { z } from "zod";
import { MEDIA_KINDS } from "@/core/types/content";
import type { MediaKind } from "@/core/types/content";
import type { MediaPatch } from "@/core/types/admin";
import { idSchema, optionalText } from "./common";

export const mediaKindSchema = z.enum(MEDIA_KINDS as unknown as [MediaKind, ...MediaKind[]]);

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
