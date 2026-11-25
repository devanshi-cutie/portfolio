import "server-only";

import { z } from "zod";
import type { VercelAnalyticsConfig } from "./config";
import type { AnalyticsDay, AnalyticsDimension, AnalyticsFailReason, BreakdownRow } from "./types";

/*
 * Minimal client for Vercel's Web Analytics query API. Every call has its own
 * timeout; failures become `VercelAnalyticsError` with a reason the admin UI
 * can explain. The token travels only in the Authorization header and is never
 * logged; error messages never include the URL or headers.
 *
 * GET https://api.vercel.com/v1/query/web-analytics/visits/aggregate
 *   ?projectId=…&by=…&since=YYYY-MM-DD&until=YYYY-MM-DD&limit=…[&teamId=…]
 */

const ENDPOINT = "https://api.vercel.com/v1/query/web-analytics/visits/aggregate";
const TIMEOUT_MS = 8000;
/** Max rows per breakdown request; the rest come back as an "Others" row. */
const BREAKDOWN_LIMIT = 50;
/** API maximum; a by=day query over the 30-day sync window fits. */
const DAILY_LIMIT = 100;
/** Longest stored breakdown value (matches the analytics_daily_breakdown check). */
const VALUE_MAX = 300;

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

export class VercelAnalyticsError extends Error {
  constructor(
    readonly reason: AnalyticsFailReason,
    message: string,
    /** HTTP status, when Vercel answered */
    readonly status?: number,
  ) {
    super(message);
    this.name = "VercelAnalyticsError";
  }
}

/** Plain-English message for a failure reason. */
export function analyticsReasonMessage(reason: AnalyticsFailReason): string {
  switch (reason) {
    case "not_configured":
      return "Vercel Analytics isn't connected yet. Add VERCEL_ANALYTICS_TOKEN and VERCEL_ANALYTICS_PROJECT_ID in Vercel, then redeploy.";
    case "token":
      return "Vercel rejected the analytics token. Create a new one and replace VERCEL_ANALYTICS_TOKEN in Vercel, then redeploy.";
    case "unavailable":
      return "Vercel's analytics API isn't available for this project yet (Web Analytics may be off, or the plan may not include API access).";
    case "rate_limited":
      return "Vercel is limiting requests right now. Try again in a few minutes.";
    case "network":
      return "Couldn't reach Vercel's analytics API. Please try again in a minute.";
    case "storage":
      return "Couldn't save the analytics numbers to the database. Please try again later.";
  }
}

/** Plain-English message for the admin. Never includes Vercel's raw response text. */
export function friendlyAnalyticsError(err: unknown): string {
  if (err instanceof VercelAnalyticsError) return analyticsReasonMessage(err.reason);
  return "Something went wrong syncing analytics. Please try again.";
}

function reasonForStatus(status: number): AnalyticsFailReason {
  if (status === 401 || status === 403) return "token";
  if (status === 429) return "rate_limited";
  // 404 ("Web Analytics not found"), other 4xx (bad query) and 5xx
  return "unavailable";
}

/** Vercel's short error code (e.g. "forbidden"), if it is a plain identifier. Never the message text. */
function errorCode(body: unknown): string {
  const code = (body as { error?: { code?: unknown } } | null)?.error?.code;
  return typeof code === "string" && /^[\w.-]{1,64}$/.test(code) ? code : "";
}

async function query(cfg: VercelAnalyticsConfig, params: Record<string, string>): Promise<unknown> {
  const url = new URL(ENDPOINT);
  url.searchParams.set("projectId", cfg.projectId);
  if (cfg.teamId) url.searchParams.set("teamId", cfg.teamId);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  let res: Response;
  try {
    res = await fetch(url, {
      headers: { Authorization: `Bearer ${cfg.token}`, Accept: "application/json" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
  } catch (err) {
    const name = err instanceof Error ? err.name : "";
    const timeout = name === "TimeoutError" || name === "AbortError";
    throw new VercelAnalyticsError("network", timeout ? "Request timed out" : "Network error");
  }

  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    // non-JSON body: handled below
  }

  if (!res.ok) {
    const code = errorCode(body);
    throw new VercelAnalyticsError(reasonForStatus(res.status), `HTTP ${res.status}${code ? ` ${code}` : ""}`, res.status);
  }
  if (body === null) throw new VercelAnalyticsError("unavailable", "Response was not JSON", res.status);
  return body;
}

/* ----------------------------------------------------------------- parsing */

/** A count Vercel may send as a number or numeric string; clamped to a non-negative integer. */
const count = z
  .union([z.number(), z.string().regex(/^\d+(\.\d+)?$/)])
  .transform((v) => Number(v))
  .refine((n) => Number.isFinite(n))
  .transform((n) => Math.max(0, Math.round(n)));

const rowSchema = z.looseObject({ pageviews: count, visitors: count });
const responseSchema = z.looseObject({ data: z.array(rowSchema) });

type Row = z.infer<typeof rowSchema>;

function parse(body: unknown): Row[] {
  const parsed = responseSchema.safeParse(body);
  if (!parsed.success) throw new VercelAnalyticsError("unavailable", "Unexpected response shape");
  return parsed.data.data;
}

function assertDay(day: string): void {
  if (!DAY_RE.test(day)) throw new RangeError(`Invalid day: ${day}`);
}

/** Vercel's `by` key for each dimension (also the row's value key). */
const VERCEL_DIMENSION: Record<AnalyticsDimension, string> = {
  path: "requestPath",
  referrer: "referrerHostname",
  country: "country",
  device: "deviceType",
  browser: "browserName",
};

const OTHER = "(other)";

// C0 and C1 control characters (includes \u0000, which Postgres text rejects).
const CONTROL_CHARS = /[\u0000-\u001F\u007F-\u009F]/g;

/** "Others"-style rows (the overflow bucket beyond `limit`), however Vercel flags them. */
function isOthersRow(row: Row, key: string): boolean {
  const v = row[key];
  if (typeof v === "string" && v.trim().toLowerCase() === "others") return true;
  if (!(key in row) || v === undefined) {
    return row.others === true || row.isOthers === true || row.isOther === true || row.other === true;
  }
  return false;
}

function cut(s: string, max: number): string {
  const chars = Array.from(s);
  return chars.length <= max ? s : chars.slice(0, max).join("");
}

/** The stored value: "(direct)" / "(unknown)" for empty, "(other)" for the overflow row. */
/** Lone surrogates become U+FFFD so the value always encodes as valid UTF-8 / jsonb. */
function wellFormed(s: string): string {
  const fn = (s as { toWellFormed?: () => string }).toWellFormed;
  if (typeof fn === "function") return fn.call(s);
  return s.replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, "�");
}

function dimensionValue(row: Row, dim: AnalyticsDimension): string {
  const key = VERCEL_DIMENSION[dim];
  if (isOthersRow(row, key)) return OTHER;
  const raw = row[key];
  const text = wellFormed(typeof raw === "string" ? raw : typeof raw === "number" ? String(raw) : "")
    .replace(CONTROL_CHARS, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (text === "") return dim === "referrer" ? "(direct)" : "(unknown)";
  return cut(text, VALUE_MAX);
}

/* --------------------------------------------------------------- endpoints */

/** Pageviews and (daily-unique) visitors per UTC day in [since, until], both inclusive. Days with no traffic may be absent. */
export async function fetchDailyTotals(cfg: VercelAnalyticsConfig, since: string, until: string): Promise<AnalyticsDay[]> {
  assertDay(since);
  assertDay(until);
  const rows = parse(await query(cfg, { by: "day", since, until, limit: String(DAILY_LIMIT) }));
  const byDay = new Map<string, AnalyticsDay>();
  for (const row of rows) {
    const ts = row.timestamp;
    const day = typeof ts === "string" ? ts.slice(0, 10) : "";
    if (!DAY_RE.test(day)) continue; // e.g. an overflow row without a timestamp
    const prev = byDay.get(day);
    if (prev) {
      prev.pageviews += row.pageviews;
      prev.visitors += row.visitors;
    } else {
      byDay.set(day, { day, pageviews: row.pageviews, visitors: row.visitors });
    }
  }
  return [...byDay.values()].sort((a, b) => a.day.localeCompare(b.day));
}

/** One UTC day's top values for a dimension, most pageviews first. */
export async function fetchDayBreakdown(cfg: VercelAnalyticsConfig, dim: AnalyticsDimension, day: string): Promise<BreakdownRow[]> {
  assertDay(day);
  const rows = parse(await query(cfg, { by: VERCEL_DIMENSION[dim], since: day, until: day, limit: String(BREAKDOWN_LIMIT) }));
  const merged = new Map<string, BreakdownRow>();
  for (const row of rows) {
    const value = dimensionValue(row, dim);
    const prev = merged.get(value);
    if (prev) {
      prev.pageviews += row.pageviews;
      prev.visitors += row.visitors;
    } else {
      merged.set(value, { value, pageviews: row.pageviews, visitors: row.visitors });
    }
  }
  return [...merged.values()].sort((a, b) => b.pageviews - a.pageviews || a.value.localeCompare(b.value));
}
