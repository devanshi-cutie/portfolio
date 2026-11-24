/*
 * Client-safe shapes for the Instagram integration. The access token lives only
 * in the INSTAGRAM_ACCESS_TOKEN env var and is read by server-only code; nothing
 * here carries it.
 */

import type { StatSource } from "@/core/types/content";

/** The stat sources whose values come from Instagram (stored in settings, updated on approval). */
export type InstagramStatSource = Extract<StatSource, `instagram.${string}`>;

export const INSTAGRAM_STAT_SOURCES: readonly InstagramStatSource[] = [
  "instagram.followers",
  "instagram.posts",
  "instagram.reelViews",
  "instagram.topReelViews",
] as const;

export function isInstagramSource(source: StatSource | undefined): source is InstagramStatSource {
  return source !== undefined && (INSTAGRAM_STAT_SOURCES as readonly string[]).includes(source);
}

/** Numbers read from Instagram in one fetch. Views are null when insights are unavailable. */
export interface InstagramSnapshot {
  username: string;
  /** null when Instagram didn't return it */
  followers: number | null;
  /** media_count: every post on the profile (photos, carousels, reels) */
  posts: number | null;
  /** reels found among the scanned media */
  reels: number;
  /** sum of `views` across the scanned reels that returned insights */
  reelViews: number | null;
  /** highest `views` on a single reel */
  topReelViews: number | null;
  topReelPermalink: string | null;
  /** reels whose views were counted (can be lower than `reels`) */
  reelsWithViews: number;
  /** media items scanned (capped) */
  mediaScanned: number;
  fetchedAt: string;
  /** plain-English notes for the admin, e.g. "views unavailable" */
  warnings: string[];
}

/** Why a refresh failed, when the fix is a new token in Vercel. */
export type InstagramFailReason = "token" | "permission";

/** What the admin page knows about the Instagram setup. Never includes the token or any part of it. */
export interface InstagramStatus {
  /** INSTAGRAM_ACCESS_TOKEN is set on the server */
  configured: boolean;
  /** Supabase service role configured, so "Update website" can save */
  storageReady: boolean;
}

/** One existing stat whose source is instagram.*: what the site shows vs what Instagram says. */
export interface InstagramReviewRow {
  index: number;
  label: string;
  source: InstagramStatSource;
  current: string;
  /** null when Instagram didn't return this metric (e.g. views without insights permission) */
  proposed: string | null;
  changed: boolean;
}

/** A metric the site has no stat for yet: offered as "Add to Numbers". */
export interface InstagramAdditionRow {
  source: InstagramStatSource;
  label: string;
  proposed: string;
}

export interface InstagramReview {
  rows: InstagramReviewRow[];
  additions: InstagramAdditionRow[];
}

/**
 * What the admin ticked in the review table, with the raw metric numbers from
 * the fetch (nothing is stored between Refresh and Update). The server
 * validates them and formats the display values itself.
 */
export interface InstagramApplySelection {
  update: { index: number; source: InstagramStatSource; value: number }[];
  add: { source: InstagramStatSource; value: number }[];
}
