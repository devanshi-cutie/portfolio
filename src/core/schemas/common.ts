import { z } from "zod";

/** Database ids are Postgres `gen_random_uuid()` values. */
export const idSchema = z.uuid();

/** A non-empty list of distinct ids (reorder / bulk operations). */
export const idListSchema = z
  .array(idSchema)
  .min(1)
  .max(2000)
  .refine((ids) => new Set(ids).size === ids.length, "Ids must be unique");

/** URL-safe slug, as produced by `slugify()`. */
export const slugSchema = z
  .string()
  .trim()
  .min(1, "Required")
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers and dashes");

/**
 * A link a visitor may click: empty, http(s), mailto:, tel: or a site-relative path.
 * Blocks `javascript:` and other script-capable schemes.
 */
export const linkSchema = z
  .string()
  .trim()
  .max(500)
  .refine(
    (v) => v === "" || /^(https?:\/\/|mailto:|tel:)/i.test(v) || (v.startsWith("/") && !v.startsWith("//")),
    "Must start with https://, mailto:, tel: or /",
  );

/** Optional website URL (http/https only). */
export const webUrlSchema = z
  .string()
  .trim()
  .max(500)
  .refine((v) => /^https?:\/\/[^\s]+$/i.test(v), "Must be an http(s) URL");

/** Nullable free text with a length cap. */
export const optionalText = (max: number) => z.string().trim().max(max).nullable();
