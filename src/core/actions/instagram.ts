"use server";

import { updateTag } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/core/auth/guard";
import { getSettings } from "@/core/data/admin";
import { CONTENT_TAG } from "@/core/data/tags";
import { PREVIEW_ERROR, dbFail, invalid } from "@/core/db/errors";
import { INSTAGRAM_DEFAULT_LABELS, buildReview, formatLike } from "@/core/instagram/format";
import { InstagramApiError, friendlyInstagramError, isPermissionError, isTokenError } from "@/core/instagram/graph";
import { InstagramNotConfiguredError, fetchInstagramSnapshot } from "@/core/instagram/snapshot";
import {
  INSTAGRAM_STAT_SOURCES,
  type InstagramApplySelection,
  type InstagramFailReason,
  type InstagramReview,
  type InstagramSnapshot,
  type InstagramStatSource,
} from "@/core/instagram/types";
import { normalizeSettings, statSchema } from "@/core/schemas/settings";
import { createSupabaseServiceClient, isSupabaseServiceConfigured } from "@/core/supabase/service";
import type { Stat } from "@/core/types/content";
import { fail, ok, type ActionResult } from "./result";

/*
 * Instagram "Refresh → review → Update website". Every action checks the admin
 * session first. The token (INSTAGRAM_ACCESS_TOKEN) never leaves the server and
 * nothing fetched is stored: Refresh returns numbers to the page, and Update
 * receives the ticked rows with those numbers back.
 */

const MAX_STATS = 20;
/** Only the Numbers list is validated on apply: unrelated (leniently stored) settings must not block it. */
const statsSchema = z.array(statSchema).max(MAX_STATS);

const sourceSchema = z.enum(INSTAGRAM_STAT_SOURCES as unknown as [InstagramStatSource, ...InstagramStatSource[]]);
/** A raw Instagram count: whole, non-negative, below a trillion. */
const metricSchema = z.number().int().min(0).max(1_000_000_000_000);

const selectionSchema = z.object({
  update: z
    .array(z.object({ index: z.number().int().min(0).max(MAX_STATS - 1), source: sourceSchema, value: metricSchema }))
    .max(MAX_STATS)
    .refine((list) => new Set(list.map((u) => u.index)).size === list.length, "Each number may appear once"),
  add: z
    .array(z.object({ source: sourceSchema, value: metricSchema }))
    .max(INSTAGRAM_STAT_SOURCES.length)
    .refine((list) => new Set(list.map((a) => a.source)).size === list.length, "Each metric may appear once"),
});

type FetchResult = ActionResult<{ snapshot: InstagramSnapshot; review: InstagramReview }> & {
  /** set when the fix is a new token in Vercel, so the page can show the setup steps */
  reason?: InstagramFailReason;
};

/** Reads fresh numbers from Instagram with the env token and compares them with the site's Numbers. Stores nothing. */
export async function fetchInstagram(): Promise<FetchResult> {
  await requireAdmin();

  let snapshot: InstagramSnapshot;
  try {
    snapshot = await fetchInstagramSnapshot();
  } catch (err) {
    if (err instanceof InstagramNotConfiguredError) {
      return fail("Instagram isn't set up: add INSTAGRAM_ACCESS_TOKEN in Vercel and redeploy.");
    }
    if (!(err instanceof InstagramApiError)) {
      console.error("[instagram] fetch failed:", err instanceof Error ? err.message : err);
      return fail("Could not fetch from Instagram. Please try again.");
    }
    const reason: InstagramFailReason | undefined = isTokenError(err) ? "token" : isPermissionError(err) ? "permission" : undefined;
    return { ...fail(friendlyInstagramError(err)), reason };
  }

  try {
    const settings = await getSettings();
    return ok({ snapshot, review: buildReview(settings.stats, snapshot) });
  } catch {
    return fail("Fetched from Instagram, but couldn't load the site's Numbers. Reload the page.");
  }
}

/**
 * Writes the ticked numbers into the site's Numbers. The raw counts come from
 * the page (nothing is stored between Refresh and Update); they are validated
 * here and formatted on the server. Only the signed-in admin can call this,
 * and she can type any number in Page sections anyway.
 */
export async function applyInstagram(selection: InstagramApplySelection): Promise<ActionResult<{ stats: Stat[]; updated: number }>> {
  await requireAdmin();
  if (!isSupabaseServiceConfigured()) return fail(PREVIEW_ERROR);

  const parsedSelection = selectionSchema.safeParse(selection);
  if (!parsedSelection.success) return invalid(parsedSelection.error, "That selection isn't valid. Refresh and try again.");
  const { update, add } = parsedSelection.data;
  if (update.length === 0 && add.length === 0) return fail("Tick at least one number to update.");

  let settings: Awaited<ReturnType<typeof getSettings>>;
  try {
    settings = await getSettings();
  } catch {
    return fail("Could not load the site's Numbers. Please try again.");
  }
  const stats: Stat[] = settings.stats.map((s) => ({ ...s }));
  let updated = 0;

  for (const { index, source, value } of update) {
    const stat = stats[index];
    if (!stat || stat.source !== source) {
      return fail("Your Numbers changed since this refresh. Refresh again, then update.");
    }
    const formatted = formatLike(value, stat.value);
    if (formatted === stat.value) continue;
    stat.value = formatted;
    updated++;
  }

  for (const { source, value } of add) {
    if (stats.some((s) => s.source === source)) continue;
    if (stats.length >= MAX_STATS) return fail(`The Numbers list is full (${MAX_STATS}). Remove one in Page sections first.`);
    stats.push({ value: formatLike(value, ""), label: INSTAGRAM_DEFAULT_LABELS[source], source });
    updated++;
  }

  const checked = statsSchema.safeParse(stats);
  if (!checked.success) return invalid(checked.error, "The updated Numbers didn't pass validation.");
  const next = normalizeSettings({ ...settings, stats: checked.data });

  if (updated > 0) {
    const { error } = await createSupabaseServiceClient()
      .from("site_settings")
      .upsert({ id: 1, data: next }, { onConflict: "id" });
    if (error) return dbFail(error, "update the numbers");
    updateTag(CONTENT_TAG);
  }

  return ok({ stats: next.stats, updated });
}
