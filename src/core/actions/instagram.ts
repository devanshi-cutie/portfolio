"use server";

import { updateTag } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/core/auth/guard";
import { getSettings } from "@/core/data/admin";
import { CONTENT_TAG } from "@/core/data/tags";
import { PREVIEW_ERROR, dbFail, invalid } from "@/core/db/errors";
import { deleteConnection, getConnection, saveConnection } from "@/core/instagram/connection";
import { INSTAGRAM_DEFAULT_LABELS, buildReview, proposedValue } from "@/core/instagram/format";
import { InstagramApiError, friendlyInstagramError, getProfile, logInstagramError } from "@/core/instagram/graph";
import { InstagramNotConnectedError, expiryForNewToken, fetchInstagramSnapshot } from "@/core/instagram/snapshot";
import {
  INSTAGRAM_STAT_SOURCES,
  type InstagramApplySelection,
  type InstagramReview,
  type InstagramSnapshot,
  type InstagramStatSource,
} from "@/core/instagram/types";
import { normalizeSettings, statSchema } from "@/core/schemas/settings";
import { createSupabaseServiceClient, isSupabaseServiceConfigured } from "@/core/supabase/service";
import type { Stat } from "@/core/types/content";
import { fail, ok, type ActionResult } from "./result";

/*
 * Instagram connection + "fetch → review → apply". Every action checks the
 * admin session first. The token never leaves the server: actions return
 * usernames, numbers and dates only.
 */

const MAX_STATS = 20;
/** Only the Numbers list is validated on apply: unrelated (leniently stored) settings must not block it. */
const statsSchema = z.array(statSchema).max(MAX_STATS);

const tokenSchema = z
  .string()
  .trim()
  .min(20, "That doesn't look like an Instagram access token")
  .max(2048, "That token is too long")
  .regex(/^[A-Za-z0-9_\-.|]+$/, "Paste only the token, without spaces or quotes");

const sourceSchema = z.enum(INSTAGRAM_STAT_SOURCES as unknown as [InstagramStatSource, ...InstagramStatSource[]]);

const selectionSchema = z.object({
  update: z
    .array(z.object({ index: z.number().int().min(0).max(MAX_STATS - 1), source: sourceSchema }))
    .max(MAX_STATS),
  add: z.array(sourceSchema).max(INSTAGRAM_STAT_SOURCES.length),
});

/** Validates a pasted token with Instagram (GET /me) and stores it. Returns the username. */
export async function connectInstagram(token: string): Promise<ActionResult<{ username: string }>> {
  await requireAdmin();
  if (!isSupabaseServiceConfigured()) return fail(PREVIEW_ERROR);

  const parsed = tokenSchema.safeParse(token);
  if (!parsed.success) return invalid(parsed.error, parsed.error.issues[0]?.message ?? "Check the token");

  try {
    const profile = await getProfile(parsed.data);
    const { accessToken, expiresAt } = await expiryForNewToken(parsed.data);
    const previous = await getConnection().catch(() => null);
    const sameAccount = previous?.source === "admin" && previous.userId === profile.userId;
    const saved = await saveConnection({
      accessToken,
      userId: profile.userId,
      username: profile.username,
      tokenUpdatedAt: new Date().toISOString(),
      expiresAt,
      // Keep the last fetch when reconnecting the same account.
      lastSnapshot: sameAccount ? previous.lastSnapshot : undefined,
    });
    if (!saved.ok) return fail(saved.error);
    return ok({ username: profile.username });
  } catch (err) {
    logInstagramError("connect", err, parsed.data);
    return fail(friendlyInstagramError(err));
  }
}

/** Forgets the stored token and last fetch. Doesn't change any numbers on the site. */
export async function disconnectInstagram(): Promise<ActionResult> {
  await requireAdmin();
  if (!isSupabaseServiceConfigured()) return fail(PREVIEW_ERROR);
  const res = await deleteConnection();
  return res.ok ? ok(undefined) : fail(res.error);
}

/** Reads fresh numbers from Instagram (stored as the latest snapshot) and compares them with the site's Numbers. */
export async function fetchInstagram(): Promise<ActionResult<{ snapshot: InstagramSnapshot; review: InstagramReview }>> {
  await requireAdmin();
  if (!isSupabaseServiceConfigured()) return fail(PREVIEW_ERROR);

  let snapshot: InstagramSnapshot;
  try {
    snapshot = await fetchInstagramSnapshot();
  } catch (err) {
    if (err instanceof InstagramNotConnectedError) return fail("Connect Instagram first.");
    if (!(err instanceof InstagramApiError)) {
      console.error("[instagram] fetch failed:", err instanceof Error ? err.message : err);
      return fail("Could not fetch from Instagram. Please try again.");
    }
    return fail(friendlyInstagramError(err));
  }

  try {
    const settings = await getSettings();
    return ok({ snapshot, review: buildReview(settings.stats, snapshot) });
  } catch {
    return fail("Fetched from Instagram, but couldn't load the site's Numbers. Refresh the page.");
  }
}

/**
 * Writes the selected values into the site's Numbers. Values are recomputed
 * from the latest stored snapshot — the client only says which rows to apply.
 */
export async function applyInstagram(
  selection: InstagramApplySelection,
): Promise<ActionResult<{ stats: Stat[]; review: InstagramReview; updated: number }>> {
  await requireAdmin();
  if (!isSupabaseServiceConfigured()) return fail(PREVIEW_ERROR);

  const parsedSelection = selectionSchema.safeParse(selection);
  if (!parsedSelection.success) return invalid(parsedSelection.error, "That selection isn't valid. Fetch again.");
  const { update, add } = parsedSelection.data;
  if (update.length === 0 && add.length === 0) return fail("Tick at least one number to update.");

  let snapshot: InstagramSnapshot | undefined;
  try {
    snapshot = (await getConnection())?.lastSnapshot;
  } catch {
    return fail("Could not load the Instagram connection. Please try again.");
  }
  if (!snapshot) return fail("Fetch from Instagram first.");

  let settings: Awaited<ReturnType<typeof getSettings>>;
  try {
    settings = await getSettings();
  } catch {
    return fail("Could not load the site's Numbers. Please try again.");
  }
  const stats: Stat[] = settings.stats.map((s) => ({ ...s }));
  let updated = 0;

  for (const { index, source } of update) {
    const stat = stats[index];
    if (!stat || stat.source !== source) {
      return fail("Your Numbers changed since this fetch. Fetch again, then update.");
    }
    const value = proposedValue(snapshot, source, stat.value);
    if (value === null || value === stat.value) continue;
    stat.value = value;
    updated++;
  }

  for (const source of new Set(add)) {
    if (stats.some((s) => s.source === source)) continue;
    if (stats.length >= MAX_STATS) return fail(`The Numbers list is full (${MAX_STATS}). Remove one in Page sections first.`);
    const value = proposedValue(snapshot, source, "");
    if (value === null) continue;
    stats.push({ value, label: INSTAGRAM_DEFAULT_LABELS[source], source });
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

  return ok({ stats: next.stats, review: buildReview(next.stats, snapshot), updated });
}
