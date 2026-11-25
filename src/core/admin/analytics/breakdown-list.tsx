"use client";

import { useId, useState, useSyncExternalStore } from "react";
import type { AnalyticsDimension, BreakdownRow } from "@/core/analytics/types";
import { Button } from "../ui/button";
import { Panel } from "../ui/misc";
import { formatCount } from "./daily-chart";

/** Rows shown before "Show all". */
const VISIBLE = 8;

/** Placeholders the sync stores for empty and overflow values (src/core/analytics/vercel.ts). */
const SPECIAL: Record<string, string> = {
  "(direct)": "Direct or unknown",
  "(unknown)": "Unknown",
  "(other)": "Everything else",
};

/** True for "(direct)", "(unknown)" and "(other)". */
export const isPlaceholderValue = (value: string): boolean => Object.hasOwn(SPECIAL, value);

const noopSubscribe = () => () => {};

let regionNames: Intl.DisplayNames | null | undefined;
function regionName(code: string): string {
  if (regionNames === undefined) {
    try {
      regionNames = new Intl.DisplayNames(["en"], { type: "region" });
    } catch {
      regionNames = null;
    }
  }
  try {
    return regionNames?.of(code) ?? code;
  } catch {
    return code;
  }
}

/**
 * Readable label for a stored breakdown value ("Home (/)", placeholders, and
 * country names when `regions` is true). Country names come from the runtime's
 * ICU data, which can differ between Node and the browser, so the list asks
 * for them only after hydration and shows the code until then.
 */
export function breakdownLabel(dimension: AnalyticsDimension, value: string, regions = false): string {
  if (isPlaceholderValue(value)) return SPECIAL[value];
  switch (dimension) {
    case "country":
      return regions && /^[A-Za-z]{2}$/.test(value) ? regionName(value.toUpperCase()) : value;
    case "device":
      return value.charAt(0).toUpperCase() + value.slice(1);
    case "path":
      return value === "/" ? "Home (/)" : value;
    default:
      return value;
  }
}

/** "(other)" always goes last; everything else keeps the server's order (most views first). */
function ordered(rows: BreakdownRow[]): BreakdownRow[] {
  return [...rows.filter((r) => r.value !== "(other)"), ...rows.filter((r) => r.value === "(other)")];
}

/** One breakdown (pages, referrers, countries…) as labelled bars sized by page views. */
export function BreakdownList({
  title,
  description,
  dimension,
  rows,
  emptyText,
}: {
  title: string;
  description?: string;
  dimension: AnalyticsDimension;
  rows: BreakdownRow[];
  emptyText: string;
}) {
  const [showAll, setShowAll] = useState(false);
  const listId = useId();
  // false on the server and during hydration, true afterwards
  const mounted = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const all = ordered(rows);
  const visible = showAll ? all : all.slice(0, VISIBLE);
  const max = all.reduce((m, r) => Math.max(m, r.pageviews), 0) || 1;

  return (
    <Panel title={title} description={description} className="min-w-0">
      {all.length === 0 ? (
        <p className="py-6 text-center text-sm text-(--a-ink-soft)">{emptyText}</p>
      ) : (
        <>
          <div className="mb-2 flex justify-between text-[11px] font-medium tracking-wide text-(--a-ink-soft) uppercase" aria-hidden>
            <span>{dimension === "path" ? "Page" : dimension === "referrer" ? "Source" : "Name"}</span>
            <span>Page views</span>
          </div>
          <ol id={listId} className="flex flex-col gap-2.5">
            {visible.map((row) => {
              const label = breakdownLabel(dimension, row.value, mounted);
              const special = isPlaceholderValue(row.value);
              return (
                <li key={row.value} className="min-w-0">
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span
                      className={special ? "truncate text-(--a-ink-soft) italic" : "truncate text-(--a-ink)"}
                      title={label === row.value ? row.value : `${label} (${row.value})`}
                    >
                      {label}
                    </span>
                    <span className="shrink-0 tabular-nums text-(--a-ink)">
                      {formatCount(row.pageviews)}
                      <span className="sr-only"> page views</span>
                    </span>
                  </div>
                  <div aria-hidden className="mt-1 h-1.5 overflow-hidden rounded-full bg-(--a-muted)">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.max((row.pageviews / max) * 100, row.pageviews > 0 ? 1.5 : 0)}%`,
                        background: special
                          ? "var(--a-line-strong)"
                          : "color-mix(in oklab, var(--a-primary) 55%, var(--a-surface))",
                      }}
                    />
                  </div>
                </li>
              );
            })}
          </ol>
          {all.length > VISIBLE ? (
            <Button
              variant="ghost"
              size="sm"
              className="mt-3 -ml-3.5"
              aria-expanded={showAll}
              aria-controls={listId}
              onClick={() => setShowAll((v) => !v)}
            >
              {showAll ? "Show fewer" : `Show all ${all.length}`}
            </Button>
          ) : null}
        </>
      )}
    </Panel>
  );
}
