import "server-only";

import { TRACK_EVENTS, sanitizeTarget, type TrackEvent } from "@/core/lib/track-events";
import { idSchema } from "@/core/schemas/common";
import { createSupabaseServiceClient, isSupabaseServiceConfigured } from "@/core/supabase/service";

/*
 * Counts first-party interactions (public.analytics_track). Called from public
 * code paths (/api/track, the contact form), so there is no auth here. Stores
 * only (day, event, target, count) — never an IP, user agent or anything else
 * about the visitor. Targets are restricted per event (a media id or a short
 * slug) so callers can't create unbounded new rows with arbitrary text.
 */

const KNOWN_EVENTS = new Set<string>(TRACK_EVENTS);

/** Events whose target is a media id (uuid) that must exist in public.media. */
const MEDIA_EVENTS = new Set<TrackEvent>(["reel_open", "source_link"]);

/** Every other event's target: a short lowercase slug ("instagram", "hero", "form"…). */
const SLUG = /^[a-z0-9_-]{1,32}$/;

/** The stored form of a target: sanitized and lowercased (uuids compare case-insensitively). */
export function normalizeTarget(target: string): string {
  return sanitizeTarget(target).toLowerCase();
}

/** Whether a normalized `target` has the right shape for `event` (no DB lookup). */
export function isValidTarget(event: TrackEvent, target: string): boolean {
  return MEDIA_EVENTS.has(event) ? idSchema.safeParse(target).success : SLUG.test(target);
}

/** Only the production deployment counts: previews and local runs against live Supabase don't. */
const countsHere = (): boolean => process.env.VERCEL_ENV === "production";

/**
 * Adds one to today's (UTC) count for `event` / `target`. Never throws: a
 * counter must not break a page or the contact form, so failures are logged
 * and dropped. A no-op outside production, without the Supabase service role,
 * for a malformed target, or for a media id that doesn't exist.
 */
export async function recordInteraction(event: TrackEvent, target: string): Promise<void> {
  if (!countsHere() || !isSupabaseServiceConfigured()) return;
  if (!KNOWN_EVENTS.has(event)) return;
  const clean = normalizeTarget(target);
  if (!isValidTarget(event, clean)) return;
  try {
    const db = createSupabaseServiceClient();
    if (MEDIA_EVENTS.has(event)) {
      // primary-key lookup: unknown ids are dropped so random uuids can't add rows
      const { data, error } = await db.from("media").select("id").eq("id", clean).maybeSingle();
      if (error) {
        console.error("[analytics] track media check failed:", error.code ?? "", error.message);
        return;
      }
      if (!data) return;
    }
    const { error } = await db.rpc("analytics_track", { p_event: event, p_target: clean });
    if (error) console.error("[analytics] track failed:", error.code ?? "", error.message);
  } catch (err) {
    console.error("[analytics] track failed:", "", err instanceof Error ? err.message : String(err));
  }
}
