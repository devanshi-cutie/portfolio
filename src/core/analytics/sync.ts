import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseServiceClient, isSupabaseServiceConfigured } from "@/core/supabase/service";
import { vercelAnalyticsConfig, type VercelAnalyticsConfig } from "./config";
import {
  VercelAnalyticsError,
  analyticsReasonMessage,
  fetchDailyTotals,
  fetchDayBreakdown,
  friendlyAnalyticsError,
} from "./vercel";
import {
  ANALYTICS_DIMENSIONS,
  type AnalyticsDay,
  type AnalyticsDimension,
  type AnalyticsFailReason,
  type BreakdownRow,
  type SyncResult,
} from "./types";

/*
 * Copies Vercel Web Analytics numbers into Supabase so the admin keeps history
 * beyond Vercel's retention. Run by the daily cron and by the admin's
 * "Refresh from Vercel"; callers authorize (this file does no auth). Safe to repeat and
 * to run twice at once: daily totals are upserted, each (day, dimension)
 * breakdown is replaced atomically by analytics_replace_breakdown().
 *
 * Per run: one by=day request for the last WINDOW_DAYS UTC days, then the
 * five breakdowns for every day whose breakdown isn't final yet (newest
 * first). A day's breakdown is final once it was written more than an hour
 * after the day ended, so old days are never re-fetched.
 *
 * Stored history is never overwritten with nothing: days Vercel didn't return
 * (no traffic, or past its retention) only get a zero row if none exists yet,
 * an empty path breakdown for a day with traffic is not stored, and neither
 * that day nor a quiet day is finalized until it is QUIET_FINAL_DAYS old.
 */

/** UTC days covered by each run, today included. */
const WINDOW_DAYS = 30;
/** A run within this long after the last one is skipped unless forced. */
const MIN_INTERVAL_MS = 10 * 60 * 1000;
/** No new Vercel request starts after this; fits the routes' maxDuration = 60. */
const DEFAULT_BUDGET_MS = 40_000;
/** Parallel breakdown requests. */
const CONCURRENCY = 3;
/** Grace after a day ends before its numbers are treated as settled. */
const FINAL_GRACE_MS = 60 * 60 * 1000;
/** Full days after a quiet (no-traffic) day ends before it is finalized without any request. */
const QUIET_FINAL_DAYS = 2;
/** Breakdown storage failures after which the run stops starting requests (the database is likely down). */
const MAX_STORAGE_FAILURES = 3;
const DAY_MS = 24 * 60 * 60 * 1000;

const RATE_LIMITED_MESSAGE = "Vercel limited requests; the rest will sync next time.";
const STORAGE_PARTIAL_MESSAGE = "Some analytics couldn't be saved to the database; they will retry next time.";
const EMPTY_BREAKDOWN_MESSAGE = "Vercel returned no breakdown for some days; they will retry next time.";
const BUDGET_MESSAGE = "Ran out of time; the rest will sync next time.";

class StorageError extends Error {
  constructor(context: string, readonly code: string | undefined, message: string) {
    super(`${context}: ${message}`);
    this.name = "StorageError";
  }
}

const dayStart = (day: string): number => Date.parse(`${day}T00:00:00Z`);
const utcDay = (d: Date): string => d.toISOString().slice(0, 10);
const addDays = (day: string, n: number): string => utcDay(new Date(dayStart(day) + n * DAY_MS));

/** A day's breakdown is final when it was written after the day ended plus the grace period. */
function isBreakdownFinal(day: string, syncedAt: string | null): boolean {
  if (!syncedAt) return false;
  const t = Date.parse(syncedAt);
  return Number.isFinite(t) && t >= dayStart(day) + DAY_MS + FINAL_GRACE_MS;
}

function check<T>(context: string, res: { data: T; error: { code?: string; message: string } | null }): T {
  if (res.error) throw new StorageError(context, res.error.code, res.error.message);
  return res.data;
}

async function latestSyncedAt(db: SupabaseClient): Promise<string | null> {
  const rows = check(
    "read last sync",
    await db.from("analytics_daily").select("synced_at").order("synced_at", { ascending: false }).limit(1),
  ) as { synced_at: string }[] | null;
  return rows?.[0]?.synced_at ?? null;
}

function logFailure(context: string, err: unknown): void {
  if (err instanceof VercelAnalyticsError) {
    // message is "HTTP <status> [code]" or a fixed string: never the URL, headers or token
    console.error(`[analytics] ${context} failed:`, err.status ?? err.reason, err.message);
  } else if (err instanceof StorageError) {
    console.error(`[analytics] ${context} failed:`, err.code ?? "", err.message);
  } else {
    console.error(`[analytics] ${context} failed:`, "", err instanceof Error ? err.message : String(err));
  }
}

function errorResult(reason: AnalyticsFailReason, message: string, lastSyncedAt: string | null): SyncResult {
  return { status: "error", reason, message, lastSyncedAt, daysUpdated: 0, breakdownDaysUpdated: 0 };
}

/** Atomic delete + insert of one (day, dimension) in the database. */
async function replaceBreakdown(db: SupabaseClient, day: string, dim: AnalyticsDimension, rows: BreakdownRow[]): Promise<void> {
  check(
    "write breakdown",
    await db.rpc("analytics_replace_breakdown", {
      p_day: day,
      p_dimension: dim,
      p_rows: rows.map((r) => ({ value: r.value, pageviews: r.pageviews, visitors: r.visitors })),
    }),
  );
}

async function markBreakdownSynced(db: SupabaseClient, day: string, nowIso: string): Promise<void> {
  check("mark breakdown", await db.from("analytics_daily").update({ breakdown_synced_at: nowIso }).eq("day", day));
}

export async function runAnalyticsSync(opts: { force?: boolean; budgetMs?: number; now?: Date } = {}): Promise<SyncResult> {
  const cfg = vercelAnalyticsConfig();
  if (!cfg) return errorResult("not_configured", analyticsReasonMessage("not_configured"), null);
  if (!isSupabaseServiceConfigured()) return errorResult("storage", analyticsReasonMessage("storage"), null);

  const db = createSupabaseServiceClient();
  const now = opts.now ?? new Date();
  const deadline = Date.now() + Math.max(0, opts.budgetMs ?? DEFAULT_BUDGET_MS);

  let lastSyncedAt: string | null = null;
  try {
    lastSyncedAt = await latestSyncedAt(db);
  } catch (err) {
    logFailure("read last sync", err);
    return errorResult("storage", analyticsReasonMessage("storage"), null);
  }

  if (!opts.force && lastSyncedAt) {
    const age = now.getTime() - Date.parse(lastSyncedAt);
    if (Number.isFinite(age) && age >= 0 && age < MIN_INTERVAL_MS) {
      return { status: "skipped", lastSyncedAt, daysUpdated: 0, breakdownDaysUpdated: 0 };
    }
  }

  return syncWindow(db, cfg, now, deadline, lastSyncedAt);
}

interface DayState {
  pageviews: number;
  breakdownSyncedAt: string | null;
}

async function syncWindow(
  db: SupabaseClient,
  cfg: VercelAnalyticsConfig,
  now: Date,
  deadline: number,
  previousSyncedAt: string | null,
): Promise<SyncResult> {
  const nowIso = now.toISOString();
  const until = utcDay(now);
  const since = addDays(until, -(WINDOW_DAYS - 1));

  /* 1. daily totals: one request */
  let totals: AnalyticsDay[];
  try {
    totals = await fetchDailyTotals(cfg, since, until);
  } catch (err) {
    logFailure("daily totals", err);
    const reason = err instanceof VercelAnalyticsError ? err.reason : "network";
    return errorResult(reason, friendlyAnalyticsError(err), previousSyncedAt);
  }

  const returned = new Map(totals.filter((t) => t.day >= since && t.day <= until).map((t) => [t.day, t]));
  const days: string[] = [];
  for (let d = since; d <= until; d = addDays(d, 1)) days.push(d);
  const missing = days.filter((day) => !returned.has(day));

  let state: Map<string, DayState>;
  try {
    // Days Vercel returned are written as is. breakdown_synced_at isn't in the
    // payload, so the upsert leaves it alone.
    if (returned.size > 0) {
      const rows = [...returned.values()].map((t) => ({ day: t.day, pageviews: t.pageviews, visitors: t.visitors, synced_at: nowIso }));
      check("write daily totals", await db.from("analytics_daily").upsert(rows, { onConflict: "day" }));
    }
    // Missing days: a zero row only where nothing is stored (history is never zeroed),
    // and a fresh synced_at so the last-sync time stays honest.
    if (missing.length > 0) {
      const zeros = missing.map((day) => ({ day, pageviews: 0, visitors: 0, synced_at: nowIso }));
      check("write zero days", await db.from("analytics_daily").upsert(zeros, { onConflict: "day", ignoreDuplicates: true }));
      check("touch zero days", await db.from("analytics_daily").update({ synced_at: nowIso }).in("day", missing));
    }
    const stored = check(
      "read breakdown state",
      await db.from("analytics_daily").select("day, pageviews, breakdown_synced_at").gte("day", since).lte("day", until),
    ) as { day: string; pageviews: number; breakdown_synced_at: string | null }[] | null;
    state = new Map((stored ?? []).map((r) => [r.day, { pageviews: Number(r.pageviews) || 0, breakdownSyncedAt: r.breakdown_synced_at }]));
  } catch (err) {
    logFailure("daily totals", err);
    return errorResult("storage", analyticsReasonMessage("storage"), previousSyncedAt);
  }

  const pending = days.filter((day) => !isBreakdownFinal(day, state.get(day)?.breakdownSyncedAt ?? null)).reverse(); // newest first
  // Days with traffic per Vercel get the five breakdown requests.
  const busy = pending.filter((day) => (returned.get(day)?.pageviews ?? 0) > 0);

  let breakdownDaysUpdated = 0;
  let storageFailures = 0;
  let stopped = false;
  let fatalVercel: AnalyticsFailReason | null = null;
  let otherVercel: AnalyticsFailReason | null = null;
  let emptyBreakdown = false;
  let outOfTime = false;

  /*
   * 2. quiet days (no traffic per Vercel): no requests. Finalize only once the
   * day is QUIET_FINAL_DAYS old (a later run re-checks it before that), and
   * only if nothing is stored for it, so a day that dropped out of Vercel's
   * retention keeps whatever breakdown was stored earlier.
   */
  const quietFinalBefore = now.getTime() - (QUIET_FINAL_DAYS + 1) * DAY_MS;
  for (const day of pending) {
    if ((returned.get(day)?.pageviews ?? 0) > 0) continue;
    if (dayStart(day) > quietFinalBefore || (state.get(day)?.pageviews ?? 0) > 0) continue;
    try {
      await markBreakdownSynced(db, day, nowIso);
      breakdownDaysUpdated++;
    } catch (err) {
      logFailure(`finalize quiet day ${day}`, err);
      storageFailures++;
      if (storageFailures >= MAX_STORAGE_FAILURES) break;
    }
  }
  if (storageFailures >= MAX_STORAGE_FAILURES) stopped = true;

  /* 3. breakdowns for days with traffic */
  const jobs = busy.flatMap((day) => ANALYTICS_DIMENSIONS.map((dim) => ({ day, dim })));
  const doneDims = new Map<string, number>();
  /** recent days whose path breakdown came back empty although the day has traffic */
  const suspect = new Set<string>();
  let next = 0;

  const worker = async (): Promise<void> => {
    while (next < jobs.length && !stopped) {
      if (Date.now() > deadline) {
        outOfTime = true;
        return;
      }
      const { day, dim } = jobs[next++];
      let rows: BreakdownRow[];
      try {
        rows = await fetchDayBreakdown(cfg, dim, day);
      } catch (err) {
        logFailure(`breakdown ${day} ${dim}`, err);
        const reason = err instanceof VercelAnalyticsError ? err.reason : "network";
        if (reason === "rate_limited" || reason === "token" || reason === "access") {
          // stop starting requests; keep the first fatal reason
          fatalVercel ??= reason;
          stopped = true;
        } else {
          otherVercel ??= reason;
        }
        continue;
      }

      // Every pageview has a path, so an empty path breakdown on a day with
      // traffic means Vercel hasn't caught up (or answered oddly): keep what is
      // stored and don't finalize, unless the day is old enough that a retry
      // won't help. Other dimensions may legitimately be empty (e.g. a
      // direct-traffic-only day has no referrers) and are stored as empty.
      const emptyPath = dim === "path" && rows.reduce((sum, r) => sum + r.pageviews, 0) === 0;
      if (emptyPath && dayStart(day) > quietFinalBefore) {
        suspect.add(day);
        emptyBreakdown = true;
        continue;
      }

      try {
        if (!emptyPath) await replaceBreakdown(db, day, dim, rows);
        const done = (doneDims.get(day) ?? 0) + 1;
        doneDims.set(day, done);
        if (done === ANALYTICS_DIMENSIONS.length && !suspect.has(day)) {
          await markBreakdownSynced(db, day, nowIso);
          breakdownDaysUpdated++;
        }
      } catch (err) {
        // skip this job only; the day stays unfinalized and is retried next run
        logFailure(`store breakdown ${day} ${dim}`, err);
        storageFailures++;
        if (storageFailures >= MAX_STORAGE_FAILURES) stopped = true;
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, jobs.length) }, worker));

  const base = { lastSyncedAt: nowIso, daysUpdated: returned.size, breakdownDaysUpdated };
  // TS narrows closure-assigned lets to their initial values; widen them back.
  const fatal = fatalVercel as AnalyticsFailReason | null;
  const other = otherVercel as AnalyticsFailReason | null;

  // A storage failure always wins: it must never be reported as a rate limit.
  if (storageFailures > 0) return { status: "partial", reason: "storage", message: STORAGE_PARTIAL_MESSAGE, ...base };
  if (fatal === "rate_limited") return { status: "partial", reason: "rate_limited", message: RATE_LIMITED_MESSAGE, ...base };
  if (fatal) return { status: "partial", reason: fatal, message: analyticsReasonMessage(fatal), ...base };
  if (other) return { status: "partial", reason: other, message: analyticsReasonMessage(other), ...base };
  if (emptyBreakdown as boolean) return { status: "partial", message: EMPTY_BREAKDOWN_MESSAGE, ...base };
  if (outOfTime as boolean) return { status: "partial", message: BUDGET_MESSAGE, ...base };
  return { status: "synced", ...base };
}
