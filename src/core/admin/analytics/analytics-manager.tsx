"use client";

import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ChartColumn, CircleAlert, Info, MousePointerClick, RefreshCw } from "lucide-react";
import { syncAnalytics } from "@/core/actions/analytics";
import {
  ANALYTICS_RANGE_LABELS,
  ANALYTICS_RANGES,
  type AnalyticsDimension,
  type AnalyticsFailReason,
  type AnalyticsOverview,
  type AnalyticsRange,
  type AnalyticsStatus,
  type InteractionSummary,
  type SyncResult,
} from "@/core/analytics/types";
import { LocalDateTime } from "../inquiries/local-date";
import { cn } from "../lib/cn";
import { pluralize } from "../lib/format";
import { useAction } from "../lib/use-action";
import { Button, focusRing } from "../ui/button";
import { Label, Select } from "../ui/field";
import { EmptyState, Panel } from "../ui/misc";
import { BreakdownList, breakdownLabel, isPlaceholderValue } from "./breakdown-list";
import { DailyChart, formatCount, formatDay } from "./daily-chart";
import { SetupGuide } from "./setup-guide";

const RANGE_ID = "analytics-range";
const DISABLED_HINT_ID = "analytics-refresh-hint";
const PREVIEW_NOTE_ID = "analytics-preview-note";

/** Failures the admin fixes in Vercel's settings, so the setup steps open with the message. */
const SETUP_REASONS: ReadonlySet<AnalyticsFailReason> = new Set(["token", "access", "unavailable", "not_configured"]);

const BREAKDOWNS: { dimension: AnalyticsDimension; title: string; empty: string }[] = [
  { dimension: "path", title: "Top pages", empty: "No page visits in this range." },
  { dimension: "referrer", title: "Where visitors come from", empty: "No referrers in this range." },
  { dimension: "country", title: "Countries", empty: "No countries in this range." },
  { dimension: "device", title: "Devices", empty: "No devices in this range." },
  { dimension: "browser", title: "Browsers", empty: "No browsers in this range." },
];

/**
 * Text for the live region after a manual Refresh. Null for an error: the
 * role="alert" box already announces it, so it isn't read twice.
 */
function describe(result: SyncResult): string | null {
  switch (result.status) {
    case "synced":
      return result.daysUpdated > 0
        ? `Synced with Vercel: ${pluralize(result.daysUpdated, "day")} updated.`
        : "Synced with Vercel. Everything was already up to date.";
    case "partial":
      return `Synced part of the data (${pluralize(result.daysUpdated, "day")} updated). ${partialText(result)}`;
    case "skipped":
      return "Already up to date.";
    case "error":
      return null;
  }
}

const partialText = (result: SyncResult) => result.message ?? "The rest will sync next time.";

/** What went wrong, if anything: "error" is a warning (role="alert"), "partial" is informational. */
type Notice = { kind: "error" | "partial"; message: string };

const later = (a: string | null, b: string | null) => (!a ? b : !b ? a : a > b ? a : b);

function Stat({ label, value, children, className }: { label: string; value: ReactNode; children?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex min-w-0 flex-col rounded-lg border border-(--a-line) bg-(--a-surface) p-4", className)}>
      <dt className="text-xs font-medium text-(--a-ink-soft)">{label}</dt>
      <dd className="mt-2 min-w-0 text-2xl font-semibold text-(--a-ink) tabular-nums">{value}</dd>
      {children ? <dd className="mt-0.5 text-xs text-(--a-ink-soft)">{children}</dd> : null}
    </div>
  );
}

function InteractionsTable({ rows }: { rows: InteractionSummary[] }) {
  return (
    <div className="-mx-4 overflow-x-auto px-4">
      <table className="w-full min-w-0 text-left text-sm">
        <thead className="text-xs text-(--a-ink-soft)">
          <tr className="border-b border-(--a-line)">
            <th scope="col" className="py-2 pr-3 font-medium">Interaction</th>
            <th scope="col" className="py-2 pr-3 text-right font-medium">Count</th>
            <th scope="col" className="py-2 font-medium">Most clicked</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-(--a-line)">
          {rows.map((row) => (
            <tr key={row.event} className="align-top">
              <th scope="row" className="py-2.5 pr-3 font-medium text-(--a-ink)">{row.label}</th>
              <td className="py-2.5 pr-3 text-right text-(--a-ink) tabular-nums">{formatCount(row.total)}</td>
              <td className="py-2.5 text-(--a-ink-soft)">
                {row.topTargets.length === 0 ? (
                  "—"
                ) : (
                  <ul className="flex flex-col gap-0.5">
                    {row.topTargets.map((t) => (
                      <li key={t.target} className="break-words">
                        {t.label || t.target || "Unnamed"}{" "}
                        <span className="tabular-nums">({formatCount(t.count)})</span>
                      </li>
                    ))}
                  </ul>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Admin → Analytics. Page views come from Vercel Web Analytics, copied into
 * Supabase by a daily cron and by the sync on this page; clicks are counted by
 * the site itself. The Vercel token lives only in Vercel's env vars.
 */
export function AnalyticsManager({ status, overview }: { status: AnalyticsStatus; overview: AnalyticsOverview }) {
  const router = useRouter();
  const pathname = usePathname() ?? "/admin/analytics";
  const { run, isBusy } = useAction();
  const [rangePending, startRange] = useTransition();
  const [refreshing, startRefresh] = useTransition();
  const [requestedRange, setRequestedRange] = useState<AnalyticsRange | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [syncedAt, setSyncedAt] = useState<string | null>(null);
  const [guideOpen, setGuideOpen] = useState(false);
  const autoSynced = useRef(false);

  const canSync = status.configured && status.storageReady;
  const autoBusy = isBusy("sync");
  const manualBusy = isBusy("refresh");

  /** Shared by the silent sync on load and the Refresh button. */
  function handleResult(result: SyncResult) {
    setSyncedAt(result.lastSyncedAt);
    if (result.status === "error") {
      setNotice({ kind: "error", message: result.message ?? "The sync didn't finish. Please try again." });
    } else if (result.status === "partial") {
      setNotice({ kind: "partial", message: `Some numbers synced. ${partialText(result)}` });
    } else {
      setNotice(null);
    }
    if (result.reason && SETUP_REASONS.has(result.reason)) setGuideOpen(true);
    // Only re-read the page when the sync stored something new.
    const stored = result.daysUpdated + result.breakdownDaysUpdated > 0;
    if ((result.status === "synced" || result.status === "partial") && stored) {
      startRefresh(() => router.refresh());
    }
  }

  // One silent sync per visit (the ref also absorbs React's dev double-run).
  // The server skips it when the last sync is recent.
  useEffect(() => {
    if (!canSync || autoSynced.current) return;
    autoSynced.current = true;
    void (async () => {
      // No toasts on load: a failure shows inline instead.
      const result = await run(() => syncAnalytics({ force: false }), { key: "sync", refresh: false, silentError: true });
      if (result.ok) handleResult(result.data);
      else setNotice({ kind: "error", message: result.error });
    })();
    // handleResult only reads setters and the router; running once is the point.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canSync, run]);

  async function onRefresh() {
    setSummary(null);
    setNotice(null);
    // The failure shows once, in the inline alert (no toast, no live-region copy).
    const result = await run(() => syncAnalytics({ force: true }), { key: "refresh", refresh: false, silentError: true });
    if (result.ok) {
      handleResult(result.data);
      setSummary(describe(result.data));
    } else {
      setNotice({ kind: "error", message: result.error });
    }
  }

  function onRangeChange(value: string) {
    const range = ANALYTICS_RANGES.find((r) => r === value);
    if (!range) return;
    setRequestedRange(range);
    startRange(() => router.replace(`${pathname}?range=${range}`, { scroll: false }));
  }

  const selectedRange = rangePending && requestedRange ? requestedRange : overview.range;
  const lastSyncedAt = later(syncedAt, overview.lastSyncedAt);
  const hasVisits = overview.firstDay !== null;
  const topPage = overview.breakdowns.path.find((r) => !isPlaceholderValue(r.value)) ?? null;
  const historyNote = overview.since && overview.firstDay && overview.firstDay > overview.since ? overview.firstDay : null;
  const showGuideInline = !status.configured;

  const liveText = manualBusy ? "Syncing with Vercel. This can take up to a minute." : summary;

  const syncLine = autoBusy
    ? "Checking Vercel for new numbers…"
    : refreshing
      ? "Updating the numbers…"
      : null;

  let visitsEmpty: { title: string; body: ReactNode } | null = null;
  if (!hasVisits) {
    if (!status.storageReady) {
      visitsEmpty = { title: "Nothing to show in preview mode", body: "Connect Supabase so visits can be stored and shown here." };
    } else if (!status.configured) {
      visitsEmpty = { title: "Visits aren't connected yet", body: "Follow the steps below to connect Vercel Web Analytics. Clicks are counted either way." };
    } else {
      visitsEmpty = {
        title: "No visits synced yet",
        body: autoBusy ? "The first sync is running now." : "Click Refresh to copy the last 30 days from Vercel.",
      };
    }
  }

  return (
    <div className="flex min-w-0 flex-col gap-6">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={RANGE_ID}>Range</Label>
          <Select
            id={RANGE_ID}
            value={selectedRange}
            onChange={(e) => onRangeChange(e.target.value)}
            aria-busy={rangePending || undefined}
            className="w-full sm:w-48"
          >
            {ANALYTICS_RANGES.map((r) => (
              <option key={r} value={r}>
                {ANALYTICS_RANGE_LABELS[r]}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex flex-col gap-1.5 sm:items-end">
          {status.configured ? (
            <Button
              variant="primary"
              onClick={() => void onRefresh()}
              pending={manualBusy}
              disabled={autoBusy || !status.storageReady}
              aria-describedby={status.storageReady ? undefined : PREVIEW_NOTE_ID}
              className="self-start sm:self-auto"
            >
              {manualBusy ? null : <RefreshCw aria-hidden />}
              Refresh from Vercel
            </Button>
          ) : (
            <Button variant="primary" disabled aria-describedby={DISABLED_HINT_ID} className="self-start sm:self-auto">
              <RefreshCw aria-hidden />
              Refresh from Vercel
            </Button>
          )}
          <p className="text-xs text-(--a-ink-soft)">
            {!status.configured ? (
              <span id={DISABLED_HINT_ID}>Connect Vercel Analytics to enable (steps below)</span>
            ) : (
              <>
                {lastSyncedAt ? (
                  <>
                    Last synced <LocalDateTime iso={lastSyncedAt} />
                  </>
                ) : (
                  "Not synced yet"
                )}
                {syncLine ? <span> · {syncLine}</span> : null}
              </>
            )}
          </p>
        </div>
      </div>

      {/* Always in the accessibility tree (never display:none) so the first message is announced too. */}
      <p role="status" aria-live="polite" className="sr-only">
        {liveText}
      </p>
      {liveText ? (
        <p aria-hidden className="-mt-3 text-sm text-(--a-ink-soft)">
          {liveText}
        </p>
      ) : null}

      {notice?.kind === "error" ? (
        <div role="alert" className="flex items-start gap-2 rounded-md border border-(--a-warn-line) bg-(--a-warn-bg) px-3 py-2.5 text-sm text-(--a-ink)">
          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          <p>{notice.message}</p>
        </div>
      ) : null}
      {/* Partial syncs are informational; after a manual Refresh the live region has already read them. */}
      {notice?.kind === "partial" && !summary ? (
        <div className="flex items-start gap-2 rounded-md border border-(--a-line) bg-(--a-muted)/60 px-3 py-2.5 text-sm text-(--a-ink-soft)">
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
          <p>{notice.message}</p>
        </div>
      ) : null}

      {!status.storageReady ? (
        <div className="flex items-start gap-2 rounded-md border border-(--a-warn-line) bg-(--a-warn-bg) px-3 py-2.5 text-sm text-(--a-ink)">
          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          <p id={PREVIEW_NOTE_ID}>Preview mode: Supabase isn&apos;t connected, so no visits or clicks are stored yet.</p>
        </div>
      ) : null}

      <div
        aria-busy={rangePending || undefined}
        className={cn("flex min-w-0 flex-col gap-6 transition-opacity duration-150", rangePending && "opacity-60")}
      >
        {historyNote ? (
          <p className="text-sm text-(--a-ink-soft)">
            History starts on {formatDay(historyNote)}. Numbers build up from the day analytics was set up; Vercel only
            shares the last 30 days.
          </p>
        ) : null}

        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <Stat label="Page views" value={hasVisits ? formatCount(overview.totals.pageviews) : "—"}>
            {ANALYTICS_RANGE_LABELS[overview.range]}
          </Stat>
          <Stat label="Visitors" value={hasVisits ? formatCount(overview.totals.visitorsSum) : "—"}>
            Counted per day: someone who visits on several days counts once per day.
          </Stat>
          <Stat
            label="Top page"
            className="col-span-2 sm:col-span-1"
            value={
              topPage ? (
                <span className="block truncate text-base" title={topPage.value}>
                  {breakdownLabel("path", topPage.value)}
                </span>
              ) : (
                "—"
              )
            }
          >
            {topPage ? `${formatCount(topPage.pageviews)} page views` : null}
          </Stat>
          <Stat label="Interactions" value={formatCount(overview.interactionsTotal)}>
            {ANALYTICS_RANGE_LABELS[overview.range]}. Clicks on links and buttons, plus contact form sends.
          </Stat>
          <Stat label="Today (UTC)" value={overview.today ? formatCount(overview.today.pageviews) : "—"}>
            {overview.today ? `page views · ${pluralize(overview.today.visitors, "visitor")}` : "No numbers for today yet"}
          </Stat>
        </dl>

        {visitsEmpty ? (
          <EmptyState icon={<ChartColumn />} title={visitsEmpty.title}>
            {visitsEmpty.body}
          </EmptyState>
        ) : (
          <>
            <Panel
              title="Visits per day"
              description="Days are UTC. Visitors are unique per day, so a returning visitor counts again on each day they visit."
            >
              <DailyChart days={overview.daily} />
            </Panel>

            <div className="grid min-w-0 gap-6 md:grid-cols-2 xl:grid-cols-3">
              {BREAKDOWNS.map((b) => (
                <BreakdownList
                  key={b.dimension}
                  title={b.title}
                  dimension={b.dimension}
                  rows={overview.breakdowns[b.dimension]}
                  emptyText={b.empty}
                />
              ))}
            </div>
          </>
        )}

        <Panel
          title="Interactions"
          description="Clicks and contact form sends, counted by the site itself, so this works without Vercel."
        >
          {overview.interactionsTotal === 0 || overview.interactions.length === 0 ? (
            <EmptyState icon={<MousePointerClick />} title="No interactions counted in this range">
              {status.storageReady
                ? "Reel opens, contact buttons, email and social links show up here once visitors use them."
                : "Connect Supabase so clicks can be stored."}
            </EmptyState>
          ) : (
            <InteractionsTable rows={overview.interactions} />
          )}
        </Panel>
      </div>

      {showGuideInline ? (
        <Panel
          title="Connect Vercel Web Analytics (one time)"
          description="Free on Vercel. Until it's connected, this page shows only the clicks your site counts."
        >
          <SetupGuide />
        </Panel>
      ) : (
        <details
          open={guideOpen}
          onToggle={(e) => setGuideOpen(e.currentTarget.open)}
          className="rounded-lg border border-(--a-line) bg-(--a-surface) px-4 py-2"
        >
          <summary className={cn("flex min-h-11 cursor-pointer items-center rounded text-sm font-medium text-(--a-ink) sm:pointer-fine:min-h-8", focusRing)}>
            How to connect or replace the Vercel token
          </summary>
          <div className="pt-2 pb-3">
            <SetupGuide />
          </div>
        </details>
      )}
    </div>
  );
}
