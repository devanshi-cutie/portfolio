import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { requireAdmin } from "@/core/auth/guard";
import {
  ANALYTICS_DIMENSIONS,
  ANALYTICS_RANGES,
  type AnalyticsDay,
  type AnalyticsDimension,
  type AnalyticsOverview,
  type AnalyticsRange,
  type BreakdownRow,
  type InteractionSummary,
} from "@/core/analytics/types";
import { TRACK_EVENTS, TRACK_EVENT_LABELS, type TrackEvent } from "@/core/lib/track-events";
import { idSchema } from "@/core/schemas/common";
import { createSupabaseServiceClient, isSupabaseServiceConfigured } from "@/core/supabase/service";
import type { MediaKind } from "@/core/types/content";

/*
 * Admin read for the Analytics tab: uncached, service-role (bypasses RLS), so
 * `requireAdmin()` runs first and this must never be called from public code.
 * All days are UTC. Without the service-role config (preview) it returns an
 * empty overview.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
/** Rows per request; PostgREST returns at most 1000 by default. */
const PAGE_SIZE = 1000;
/** Safety stop for the "all" daily read (~55 years of days). */
const MAX_PAGES = 20;
const BREAKDOWN_LIMIT = 10;
const TOP_TARGETS = 5;
const OTHER = "(other)";

/** Days in each bounded range, today included. */
const RANGE_DAYS: Record<Exclude<AnalyticsRange, "all">, number> = { "7d": 7, "30d": 30, "90d": 90, "12m": 365 };

/** Events whose target is a media id. */
const MEDIA_EVENTS = new Set<TrackEvent>(["reel_open", "source_link"]);

const TARGET_LABELS: Record<string, string> = {
  // plain "instagram" kept for rows recorded before the per-placement targets
  instagram: "Instagram",
  "instagram-hero": "Instagram (hero)",
  "instagram-nav": "Instagram (top menu)",
  "instagram-footer": "Instagram (footer)",
  "instagram-contact": "Instagram (contact section)",
  "instagram-lightbox": "Instagram (video player)",
  youtube: "YouTube",
  tiktok: "TikTok",
  linkedin: "LinkedIn",
  facebook: "Facebook",
  pinterest: "Pinterest",
  threads: "Threads",
  snapchat: "Snapchat",
  twitter: "Twitter",
  x: "X",
  hero: "Hero button",
  nav: "Top menu",
  floating: "Floating button",
  contact: "Contact section",
  form: "Contact form",
};

const KIND_LABELS: Record<MediaKind, string> = {
  reel: "Reel",
  video: "Video",
  photo: "Photo",
  bts: "Behind the scenes",
  logo: "Logo",
  portrait: "Portrait",
  other: "Untitled",
};

const utcDay = (d: Date): string => d.toISOString().slice(0, 10);
const addDays = (day: string, n: number): string => utcDay(new Date(Date.parse(`${day}T00:00:00Z`) + n * DAY_MS));
const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const KNOWN_EVENTS = new Set<string>(TRACK_EVENTS);
const isTrackEvent = (v: string): v is TrackEvent => KNOWN_EVENTS.has(v);
const KNOWN_DIMENSIONS = new Set<string>(ANALYTICS_DIMENSIONS);
const isDimension = (v: string): v is AnalyticsDimension => KNOWN_DIMENSIONS.has(v);

function check<T>(res: { data: T | null; error: { code?: string; message: string } | null }, what: string): T | null {
  if (res.error) {
    console.error(`[analytics] load ${what} failed:`, res.error.code ?? "", res.error.message);
    throw new Error(`Could not load ${what}`);
  }
  return res.data;
}

/* ------------------------------------------------------------------ reads */

interface DailyRow {
  day: string;
  pageviews: number;
  visitors: number;
}

/** Daily totals in [since, until], paged so "all" is not cut at PostgREST's row cap. */
async function readDaily(db: SupabaseClient, since: string | null, until: string): Promise<DailyRow[]> {
  const out: DailyRow[] = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    let q = db.from("analytics_daily").select("day, pageviews, visitors").lte("day", until);
    if (since) q = q.gte("day", since);
    const from = page * PAGE_SIZE;
    const rows = (check(await q.order("day", { ascending: true }).range(from, from + PAGE_SIZE - 1), "daily totals") ?? []) as DailyRow[];
    out.push(...rows);
    if (rows.length < PAGE_SIZE) break;
  }
  return out;
}

async function readFirstDay(db: SupabaseClient): Promise<string | null> {
  const rows = check(await db.from("analytics_daily").select("day").order("day", { ascending: true }).limit(1), "first day") as
    | { day: string }[]
    | null;
  return rows?.[0]?.day ?? null;
}

async function readLastSyncedAt(db: SupabaseClient): Promise<string | null> {
  const rows = check(
    await db.from("analytics_daily").select("synced_at").order("synced_at", { ascending: false }).limit(1),
    "last sync",
  ) as { synced_at: string }[] | null;
  return rows?.[0]?.synced_at ?? null;
}

interface BreakdownRpcRow {
  dimension: string;
  value: string;
  pageviews: number | string;
  visitors: number | string;
}

async function readBreakdowns(db: SupabaseClient, since: string | null, until: string): Promise<BreakdownRpcRow[]> {
  const res = await db.rpc("analytics_breakdown", { p_since: since, p_until: until, p_limit: BREAKDOWN_LIMIT });
  return (check(res, "breakdowns") ?? []) as BreakdownRpcRow[];
}

interface InteractionRpcRow {
  event: string;
  target: string;
  count: number | string;
  event_total: number | string;
}

async function readInteractions(db: SupabaseClient, since: string | null, until: string): Promise<InteractionRpcRow[]> {
  const res = await db.rpc("analytics_interaction_summary", { p_since: since, p_until: until, p_limit: TOP_TARGETS });
  return (check(res, "interactions") ?? []) as InteractionRpcRow[];
}

/**
 * Titles for the media ids among the reel/source-link targets, in one query.
 * Returns null when the lookup fails (the page still loads, with generic labels).
 */
async function readMediaTitles(db: SupabaseClient, rows: InteractionRpcRow[]): Promise<Map<string, string> | null> {
  const ids = [
    ...new Set(
      rows
        .filter((r) => isTrackEvent(r.event) && MEDIA_EVENTS.has(r.event))
        .map((r) => r.target)
        .filter((t) => idSchema.safeParse(t).success),
    ),
  ];
  const titles = new Map<string, string>();
  if (ids.length === 0) return titles;
  const { data, error } = await db.from("media").select("id, title, kind").in("id", ids);
  if (error) {
    console.error("[analytics] load media titles failed:", error.code ?? "", error.message);
    return null;
  }
  for (const m of (data ?? []) as { id: string; title: string | null; kind: MediaKind | null }[]) {
    titles.set(m.id, m.title?.trim() || (m.kind ? KIND_LABELS[m.kind] : undefined) || "Untitled");
  }
  return titles;
}

/* ---------------------------------------------------------------- shaping */

function humanize(target: string): string {
  const words = target.replace(/[-_]+/g, " ").trim();
  return words ? words[0].toUpperCase() + words.slice(1) : "Unknown";
}

function targetLabel(event: TrackEvent, target: string, mediaTitles: Map<string, string> | null): string {
  if (MEDIA_EVENTS.has(event)) {
    if (!target) return "Unknown";
    if (!mediaTitles) return "Unknown item";
    return mediaTitles.get(target) ?? "Removed item";
  }
  return TARGET_LABELS[target.toLowerCase()] ?? humanize(target);
}

function zeroFilledDaily(rows: DailyRow[], start: string | null, until: string): AnalyticsDay[] {
  if (!start) return [];
  const byDay = new Map(rows.map((r) => [r.day, r]));
  const daily: AnalyticsDay[] = [];
  for (let d = start; d <= until; d = addDays(d, 1)) {
    const row = byDay.get(d);
    daily.push({ day: d, pageviews: num(row?.pageviews), visitors: num(row?.visitors) });
  }
  return daily;
}

function groupBreakdowns(rows: BreakdownRpcRow[]): Record<AnalyticsDimension, BreakdownRow[]> {
  const out = Object.fromEntries(ANALYTICS_DIMENSIONS.map((d) => [d, [] as BreakdownRow[]])) as Record<AnalyticsDimension, BreakdownRow[]>;
  for (const r of rows) {
    if (!isDimension(r.dimension)) continue;
    out[r.dimension].push({ value: r.value, pageviews: num(r.pageviews), visitors: num(r.visitors) });
  }
  for (const dim of ANALYTICS_DIMENSIONS) {
    // the overflow bucket always sorts last, whatever its size
    out[dim].sort(
      (a, b) =>
        Number(a.value === OTHER) - Number(b.value === OTHER) || b.pageviews - a.pageviews || a.value.localeCompare(b.value),
    );
  }
  return out;
}

function summarizeInteractions(rows: InteractionRpcRow[], mediaTitles: Map<string, string> | null): InteractionSummary[] {
  const byEvent = new Map<TrackEvent, InteractionSummary>();
  for (const r of rows) {
    if (!isTrackEvent(r.event)) continue;
    let summary = byEvent.get(r.event);
    if (!summary) {
      summary = { event: r.event, label: TRACK_EVENT_LABELS[r.event], total: num(r.event_total), topTargets: [] };
      byEvent.set(r.event, summary);
    }
    summary.topTargets.push({ target: r.target, label: targetLabel(r.event, r.target, mediaTitles), count: num(r.count) });
  }
  const order = (e: TrackEvent) => TRACK_EVENTS.indexOf(e);
  return [...byEvent.values()]
    .filter((s) => s.total > 0)
    .map((s) => ({ ...s, topTargets: s.topTargets.sort((a, b) => b.count - a.count || a.label.localeCompare(b.label)) }))
    .sort((a, b) => b.total - a.total || order(a.event) - order(b.event));
}

/* ----------------------------------------------------------------- public */

/**
 * Everything the Analytics tab shows for one range. Ranges end today (UTC)
 * inclusive; "12m" is the last 365 days; "all" has no lower bound and its
 * daily series starts at the oldest stored day. Only events with at least one
 * count are listed in `interactions`, busiest first.
 */
export async function getAnalyticsOverview(range: AnalyticsRange): Promise<AnalyticsOverview> {
  await requireAdmin();

  const r: AnalyticsRange = ANALYTICS_RANGES.includes(range) ? range : "30d";
  const until = utcDay(new Date());
  const since = r === "all" ? null : addDays(until, -(RANGE_DAYS[r] - 1));

  if (!isSupabaseServiceConfigured()) {
    return {
      range: r,
      since,
      until,
      daily: zeroFilledDaily([], since, until),
      totals: { pageviews: 0, visitorsSum: 0 },
      today: null,
      breakdowns: groupBreakdowns([]),
      interactions: [],
      interactionsTotal: 0,
      lastSyncedAt: null,
      firstDay: null,
    };
  }

  const db = createSupabaseServiceClient();
  const [rows, firstDay, lastSyncedAt, breakdownRows, interactionRows] = await Promise.all([
    readDaily(db, since, until),
    readFirstDay(db),
    readLastSyncedAt(db),
    readBreakdowns(db, since, until),
    readInteractions(db, since, until),
  ]);
  const mediaTitles = await readMediaTitles(db, interactionRows);

  const daily = zeroFilledDaily(rows, since ?? firstDay, until);
  const todayRow = rows.find((row) => row.day === until);
  const interactions = summarizeInteractions(interactionRows, mediaTitles);

  return {
    range: r,
    since,
    until,
    daily,
    totals: {
      pageviews: daily.reduce((sum, d) => sum + d.pageviews, 0),
      visitorsSum: daily.reduce((sum, d) => sum + d.visitors, 0),
    },
    today: todayRow ? { day: todayRow.day, pageviews: num(todayRow.pageviews), visitors: num(todayRow.visitors) } : null,
    breakdowns: groupBreakdowns(breakdownRows),
    interactions,
    // event_total covers every target, not just the top TOP_TARGETS returned per event
    interactionsTotal: interactions.reduce((sum, s) => sum + s.total, 0),
    lastSyncedAt,
    firstDay,
  };
}
