"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { updateTag } from "next/cache";
import { requireAdmin } from "@/core/auth/guard";
import { destroyAsset } from "@/core/cloudinary/server";
import { BRAND_COLUMNS, brandInputToRow, mapBrand, type BrandRow } from "@/core/data/mappers";
import { CONTENT_TAG } from "@/core/data/tags";
import { PREVIEW_ERROR, dbFail, invalid } from "@/core/db/errors";
import { nextSortOrder, reorderRows } from "@/core/db/reorder";
import { brandInputSchema } from "@/core/schemas/brand";
import { idListSchema, idSchema } from "@/core/schemas/common";
import { createSupabaseServiceClient, isSupabaseServiceConfigured } from "@/core/supabase/service";
import type { BrandInput } from "@/core/types/admin";
import type { Brand, ResourceType } from "@/core/types/content";
import { fail, ok, type ActionResult } from "./result";

/**
 * requireAdmin() first (redirects without a valid session), then the service-role
 * client — or null when Supabase is not configured (read-only preview).
 */
async function adminClient(): Promise<SupabaseClient | null> {
  await requireAdmin();
  return isSupabaseServiceConfigured() ? createSupabaseServiceClient() : null;
}

export async function createBrand(input: BrandInput): Promise<ActionResult<Brand>> {
  const supabase = await adminClient();
  if (!supabase) return fail(PREVIEW_ERROR);

  const parsed = brandInputSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);

  const row = { ...brandInputToRow(parsed.data), sort_order: await nextSortOrder(supabase, "brands") };
  const { data, error } = await supabase.from("brands").insert(row).select(BRAND_COLUMNS).single();
  if (error) return dbFail(error, "create the brand", "slug");

  updateTag(CONTENT_TAG);
  return ok(mapBrand(data as BrandRow));
}

export async function updateBrand(id: string, patch: Partial<BrandInput>): Promise<ActionResult<Brand>> {
  const supabase = await adminClient();
  if (!supabase) return fail(PREVIEW_ERROR);

  if (!idSchema.safeParse(id).success) return fail("Brand not found");
  const parsed = brandInputSchema.partial().safeParse(patch);
  if (!parsed.success) return invalid(parsed.error);

  const changes = brandInputToRow(parsed.data);
  const query =
    Object.keys(changes).length === 0
      ? supabase.from("brands").select(BRAND_COLUMNS).eq("id", id).maybeSingle()
      : supabase.from("brands").update(changes).eq("id", id).select(BRAND_COLUMNS).maybeSingle();
  const { data, error } = await query;
  if (error) return dbFail(error, "update the brand", "slug");
  if (!data) return fail("Brand not found");

  updateTag(CONTENT_TAG);
  return ok(mapBrand(data as BrandRow));
}

/**
 * Deletes the brand (its media stay, unassigned). With `deleteLogo`, the logo's
 * media row and Cloudinary asset are deleted too.
 */
export async function deleteBrand(id: string, opts?: { deleteLogo?: boolean }): Promise<ActionResult> {
  const supabase = await adminClient();
  if (!supabase) return fail(PREVIEW_ERROR);
  if (!idSchema.safeParse(id).success) return fail("Brand not found");

  const { data, error } = await supabase.from("brands").delete().eq("id", id).select("logo_media_id").maybeSingle();
  if (error) return dbFail(error, "delete the brand");
  if (!data) return fail("Brand not found");

  const logoId = (data as { logo_media_id: string | null }).logo_media_id;
  if (opts?.deleteLogo === true && logoId) {
    const logo = await supabase
      .from("media")
      .delete()
      .eq("id", logoId)
      .select("public_id, resource_type")
      .maybeSingle();
    if (logo.error) {
      console.error("[action] deleteBrand: brand deleted but logo row was not:", logo.error.message);
    } else if (logo.data) {
      const row = logo.data as { public_id: string; resource_type: ResourceType };
      try {
        await destroyAsset(row.public_id, row.resource_type);
      } catch (err) {
        console.error("[action] deleteBrand: logo row deleted but Cloudinary destroy failed", row.public_id, err);
      }
    }
  }

  updateTag(CONTENT_TAG);
  return ok(undefined);
}

export async function reorderBrands(ids: string[]): Promise<ActionResult> {
  const supabase = await adminClient();
  if (!supabase) return fail(PREVIEW_ERROR);

  const parsed = idListSchema.safeParse(ids);
  if (!parsed.success) return invalid(parsed.error, "Nothing to reorder");

  const { error, wrote } = await reorderRows(supabase, "brands", parsed.data);
  // Partial writes still changed the public order: invalidate before reporting an error.
  if (wrote > 0) updateTag(CONTENT_TAG);
  if (error) return error.code === "NOT_FOUND" ? fail(error.message) : dbFail(error, "reorder brands");

  return ok(undefined);
}
