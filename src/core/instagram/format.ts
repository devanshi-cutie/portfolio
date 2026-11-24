/*
 * Pure helpers shared by the Instagram actions, the admin page and the public
 * data layer (site.* counts). No I/O and no secrets, so safe anywhere.
 */

import type { Stat } from "@/core/types/content";
import {
  INSTAGRAM_STAT_SOURCES,
  isInstagramSource,
  type InstagramReview,
  type InstagramSnapshot,
  type InstagramStatSource,
} from "./types";

/** Labels used when the admin adds a stat from the review table (first person, like the rest of the site). */
export const INSTAGRAM_DEFAULT_LABELS: Record<InstagramStatSource, string> = {
  "instagram.followers": "Instagram followers",
  "instagram.posts": "Posts on Instagram",
  "instagram.reelViews": "Views across my reels",
  "instagram.topReelViews": "Views on my top reel",
};

/** One decimal under 10 of a unit, whole units above; always rounded down so the site never overstates. */
function scaled(n: number, unit: number, suffix: string): string {
  const v = n / unit;
  if (v < 10) {
    const oneDecimal = Math.floor(v * 10) / 10;
    return `${Number.isInteger(oneDecimal) ? oneDecimal.toFixed(0) : oneDecimal.toFixed(1)}${suffix}`;
  }
  return `${Math.floor(v)}${suffix}`;
}

/**
 * Compact count the way the site writes numbers: 119 -> "119", 2632 -> "2.6K",
 * 231522 -> "231K", 1_234_567 -> "1.2M". Negative or non-finite input -> "0".
 */
export function formatCompact(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "0";
  const whole = Math.floor(n);
  if (whole < 1000) return String(whole);
  if (whole < 1_000_000) return scaled(whole, 1000, "K");
  if (whole < 1_000_000_000) return scaled(whole, 1_000_000, "M");
  return scaled(whole, 1_000_000_000, "B");
}

/** Formats `n` and keeps a trailing "+" when the value it replaces has one ("230K+" stays "…K+"). */
export function formatLike(n: number, current: string): string {
  const formatted = formatCompact(n);
  return current.trim().endsWith("+") ? `${formatted}+` : formatted;
}

/** The raw number behind an instagram.* source, or null when the snapshot doesn't have it. */
export function metricFor(snapshot: InstagramSnapshot, source: InstagramStatSource): number | null {
  switch (source) {
    case "instagram.followers":
      return snapshot.followers;
    case "instagram.posts":
      return snapshot.posts;
    case "instagram.reelViews":
      return snapshot.reelViews;
    case "instagram.topReelViews":
      return snapshot.topReelViews;
  }
}

/** Value to write for `source`, styled after `current`; null when the metric is missing. */
export function proposedValue(snapshot: InstagramSnapshot, source: InstagramStatSource, current: string): string | null {
  const n = metricFor(snapshot, source);
  return n === null ? null : formatLike(n, current);
}

/**
 * Compares the stored stats with a snapshot: one row per stat whose source is
 * instagram.*, plus "add" offers for metrics the site has no stat for.
 */
export function buildReview(stats: Stat[], snapshot: InstagramSnapshot): InstagramReview {
  const rows: InstagramReview["rows"] = [];
  const present = new Set<InstagramStatSource>();
  stats.forEach((stat, index) => {
    if (!isInstagramSource(stat.source)) return;
    present.add(stat.source);
    const proposed = proposedValue(snapshot, stat.source, stat.value);
    rows.push({
      index,
      label: stat.label,
      source: stat.source,
      current: stat.value,
      proposed,
      changed: proposed !== null && proposed !== stat.value,
    });
  });

  const additions: InstagramReview["additions"] = [];
  for (const source of INSTAGRAM_STAT_SOURCES) {
    if (present.has(source)) continue;
    const proposed = proposedValue(snapshot, source, "");
    if (proposed === null) continue;
    additions.push({ source, label: INSTAGRAM_DEFAULT_LABELS[source], proposed });
  }
  return { rows, additions };
}
