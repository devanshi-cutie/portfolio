"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { updateTag } from "next/cache";
import { requireAdmin } from "@/core/auth/guard";
import { isUnderRoot } from "@/core/cloudinary/paths";
import { destroyAsset } from "@/core/cloudinary/server";
import type { CloudinaryUploadResult } from "@/core/cloudinary/types";
import { MEDIA_COLUMNS, mapMedia, mediaPatchToRow, type MediaRow } from "@/core/data/mappers";
import { CONTENT_TAG } from "@/core/data/tags";
import { PREVIEW_ERROR, dbFail, invalid } from "@/core/db/errors";
import { nextSortOrder, reorderRows } from "@/core/db/reorder";
import { idListSchema, idSchema } from "@/core/schemas/common";
import { cloudinaryUploadSchema, mediaPatchSchema } from "@/core/schemas/media";
import { normalizeSettings } from "@/core/schemas/settings";
import { createSupabaseServiceClient, isSupabaseServiceConfigured } from "@/core/supabase/service";
import type { MediaPatch } from "@/core/types/admin";
import type { MediaItem, MediaKind, ResourceType } from "@/core/types/content";
import { fail, ok, type ActionResult } from "./result";

/**
 * requireAdmin() first (redirects without a valid session), then the service-role
 * client — or null when Supabase is not configured (read-only preview).
 */
async function adminClient(): Promise<SupabaseClient | null> {
  await requireAdmin();
  return isSupabaseServiceConfigured() ? createSupabaseServiceClient() : null;
}

type ValidUpload = {
  public_id: string;
  resource_type: ResourceType;
  format: string | null;
  width: number | null;
  height: number | null;
  duration: number | null;
  bytes: number | null;
};

function validateUpload(upload: CloudinaryUploadResult): ActionResult<ValidUpload> {
  const parsed = cloudinaryUploadSchema.safeParse(upload);
  if (!parsed.success) return invalid(parsed.error, "The upload response was not valid");
  const u = parsed.data;
  if (u.resource_type === "raw") return fail("Only images and videos can be added to the library");
  if (!isUnderRoot(u.public_id)) return fail("The file was uploaded outside this site's Cloudinary folder");
  return ok({
    public_id: u.public_id,
    resource_type: u.resource_type,
    format: u.format,
    width: u.width,
    height: u.height,
    duration: u.resource_type === "video" ? (u.duration ?? null) : null,
    bytes: u.bytes,
  });
}

/**
 * Writing `source_url` before migration 20261125000000 has run fails with
 * PostgREST "column not in schema cache" (PGRST204) or Postgres 42703.
 * Turn that into a message the admin can act on.
 */
function missingSourceUrlColumn(error: { code?: string; message: string }): ActionResult<never> | null {
  if ((error.code === "PGRST204" || error.code === "42703") && error.message.includes("source_url")) {
    const msg = "Links to original posts aren't available yet: the database update that adds them hasn't run. Clear the link to save the rest, or try again after the next deploy.";
    return fail(msg, { sourceUrl: [msg] });
  }
  return null;
}

function defaultKind(u: ValidUpload): MediaKind {
  if (u.resource_type === "image") return "photo";
  return u.width !== null && u.height !== null && u.height > u.width ? "reel" : "video";
}

/** Clears settings media slots (portrait, hero, OG image) that point at deleted media. */
async function clearSettingsRefs(supabase: SupabaseClient, ids: Set<string>): Promise<void> {
  const { data, error } = await supabase.from("site_settings").select("data").eq("id", 1).maybeSingle();
  if (error || !data) return;
  const settings = normalizeSettings(data.data);
  let changed = false;
  if (settings.identity.portraitMediaId && ids.has(settings.identity.portraitMediaId)) {
    settings.identity.portraitMediaId = null;
    changed = true;
  }
  if (settings.identity.heroMediaId && ids.has(settings.identity.heroMediaId)) {
    settings.identity.heroMediaId = null;
    changed = true;
  }
  if (settings.seo.ogImageMediaId && ids.has(settings.seo.ogImageMediaId)) {
    settings.seo.ogImageMediaId = null;
    changed = true;
  }
  if (!changed) return;
  const res = await supabase.from("site_settings").update({ data: settings }).eq("id", 1);
  if (res.error) console.error("[action] clear settings media refs failed:", res.error.message);
}

export async function createMediaFromUpload(
  upload: CloudinaryUploadResult,
  defaults?: MediaPatch,
): Promise<ActionResult<MediaItem>> {
  const supabase = await adminClient();
  if (!supabase) return fail(PREVIEW_ERROR);

  const valid = validateUpload(upload);
  if (!valid.ok) return valid;
  const patch = mediaPatchSchema.safeParse(defaults ?? {});
  if (!patch.success) return invalid(patch.error);

  const u = valid.data;
  const row = {
    ...u,
    kind: defaultKind(u),
    // A new upload starts unedited.
    ...mediaPatchToRow({ ...patch.data, edits: undefined }),
    sort_order: await nextSortOrder(supabase, "media"),
  };
  const { data, error } = await supabase.from("media").insert(row).select(MEDIA_COLUMNS).single();
  if (error) {
    if (error.code === "23505") return fail("That file is already in the library");
    return missingSourceUrlColumn(error) ?? dbFail(error, "add the media item");
  }

  updateTag(CONTENT_TAG);
  return ok(mapMedia(data as MediaRow));
}

export async function updateMedia(id: string, patch: MediaPatch): Promise<ActionResult<MediaItem>> {
  const supabase = await adminClient();
  if (!supabase) return fail(PREVIEW_ERROR);

  if (!idSchema.safeParse(id).success) return fail("Media not found");
  const parsed = mediaPatchSchema.safeParse(patch);
  if (!parsed.success) return invalid(parsed.error);

  const changes = mediaPatchToRow(parsed.data);
  const query =
    Object.keys(changes).length === 0
      ? supabase.from("media").select(MEDIA_COLUMNS).eq("id", id).maybeSingle()
      : supabase.from("media").update(changes).eq("id", id).select(MEDIA_COLUMNS).maybeSingle();
  const { data, error } = await query;
  if (error) return missingSourceUrlColumn(error) ?? dbFail(error, "update the media item");
  if (!data) return fail("Media not found");

  updateTag(CONTENT_TAG);
  return ok(mapMedia(data as MediaRow));
}

export async function bulkUpdateMedia(ids: string[], patch: MediaPatch): Promise<ActionResult<number>> {
  const supabase = await adminClient();
  if (!supabase) return fail(PREVIEW_ERROR);

  const parsedIds = idListSchema.safeParse(ids);
  if (!parsedIds.success) return invalid(parsedIds.error, "Select at least one item");
  const parsed = mediaPatchSchema.safeParse(patch);
  if (!parsed.success) return invalid(parsed.error);

  // Edits (per-file geometry) and the link to the original post are per item,
  // never applied in bulk.
  const changes = mediaPatchToRow({ ...parsed.data, edits: undefined, sourceUrl: undefined });
  if (Object.keys(changes).length === 0) return ok(0);

  const { data, error } = await supabase.from("media").update(changes).in("id", parsedIds.data).select("id");
  if (error) return dbFail(error, "update the selected items");

  updateTag(CONTENT_TAG);
  return ok(data?.length ?? 0);
}

/**
 * Swaps the Cloudinary asset behind a media row; keeps id, ordering and links,
 * resets `edits` to null. Destroys the old asset.
 */
export async function replaceMediaAsset(id: string, upload: CloudinaryUploadResult): Promise<ActionResult<MediaItem>> {
  const supabase = await adminClient();
  if (!supabase) return fail(PREVIEW_ERROR);

  if (!idSchema.safeParse(id).success) return fail("Media not found");
  const valid = validateUpload(upload);
  if (!valid.ok) return valid;

  const existing = await supabase.from("media").select("public_id, resource_type").eq("id", id).maybeSingle();
  if (existing.error) return dbFail(existing.error, "replace the file");
  if (!existing.data) return fail("Media not found");
  const old = existing.data as { public_id: string; resource_type: ResourceType };

  const { data, error } = await supabase
    .from("media")
    // New file = new geometry: drop crop/rotation/trim made for the old one.
    .update({ ...valid.data, edits: null })
    .eq("id", id)
    .select(MEDIA_COLUMNS)
    .maybeSingle();
  if (error) {
    if (error.code === "23505") return fail("That file is already used by another library item");
    return dbFail(error, "replace the file");
  }
  if (!data) return fail("Media not found");

  // The row already points at the new asset, so a failed destroy only leaves an orphan.
  if (old.public_id !== valid.data.public_id) {
    try {
      await destroyAsset(old.public_id, old.resource_type);
    } catch (err) {
      console.error("[action] replaceMediaAsset: could not destroy old asset", old.public_id, err);
    }
  }

  updateTag(CONTENT_TAG);
  return ok(mapMedia(data as MediaRow));
}

/**
 * Deletes the row, then the Cloudinary asset. Row first, so the site never
 * references a destroyed asset; a failed destroy is logged (orphaned asset).
 */
export async function deleteMedia(id: string): Promise<ActionResult> {
  const supabase = await adminClient();
  if (!supabase) return fail(PREVIEW_ERROR);
  if (!idSchema.safeParse(id).success) return fail("Media not found");

  const { data, error } = await supabase
    .from("media")
    .delete()
    .eq("id", id)
    .select("id, public_id, resource_type")
    .maybeSingle();
  if (error) return dbFail(error, "delete the media item");
  if (!data) return fail("Media not found");
  const row = data as { id: string; public_id: string; resource_type: ResourceType };

  try {
    await destroyAsset(row.public_id, row.resource_type);
  } catch (err) {
    console.error("[action] deleteMedia: row deleted but Cloudinary destroy failed", row.public_id, err);
  }
  await clearSettingsRefs(supabase, new Set([row.id]));

  updateTag(CONTENT_TAG);
  return ok(undefined);
}

export async function reorderMedia(ids: string[]): Promise<ActionResult> {
  const supabase = await adminClient();
  if (!supabase) return fail(PREVIEW_ERROR);

  const parsed = idListSchema.safeParse(ids);
  if (!parsed.success) return invalid(parsed.error, "Nothing to reorder");

  const { error, wrote } = await reorderRows(supabase, "media", parsed.data);
  // Partial writes still changed the public order: invalidate before reporting an error.
  if (wrote > 0) updateTag(CONTENT_TAG);
  if (error) return error.code === "NOT_FOUND" ? fail(error.message) : dbFail(error, "reorder media");

  return ok(undefined);
}
