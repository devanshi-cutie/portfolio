"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, ExternalLink, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { applyInstagram } from "@/core/actions/instagram";
import { buildReview, metricFor } from "@/core/instagram/format";
import type { InstagramApplySelection, InstagramReview, InstagramSnapshot } from "@/core/instagram/types";
import { LocalDateTime } from "../inquiries/local-date";
import { cn } from "../lib/cn";
import { useAction } from "../lib/use-action";
import { Button, focusRing } from "../ui/button";
import { Panel } from "../ui/misc";

const rowKey = (index: number) => `u:${index}`;
const addKey = (source: string) => `a:${source}`;

/** Changed rows start ticked; "add" rows start unticked (adding changes the section's layout). */
function defaultSelection(review: InstagramReview): Set<string> {
  return new Set(review.rows.filter((r) => r.changed).map((r) => rowKey(r.index)));
}

const nf = new Intl.NumberFormat("en-IN");

function isInstagramUrl(url: string | null): url is string {
  return !!url && /^https:\/\/(www\.)?instagram\.com\//.test(url);
}

function Tick({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    // 44px hit area around a 20px box
    <label className={cn("relative grid size-11 place-items-center", disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer")}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        aria-label={label}
        className="peer size-5 cursor-pointer appearance-none rounded-md border-2 border-(--a-primary) bg-(--a-surface) transition-colors duration-100 checked:bg-(--a-primary) focus-visible:ring-2 focus-visible:ring-(--a-ring) focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed"
      />
      <Check
        aria-hidden
        strokeWidth={3}
        className="pointer-events-none absolute size-3.5 text-(--a-primary-ink) opacity-0 transition-opacity duration-100 peer-checked:opacity-100"
      />
    </label>
  );
}

/** Fetched numbers next to what the site shows; tick rows, then "Update website". */
export function ReviewTable({
  snapshot,
  review,
  onApplied,
  disabled,
}: {
  snapshot: InstagramSnapshot;
  review: InstagramReview;
  onApplied: (review: InstagramReview) => void;
  disabled?: boolean;
}) {
  const [selected, setSelected] = useState<Set<string>>(() => defaultSelection(review));
  const [seenReview, setSeenReview] = useState(review);
  // A new fetch or apply replaces the review: reset the ticks to its defaults.
  if (seenReview !== review) {
    setSeenReview(review);
    setSelected(defaultSelection(review));
  }
  const { run, isBusy } = useAction();

  const toggle = (key: string, on: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(key);
      else next.delete(key);
      return next;
    });

  // Ticked rows with the raw counts from this refresh; the server validates and formats them.
  const selection = useMemo<InstagramApplySelection>(() => {
    const update: InstagramApplySelection["update"] = [];
    for (const r of review.rows) {
      const value = metricFor(snapshot, r.source);
      if (selected.has(rowKey(r.index)) && value !== null) update.push({ index: r.index, source: r.source, value });
    }
    const add: InstagramApplySelection["add"] = [];
    for (const a of review.additions) {
      const value = metricFor(snapshot, a.source);
      if (selected.has(addKey(a.source)) && value !== null) add.push({ source: a.source, value });
    }
    return { update, add };
  }, [review, selected, snapshot]);
  const count = selection.update.length + selection.add.length;
  const hasRows = review.rows.length > 0 || review.additions.length > 0;

  async function apply() {
    const result = await run(() => applyInstagram(selection), { key: "apply" });
    if (!result.ok) return;
    onApplied(buildReview(result.data.stats, snapshot));
    if (result.data.updated > 0) {
      toast.success("Website updated with the new numbers", {
        description: "Reload any open Page sections tab before saving it, or it will put the old numbers back.",
      });
    } else {
      toast.info("Those numbers were already up to date");
    }
  }

  const facts = [
    { label: "Followers", value: snapshot.followers === null ? "Not available" : nf.format(snapshot.followers) },
    { label: "Posts", value: snapshot.posts === null ? "Not available" : nf.format(snapshot.posts) },
    { label: "Reels scanned", value: nf.format(snapshot.reels) },
    { label: "Reel views", value: snapshot.reelViews === null ? "Not available" : nf.format(snapshot.reelViews) },
    { label: "Top reel", value: snapshot.topReelViews === null ? "Not available" : nf.format(snapshot.topReelViews) },
  ];

  return (
    <Panel
      title="Review and update"
      description={
        <>
          From @{snapshot.username}, fetched <LocalDateTime iso={snapshot.fetchedAt} />. Nothing is saved until you click Update website. Instagram can take up to 48 hours to
          update view counts.
        </>
      }
    >
      <dl className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
        {facts.map((f) => (
          <div key={f.label} className="rounded-md border border-(--a-line) bg-(--a-muted)/40 px-3 py-2">
            <dt className="text-xs text-(--a-ink-soft)">{f.label}</dt>
            <dd className="text-sm font-semibold tabular-nums text-(--a-ink)">{f.value}</dd>
          </div>
        ))}
      </dl>

      {isInstagramUrl(snapshot.topReelPermalink) ? (
        <p className="-mt-2 mb-4 text-xs">
          <a
            href={snapshot.topReelPermalink}
            target="_blank"
            rel="noreferrer"
            className={cn("inline-flex min-h-11 items-center gap-1 rounded font-medium text-(--a-ink-soft) underline underline-offset-2 hover:text-(--a-ink) sm:pointer-fine:min-h-6", focusRing)}
          >
            Open the top reel on Instagram <ExternalLink className="size-3" aria-hidden />
            <span className="sr-only">(opens in a new tab)</span>
          </a>
        </p>
      ) : null}

      {snapshot.warnings.length ? (
        <div role="status" className="mb-4 flex gap-2 rounded-md border border-(--a-warn-line) bg-(--a-warn-bg) px-3 py-2.5 text-sm text-(--a-ink)">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          <ul className="flex flex-col gap-1">
            {snapshot.warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {!hasRows ? (
        <p className="rounded-lg border border-dashed border-(--a-line-strong) px-4 py-6 text-center text-sm text-(--a-ink-soft)">
          Nothing to compare yet. Set a number&apos;s Source to an Instagram metric in{" "}
          <Link href="/admin/sections" className={cn("rounded font-medium text-(--a-ink) underline underline-offset-2", focusRing)}>
            Page sections → Numbers
          </Link>
          .
        </p>
      ) : (
        <div className="-mx-4 overflow-x-auto px-4">
          <table className="w-full min-w-[30rem] border-collapse text-sm">
            <caption className="sr-only">Numbers on the website compared with Instagram</caption>
            <thead>
              <tr className="border-b border-(--a-line) text-left text-xs text-(--a-ink-soft)">
                <th scope="col" className="w-11 py-2 font-medium">
                  <span className="sr-only">Update</span>
                </th>
                <th scope="col" className="py-2 pr-3 font-medium">Stat</th>
                <th scope="col" className="py-2 pr-3 font-medium">On the website now</th>
                <th scope="col" className="py-2 font-medium">From Instagram</th>
              </tr>
            </thead>
            <tbody>
              {review.rows.map((r) => {
                const key = rowKey(r.index);
                return (
                  <tr key={key} className="border-b border-(--a-line) last:border-0">
                    <td className="py-0.5">
                      <Tick
                        checked={selected.has(key)}
                        onChange={(v) => toggle(key, v)}
                        label={`Update “${r.label || "Untitled"}”`}
                        disabled={disabled || r.proposed === null}
                      />
                    </td>
                    <th scope="row" className="py-2 pr-3 text-left font-medium text-(--a-ink)">
                      {r.label || <span className="text-(--a-ink-soft)">Untitled</span>}
                    </th>
                    <td className="py-2 pr-3 tabular-nums text-(--a-ink-soft)">{r.current || "—"}</td>
                    <td className="py-2 tabular-nums">
                      {r.proposed === null ? (
                        <span className="text-(--a-ink-soft)">Not available</span>
                      ) : (
                        <span className={cn("inline-flex items-center gap-1.5", r.changed ? "font-semibold text-(--a-ink)" : "text-(--a-ink-soft)")}>
                          {r.changed ? <ArrowRight className="size-3.5 text-(--a-primary)" aria-hidden /> : null}
                          {r.proposed}
                          {!r.changed ? <span className="text-xs font-normal">(same)</span> : null}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            {review.additions.length ? (
              <tbody>
                <tr>
                  <th colSpan={4} scope="rowgroup" className="pt-4 pb-1 text-left text-xs font-medium text-(--a-ink-soft)">
                    Not on your site yet: tick to add to Numbers
                  </th>
                </tr>
              {review.additions.map((a) => {
                const key = addKey(a.source);
                return (
                  <tr key={key} className="border-b border-(--a-line) last:border-0">
                    <td className="py-0.5">
                      <Tick checked={selected.has(key)} onChange={(v) => toggle(key, v)} label={`Add “${a.label}” to Numbers`} disabled={disabled} />
                    </td>
                    <th scope="row" className="py-2 pr-3 text-left font-medium text-(--a-ink)">
                      Add to Numbers: {a.label}
                    </th>
                    <td className="py-2 pr-3 text-(--a-ink-soft)">—</td>
                    <td className="py-2 font-semibold tabular-nums text-(--a-ink)">{a.proposed}</td>
                  </tr>
                );
              })}
              </tbody>
            ) : null}
          </table>
        </div>
      )}

      {hasRows ? (
        <div className="mt-4 flex flex-col-reverse gap-3 border-t border-(--a-line) pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-(--a-ink-soft)">
            {count === 0 ? "Nothing ticked." : `${count} ${count === 1 ? "number" : "numbers"} will change on the website.`} Labels and
            order are edited in{" "}
            <Link href="/admin/sections" className={cn("rounded font-medium text-(--a-ink) underline underline-offset-2", focusRing)}>
              Page sections → Numbers
            </Link>
            . Reload any open Page sections tab before saving it.
          </p>
          <Button variant="primary" onClick={() => void apply()} pending={isBusy("apply")} disabled={disabled || count === 0}>
            Update website
          </Button>
        </div>
      ) : null}
    </Panel>
  );
}
