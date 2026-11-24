"use server";

import { updateTag } from "next/cache";
import { requireAdmin } from "@/core/auth/guard";
import { CONTENT_TAG } from "@/core/data/tags";
import { PREVIEW_ERROR, dbFail, invalid } from "@/core/db/errors";
import { normalizeSettings, siteSettingsSchema } from "@/core/schemas/settings";
import { createSupabaseServiceClient, isSupabaseServiceConfigured } from "@/core/supabase/service";
import type { SiteSettings } from "@/core/types/content";
import { fail, ok, type ActionResult } from "./result";

export async function updateSettings(input: SiteSettings): Promise<ActionResult<SiteSettings>> {
  await requireAdmin();
  if (!isSupabaseServiceConfigured()) return fail(PREVIEW_ERROR);

  const parsed = siteSettingsSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);

  // Normalizing guarantees every section key is present before it is stored.
  const settings = normalizeSettings(parsed.data);
  const supabase = createSupabaseServiceClient();
  const { error } = await supabase.from("site_settings").upsert({ id: 1, data: settings }, { onConflict: "id" });
  if (error) return dbFail(error, "save settings");

  updateTag(CONTENT_TAG);
  return ok(settings);
}

/**
 * Drops the cached public site content so the next visit reads fresh data —
 * e.g. after re-seeding or editing rows in the Supabase dashboard.
 */
export async function refreshSiteCache(): Promise<ActionResult> {
  await requireAdmin();
  if (!isSupabaseServiceConfigured()) return fail(PREVIEW_ERROR);

  updateTag(CONTENT_TAG);
  return ok(undefined);
}
