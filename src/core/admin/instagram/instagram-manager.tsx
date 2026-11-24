"use client";

import { useState } from "react";
import { CircleAlert, CircleCheck, RefreshCw } from "lucide-react";
import { fetchInstagram } from "@/core/actions/instagram";
import type { InstagramFailReason, InstagramReview, InstagramSnapshot, InstagramStatus } from "@/core/instagram/types";
import { cn } from "../lib/cn";
import { useAction } from "../lib/use-action";
import { Button, focusRing } from "../ui/button";
import { PageHeader, Panel } from "../ui/misc";
import { ReviewTable } from "./review-table";
import { SetupGuide } from "./setup-guide";

const DISABLED_HINT_ID = "instagram-refresh-hint";

/** "Fetched from Instagram. 2 numbers changed, 1 note below." */
function summarize(snapshot: InstagramSnapshot, review: InstagramReview): string {
  const changed = review.rows.filter((r) => r.changed).length;
  const notes = snapshot.warnings.length;
  const parts = [changed === 0 ? "no numbers changed" : `${changed} ${changed === 1 ? "number" : "numbers"} changed`];
  if (review.additions.length) parts.push(`${review.additions.length} can be added`);
  if (notes) parts.push(`${notes} ${notes === 1 ? "note" : "notes"} below`);
  const text = parts.join(", ");
  return `Fetched from Instagram. ${text.charAt(0).toUpperCase()}${text.slice(1)}.`;
}

/**
 * Admin → Instagram. Nothing is fetched until the admin clicks Refresh, and
 * nothing is stored until she clicks Update website. The token is configured
 * only in Vercel (INSTAGRAM_ACCESS_TOKEN); this page never sees it.
 */
export function InstagramManager({ status, handle }: { status: InstagramStatus; handle: string }) {
  const [fetched, setFetched] = useState<{ snapshot: InstagramSnapshot; review: InstagramReview } | null>(null);
  const [error, setError] = useState<{ message: string; reason: InstagramFailReason | null } | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [guideOpen, setGuideOpen] = useState(false);
  const { run, isBusy } = useAction();
  const busy = isBusy("fetch");

  async function onRefresh() {
    setSummary(null);
    // The failure reason rides next to the ActionResult; run() returns only the result.
    const captured: { reason: InstagramFailReason | null } = { reason: null };
    // No router refresh: the page's server data didn't change.
    const result = await run(
      async () => {
        const res = await fetchInstagram();
        captured.reason = res.reason ?? null;
        return res;
      },
      { key: "fetch", refresh: false },
    );
    if (result.ok) {
      setError(null);
      setFetched(result.data);
      setSummary(summarize(result.data.snapshot, result.data.review));
    } else {
      setError({ message: result.error, reason: captured.reason });
      if (captured.reason) setGuideOpen(true);
    }
  }

  const description = "Get your current followers, posts and reel views from Instagram, check them, then update the numbers on your site.";

  if (!status.configured) {
    return (
      <>
        <PageHeader
          title="Instagram"
          description={description}
          actions={
            <>
              <span id={DISABLED_HINT_ID} className="text-xs text-(--a-ink-soft)">
                Add INSTAGRAM_ACCESS_TOKEN in Vercel to enable
              </span>
              <Button variant="primary" disabled aria-describedby={DISABLED_HINT_ID}>
                <RefreshCw aria-hidden />
                Refresh from Instagram
              </Button>
            </>
          }
        />
        <Panel
          title="Set up Instagram (one time, then every 60 days)"
          description="Uses Instagram's official API. It's free. Until this is set up, your site keeps the numbers typed in Page sections."
        >
          <SetupGuide handle={handle} />
        </Panel>
      </>
    );
  }

  const tokenProblem = error?.reason != null;

  return (
    <>
      <PageHeader
        title="Instagram"
        description={description}
        actions={
          <Button variant="primary" onClick={() => void onRefresh()} pending={busy}>
            {busy ? null : <RefreshCw aria-hidden />}
            Refresh from Instagram
          </Button>
        }
      />

      {error ? (
        <div role="alert" className="mb-5 flex items-start gap-2 rounded-md border border-(--a-warn-line) bg-(--a-warn-bg) px-3 py-2.5 text-sm text-(--a-ink)">
          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          <p>{error.message}</p>
        </div>
      ) : null}

      {!status.storageReady ? (
        <div role="status" className="mb-5 flex items-start gap-2 rounded-md border border-(--a-warn-line) bg-(--a-warn-bg) px-3 py-2.5 text-sm text-(--a-ink)">
          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          <p>Connect Supabase first: you can refresh, but Update website can&apos;t save in preview mode.</p>
        </div>
      ) : null}

      <div className="flex flex-col gap-6">
        {tokenProblem ? null : (
          <p className="flex items-start gap-2 text-sm text-(--a-ink-soft)">
            <CircleCheck className="mt-0.5 size-4 shrink-0 text-(--a-primary)" aria-hidden />
            <span>
              An Instagram token is set on the server. Refresh checks whether it still works. Tokens expire 60 days after
              they&apos;re generated; then generate a new one and replace{" "}
              <code className="rounded bg-(--a-muted) px-1 text-[0.85em] text-(--a-ink)">INSTAGRAM_ACCESS_TOKEN</code> in
              Vercel, then redeploy.
            </span>
          </p>
        )}

        {/* Always mounted (empty when idle) so screen readers announce the text when it appears. */}
        <p role="status" aria-live="polite" className="text-sm text-(--a-ink-soft) empty:hidden">
          {busy ? "Reading your profile and the views on each reel. This can take up to a minute." : summary}
        </p>

        {fetched ? (
          <ReviewTable
            snapshot={fetched.snapshot}
            review={fetched.review}
            onApplied={(review) => setFetched((prev) => (prev ? { ...prev, review } : prev))}
            disabled={!status.storageReady}
          />
        ) : (
          <Panel>
            <p className="py-4 text-center text-sm text-(--a-ink-soft)">
              Click <strong className="font-medium text-(--a-ink)">Refresh from Instagram</strong> to see your current numbers
              next to the ones on your site. Nothing changes on the site until you click Update website.
            </p>
          </Panel>
        )}

        <details
          open={guideOpen}
          onToggle={(e) => setGuideOpen(e.currentTarget.open)}
          className="rounded-lg border border-(--a-line) bg-(--a-surface) px-4 py-2"
        >
          <summary className={cn("flex min-h-11 cursor-pointer items-center rounded text-sm font-medium text-(--a-ink) sm:pointer-fine:min-h-8", focusRing)}>
            How to replace the token
          </summary>
          <div className="pt-2 pb-3">
            <SetupGuide handle={handle} />
          </div>
        </details>
      </div>
    </>
  );
}
