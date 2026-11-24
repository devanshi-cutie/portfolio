/*
 * Client-safe shapes for the Instagram integration. Nothing here carries the
 * access token: the token lives only in `public.integrations` and in server
 * memory while a request runs.
 */

import type { StatSource } from "@/core/types/content";

/** The stat sources whose values come from Instagram (stored, updated on approval). */
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
  followers: number;
  /** media_count: every post on the profile (photos, carousels, reels) */
  posts: number;
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

/** What the admin page knows about the connection. Never includes the token. */
export interface InstagramStatus {
  /** Supabase service role configured, so a connection can be stored */
  storageReady: boolean;
  connected: boolean;
  /** "admin": pasted in the admin panel; "env": INSTAGRAM_ACCESS_TOKEN */
  source: "admin" | "env" | null;
  username: string | null;
  /** ISO time the token stops working (estimated when Instagram didn't say) */
  expiresAt: string | null;
  tokenUpdatedAt: string | null;
  lastSnapshot: InstagramSnapshot | null;
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

/** What the admin ticked in the review table. Values are recomputed on the server. */
export interface InstagramApplySelection {
  update: { index: number; source: InstagramStatSource }[];
  add: InstagramStatSource[];
}
