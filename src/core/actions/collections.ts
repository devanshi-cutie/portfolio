"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { updateTag } from "next/cache";
import { requireAdmin } from "@/core/auth/guard";
import { COLLECTION_COLUMNS, collectionInputToRow, mapCollection, type CollectionRow } from "@/core/data/mappers";
import { CONTENT_TAG } from "@/core/data/tags";
import { PREVIEW_ERROR, dbFail, invalid } from "@/core/db/errors";
import { nextSortOrder, reorderRows } from "@/core/db/reorder";
import { collectionInputSchema } from "@/core/schemas/collection";
import { idListSchema, idSchema } from "@/core/schemas/common";
import { createSupabaseServiceClient, isSupabaseServiceConfigured } from "@/core/supabase/service";
import type { CollectionInput } from "@/core/types/admin";
import type { Collection } from "@/core/types/content";
import { fail, ok, type ActionResult } from "./result";

/**
 * requireAdmin() first (redirects without a valid session), then the service-role
 * client — or null when Supabase is not configured (read-only preview).
 */
async function adminClient(): Promise<SupabaseClient | null> {
  await requireAdmin();
  return isSupabaseServiceConfigured() ? createSupabaseServiceClient() : null;
}

export async function createCollection(input: CollectionInput): Promise<ActionResult<Collection>> {
  const supabase = await adminClient();
  if (!supabase) return fail(PREVIEW_ERROR);

  const parsed = collectionInputSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);

  const row = { ...collectionInputToRow(parsed.data), sort_order: await nextSortOrder(supabase, "collections") };
  const { data, error } = await supabase.from("collections").insert(row).select(COLLECTION_COLUMNS).single();
  if (error) return dbFail(error, "create the collection", "slug");

  updateTag(CONTENT_TAG);
  return ok(mapCollection(data as CollectionRow));
}

export async function updateCollection(id: string, patch: Partial<CollectionInput>): Promise<ActionResult<Collection>> {
  const supabase = await adminClient();
  if (!supabase) return fail(PREVIEW_ERROR);

  if (!idSchema.safeParse(id).success) return fail("Collection not found");
  const parsed = collectionInputSchema.partial().safeParse(patch);
  if (!parsed.success) return invalid(parsed.error);

  const changes = collectionInputToRow(parsed.data);
  const query =
    Object.keys(changes).length === 0
      ? supabase.from("collections").select(COLLECTION_COLUMNS).eq("id", id).maybeSingle()
      : supabase.from("collections").update(changes).eq("id", id).select(COLLECTION_COLUMNS).maybeSingle();
  const { data, error } = await query;
  if (error) return dbFail(error, "update the collection", "slug");
  if (!data) return fail("Collection not found");

  updateTag(CONTENT_TAG);
  return ok(mapCollection(data as CollectionRow));
}

/** Media in the collection stay in the library, unassigned (FK `on delete set null`). */
export async function deleteCollection(id: string): Promise<ActionResult> {
  const supabase = await adminClient();
  if (!supabase) return fail(PREVIEW_ERROR);
  if (!idSchema.safeParse(id).success) return fail("Collection not found");

  const { data, error } = await supabase.from("collections").delete().eq("id", id).select("id");
  if (error) return dbFail(error, "delete the collection");
  if (!data?.length) return fail("Collection not found");

  updateTag(CONTENT_TAG);
  return ok(undefined);
}

export async function reorderCollections(ids: string[]): Promise<ActionResult> {
  const supabase = await adminClient();
  if (!supabase) return fail(PREVIEW_ERROR);

  const parsed = idListSchema.safeParse(ids);
  if (!parsed.success) return invalid(parsed.error, "Nothing to reorder");

  const { error, wrote } = await reorderRows(supabase, "collections", parsed.data);
  // Partial writes still changed the public order: invalidate before reporting an error.
  if (wrote > 0) updateTag(CONTENT_TAG);
  if (error) return error.code === "NOT_FOUND" ? fail(error.message) : dbFail(error, "reorder collections");

  return ok(undefined);
}
