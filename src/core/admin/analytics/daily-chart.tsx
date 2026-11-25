"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import type { AnalyticsDay } from "@/core/analytics/types";
import { cn } from "../lib/cn";
import { focusRing } from "../ui/button";

/*
 * Formatting here is hand-rolled on purpose: Intl output (month names such as
 * "Sep"/"Sept", compact suffixes, grouping) can differ between Node's ICU and
 * the browser, which would break hydration. These helpers give the same text
 * on the server and in every browser.
 */

/** 12345 -> "12,345" (plain thousands grouping, no locale data). */
export function formatCount(n: number): string {
  const sign = n < 0 ? "-" : "";
  return sign + String(Math.round(Math.abs(n))).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/** Axis ticks: 950 -> "950", 1200 -> "1.2k", 3000000 -> "3M". */
function formatCompact(n: number): string {
  const short = (v: number, suffix: string) => `${Number.isInteger(v) ? v : v.toFixed(1).replace(/\.0$/, "")}${suffix}`;
  if (n >= 1_000_000) return short(n / 1_000_000, "M");
  if (n >= 1_000) return short(n / 1_000, "k");
  return String(n);
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

type DayStyle = "short" | "month" | "long" | "weekday";

/**
 * Formats a UTC calendar day ("YYYY-MM-DD"): short "25 Nov", month "Nov 2026",
 * long "25 Nov 2026", weekday "Wed, 25 Nov 2026". Never shifted by a time zone.
 */
export function formatDay(day: string, style: DayStyle = "long"): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (!match) return day;
  const [, y, m, d] = match;
  const month = MONTHS[Number(m) - 1];
  if (!month) return day;
  const date = Number(d);
  switch (style) {
    case "short":
      return `${date} ${month}`;
    case "month":
      return `${month} ${y}`;
    case "long":
      return `${date} ${month} ${y}`;
    case "weekday":
      return `${WEEKDAYS[new Date(Date.UTC(Number(y), Number(m) - 1, date)).getUTCDay()]}, ${date} ${month} ${y}`;
  }
}

/** Round axis ticks (0, step, 2·step, …) covering `max`, about four of them. */
function niceTicks(max: number): number[] {
  if (max <= 0) return [0];
  const rough = max / 4;
  const pow = 10 ** Math.floor(Math.log10(rough));
  const step = Math.max(1, [1, 2, 5, 10].map((m) => m * pow).find((s) => s >= rough) ?? 10 * pow);
  const top = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let v = 0; v <= top + step / 2; v += step) ticks.push(v);
  return ticks;
}

/** Up to 7 evenly spaced day indexes (an odd count, so every other one can hide on phones). */
function labelIndexes(n: number): number[] {
  if (n <= 6) return Array.from({ length: n }, (_, i) => i);
  const count = 7;
  return Array.from({ length: count }, (_, k) => Math.round((k * (n - 1)) / (count - 1)));
}

const BAR_FILL = "color-mix(in oklab, var(--a-primary) 55%, var(--a-surface))";
const BAR_FILL_ACTIVE = "var(--a-primary)";

const describeDay = (d: AnalyticsDay) =>
  `${formatDay(d.day, "weekday")}: ${formatCount(d.pageviews)} page views, ${formatCount(d.visitors)} visitors.`;

/**
 * Page views per day as bars, daily visitors as a line, on one count axis.
 * Hand-rolled SVG stretched to its box (preserveAspectRatio="none"), so it
 * fills any width without measuring; text sits in HTML so it never stretches.
 *
 * The plot is one focusable group: hover (mouse), tap (touch: tap the same
 * day again or anywhere outside to close) or arrow keys pick a day. The day's
 * numbers show in a tooltip and are read out by a polite live region. The full
 * series is also in a visually hidden table.
 */
export function DailyChart({ days }: { days: AnalyticsDay[] }) {
  const [active, setActive] = useState<number | null>(null);
  // The day last picked by keyboard, touch or pen. Only that day is read out:
  // mouse hover shows the tooltip but would flood the live region.
  const [spoken, setSpoken] = useState<number | null>(null);
  const plotRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ start: number; moved: boolean } | null>(null);
  const n = days.length;
  const activeDay = active != null ? (days[active] ?? null) : null;

  // A tap outside the plot closes a day picked by touch or pen.
  useEffect(() => {
    if (active == null) return;
    const onDown = (e: globalThis.PointerEvent) => {
      if (plotRef.current && !plotRef.current.contains(e.target as Node)) setActive(null);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [active]);

  if (n === 0) {
    return <p className="py-10 text-center text-sm text-(--a-ink-soft)">No days in this range yet.</p>;
  }

  const max = days.reduce((m, d) => Math.max(m, d.pageviews, d.visitors), 0);
  const ticks = niceTicks(max);
  const top = ticks[ticks.length - 1] || 1;
  const y = (v: number) => 100 - (v / top) * 100;
  const empty = max === 0;

  const gap = n <= 45 ? 0.2 : n <= 120 ? 0.12 : 0;
  /** One bar as a path segment; a non-zero day is at least 1% tall so it stays visible. */
  const bar = (i: number, v: number) => {
    if (v <= 0) return "";
    const h = Math.max((v / top) * 100, 1);
    return `M${i + gap} 100v${-h}h${1 - 2 * gap}v${h}z`;
  };
  const barsPath = days.map((d, i) => bar(i, d.pageviews)).join("");
  const activeBar = active != null && activeDay ? bar(active, activeDay.pageviews) : "";
  const linePoints = days.map((d, i) => `${i + 0.5},${y(d.visitors)}`).join(" ");

  const first = days[0].day;
  const last = days[n - 1].day;
  const totalViews = days.reduce((s, d) => s + d.pageviews, 0);
  const busiest = days.reduce((b, d) => (d.pageviews > b.pageviews ? d : b), days[0]);
  const summary = empty
    ? `Daily page views and visitors from ${formatDay(first)} to ${formatDay(last)}: no visits recorded.`
    : `Daily page views and visitors from ${formatDay(first)} to ${formatDay(last)}. ${formatCount(totalViews)} page views in total; the busiest day was ${formatDay(busiest.day)} with ${formatCount(busiest.pageviews)}.`;

  const labelStyle: DayStyle = n > 120 ? "month" : "short";
  const labels = labelIndexes(n);

  function indexAt(e: PointerEvent<HTMLDivElement>): number | null {
    const rect = e.currentTarget.getBoundingClientRect();
    if (rect.width <= 0) return null;
    const i = Math.floor(((e.clientX - rect.left) / rect.width) * n);
    return Math.min(n - 1, Math.max(0, i));
  }

  /** Keyboard, touch and pen selection: shown and announced. */
  function select(i: number | null) {
    setActive(i);
    setSpoken(i);
  }

  function onPointerMove(e: PointerEvent<HTMLDivElement>) {
    const i = indexAt(e);
    if (i == null) return;
    if (e.pointerType === "mouse") {
      // Visual only: the tooltip follows the cursor, the live region stays quiet.
      setActive(i);
      setSpoken(null);
      return;
    }
    // Touch/pen: scrub only once the finger has slid onto another day, so the
    // jitter of a tap doesn't undo the tap's open/close.
    const drag = dragRef.current;
    if (e.buttons === 0 || !drag) return;
    if (drag.moved || i !== drag.start) {
      drag.moved = true;
      select(i);
    }
  }

  function onPointerDown(e: PointerEvent<HTMLDivElement>) {
    if (e.pointerType === "mouse") return;
    const i = indexAt(e);
    if (i == null) return;
    dragRef.current = { start: i, moved: false };
    // A second tap on the same day closes it.
    select(active === i ? null : i);
  }

  function onPointerLeave(e: PointerEvent<HTMLDivElement>) {
    // Touch fires pointerleave right after the finger lifts; keep the tapped day.
    if (e.pointerType === "mouse") setActive(null);
  }

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    let next: number | null | undefined;
    switch (e.key) {
      case "ArrowRight":
        next = active == null ? 0 : Math.min(n - 1, active + 1);
        break;
      case "ArrowLeft":
        next = active == null ? n - 1 : Math.max(0, active - 1);
        break;
      case "Home":
        next = 0;
        break;
      case "End":
        next = n - 1;
        break;
      case "Escape":
        if (active == null) return;
        next = null;
        break;
      default:
        return;
    }
    e.preventDefault();
    select(next);
  }

  const activeLeft = active != null ? ((active + 0.5) / n) * 100 : 0;

  return (
    <figure className="flex min-w-0 flex-col gap-3">
      <figcaption className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-(--a-ink-soft)">
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="size-2.5 rounded-sm" style={{ background: BAR_FILL }} />
          Page views
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="h-0.5 w-3.5 rounded-full bg-(--a-ink)" />
          Visitors (per day)
        </span>
      </figcaption>

      <div className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] gap-x-2">
        {/* y axis */}
        <div aria-hidden className="relative h-44 min-w-6 text-right text-[11px] text-(--a-ink-soft) tabular-nums sm:h-56">
          {ticks.map((t) => (
            <span key={t} className="absolute right-0 translate-y-1/2 leading-none" style={{ bottom: `${(t / top) * 100}%` }}>
              {formatCompact(t)}
            </span>
          ))}
          {/* reserves the widest label's width */}
          <span className="invisible block leading-none">{formatCompact(top)}</span>
        </div>

        {/* plot */}
        <div
          ref={plotRef}
          role="group"
          aria-roledescription="chart"
          aria-label={`${summary} Use the left and right arrow keys to read each day.`}
          tabIndex={0}
          className={cn("relative h-44 touch-pan-y rounded-sm sm:h-56", focusRing)}
          onPointerMove={onPointerMove}
          onPointerDown={onPointerDown}
          onPointerLeave={onPointerLeave}
          onKeyDown={onKeyDown}
        >
          <svg
            className="absolute inset-0 size-full overflow-visible"
            viewBox={`0 0 ${n} 100`}
            preserveAspectRatio="none"
            aria-hidden
            focusable="false"
          >
            {ticks.map((t) => (
              <line
                key={t}
                x1={0}
                x2={n}
                y1={y(t)}
                y2={y(t)}
                stroke={t === 0 ? "var(--a-line-strong)" : "var(--a-line)"}
                strokeWidth={1}
                vectorEffect="non-scaling-stroke"
              />
            ))}
            {active != null ? <rect x={active} y={0} width={1} height={100} fill="var(--a-muted)" /> : null}
            <path d={barsPath} fill={BAR_FILL} />
            {activeBar ? <path d={activeBar} fill={BAR_FILL_ACTIVE} /> : null}
            {empty ? null : (
              <polyline
                points={linePoints}
                fill="none"
                stroke="var(--a-ink)"
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
            )}
          </svg>

          {/* Dots stay round because they are HTML, not stretched SVG. */}
          {!empty && n <= 14
            ? days.map((d, i) => (
                <span
                  key={d.day}
                  aria-hidden
                  className={cn(
                    "absolute size-2 -translate-x-1/2 translate-y-1/2 rounded-full bg-(--a-ink) ring-2 ring-(--a-surface)",
                    active === i && "size-2.5",
                  )}
                  style={{ left: `${((i + 0.5) / n) * 100}%`, bottom: `${(d.visitors / top) * 100}%` }}
                />
              ))
            : null}

          {empty ? (
            <p aria-hidden className="absolute inset-0 grid place-items-center px-4 text-center text-sm text-(--a-ink-soft)">
              No visits recorded in this range.
            </p>
          ) : null}

          {activeDay ? (
            <div
              aria-hidden
              className={cn(
                "pointer-events-none absolute top-0 z-10 w-max max-w-44 rounded-md bg-(--a-ink) px-2.5 py-1.5 text-xs leading-snug text-(--a-surface) shadow-md",
                activeLeft < 20 ? "translate-x-0" : activeLeft > 80 ? "-translate-x-full" : "-translate-x-1/2",
              )}
              style={{ left: `${activeLeft}%` }}
            >
              <p className="font-medium">{formatDay(activeDay.day, "weekday")}</p>
              <p className="tabular-nums">{formatCount(activeDay.pageviews)} page views</p>
              <p className="tabular-nums">{formatCount(activeDay.visitors)} visitors</p>
            </div>
          ) : null}
        </div>

        {/* x axis */}
        <div aria-hidden />
        <div aria-hidden className="relative mt-1.5 h-4 text-[11px] whitespace-nowrap text-(--a-ink-soft)">
          {labels.map((i, k) => {
            const isFirst = k === 0;
            const isLast = k === labels.length - 1;
            return (
              <span
                key={i}
                className={cn(
                  "absolute top-0 leading-none",
                  !isFirst && !isLast && "-translate-x-1/2",
                  labels.length >= 7 && k % 2 === 1 && "max-sm:hidden",
                )}
                style={isLast && n > 1 ? { right: 0 } : { left: isFirst ? 0 : `${((i + 0.5) / n) * 100}%` }}
              >
                {formatDay(days[i].day, labelStyle)}
              </span>
            );
          })}
        </div>
      </div>

      {/* Always mounted so the picked day is announced when it changes. */}
      <p aria-live="polite" className="sr-only">
        {activeDay && spoken === active ? describeDay(activeDay) : ""}
      </p>

      {/* sr-only goes on a wrapper: a <table> can't be clipped to 1px and would stretch the page. */}
      <div className="sr-only">
        <table>
          <caption>Page views and visitors per day</caption>
          <thead>
            <tr>
              <th scope="col">Day</th>
              <th scope="col">Page views</th>
              <th scope="col">Visitors</th>
            </tr>
          </thead>
          <tbody>
            {days.map((d) => (
              <tr key={d.day}>
                <th scope="row">{formatDay(d.day)}</th>
                <td>{formatCount(d.pageviews)}</td>
                <td>{formatCount(d.visitors)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  );
}
