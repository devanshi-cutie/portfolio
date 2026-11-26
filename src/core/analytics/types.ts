/*
 * Client-safe shapes for the admin Analytics tab. Nothing here carries the
 * Vercel token or reads env; server-only code lives in config/vercel/sync.
 */

import type { TrackEvent } from "@/core/lib/track-events";

export type { ClientTrackEvent, TrackEvent } from "@/core/lib/track-events";

export type AnalyticsDimension = "path" | "referrer" | "country" | "device" | "browser";

export const ANALYTICS_DIMENSIONS: readonly AnalyticsDimension[] = ["path", "referrer", "country", "device", "browser"] as const;

/** The admin page's view of the setup. */
export interface AnalyticsStatus {
  /** VERCEL_ANALYTICS_TOKEN and VERCEL_ANALYTICS_PROJECT_ID are set */
  configured: boolean;
  /** the Supabase service role is configured (sync can store data) */
  storageReady: boolean;
}

/** token: Vercel says the token itself is invalid; access: the token is valid but can't read this project (usually a missing team ID) */
export type AnalyticsFailReason = "not_configured" | "token" | "access" | "unavailable" | "rate_limited" | "network" | "storage";

export interface SyncResult {
  /** "partial": some data stored, the rest will sync next time */
  status: "synced" | "partial" | "skipped" | "error";
  reason?: AnalyticsFailReason;
  /** plain-English, safe to show the admin */
  message?: string;
  /** ISO timestamp of the newest stored sync, null when nothing has synced yet */
  lastSyncedAt: string | null;
  /** daily total rows written this run */
  daysUpdated: number;
  /** days whose full breakdown (all dimensions) was written this run */
  breakdownDaysUpdated: number;
}

export type AnalyticsRange = "7d" | "30d" | "90d" | "12m" | "all";

export const ANALYTICS_RANGES: readonly AnalyticsRange[] = ["7d", "30d", "90d", "12m", "all"] as const;

export const ANALYTICS_RANGE_LABELS: Record<AnalyticsRange, string> = {
  "7d": "Last 7 days",
  "30d": "Last 30 days",
  "90d": "Last 90 days",
  "12m": "Last 12 months",
  all: "All time",
};

export interface AnalyticsDay {
  /** UTC day, "YYYY-MM-DD" */
  day: string;
  pageviews: number;
  /** unique for that day only */
  visitors: number;
}

export interface BreakdownRow {
  value: string;
  pageviews: number;
  visitors: number;
}

export interface InteractionSummary {
  event: TrackEvent;
  label: string;
  total: number;
  topTargets: { target: string; label: string; count: number }[];
}

export interface AnalyticsOverview {
  range: AnalyticsRange;
  /** first UTC day of the range, null for "all" */
  since: string | null;
  until: string;
  /** one entry per UTC day in the range, zero-filled */
  daily: AnalyticsDay[];
  /** visitorsSum adds daily-unique visitors, so it overcounts people who came back */
  totals: { pageviews: number; visitorsSum: number };
  today: AnalyticsDay | null;
  breakdowns: Record<AnalyticsDimension, BreakdownRow[]>;
  interactions: InteractionSummary[];
  interactionsTotal: number;
  lastSyncedAt: string | null;
  /** oldest stored day, null when nothing is stored */
  firstDay: string | null;
}
