"use client";

import { useState, useSyncExternalStore } from "react";
import { CircleAlert, CircleCheck, RefreshCw, Unplug } from "lucide-react";
import { disconnectInstagram, fetchInstagram } from "@/core/actions/instagram";
import type { InstagramReview, InstagramSnapshot, InstagramStatus } from "@/core/instagram/types";
import { LocalDateTime } from "../inquiries/local-date";
import { useAction } from "../lib/use-action";
import { cn } from "../lib/cn";
import { Button, focusRing } from "../ui/button";
import { ConfirmDialog } from "../ui/dialogs";
import { PageHeader, Panel } from "../ui/misc";
import { ConnectForm } from "./connect-form";
import { ReviewTable } from "./review-table";
import { SetupGuide } from "./setup-guide";

const DAY_MS = 24 * 60 * 60 * 1000;
const noopSubscribe = () => () => {};

/** Days until expiry, computed after hydration only (the server clock is not the viewer's). */
function useDaysLeft(expiresAt: string | null): number | null {
  const now = useSyncExternalStore(noopSubscribe, () => Math.floor(Date.now() / 60_000), () => null);
  if (!expiresAt || now === null) return null;
  const t = Date.parse(expiresAt);
  return Number.isNaN(t) ? null : Math.floor((t - now * 60_000) / DAY_MS);
}

export function InstagramManager({
  status,
  initialReview,
  handle,
}: {
  status: InstagramStatus;
  initialReview: InstagramReview | null;
  /** the site's Instagram handle (Profile), used in the setup guide */
  handle: string;
}) {
  const [fetched, setFetched] = useState<{ snapshot: InstagramSnapshot; review: InstagramReview } | null>(
    status.lastSnapshot && initialReview ? { snapshot: status.lastSnapshot, review: initialReview } : null,
  );
  const [confirmOpen, setConfirmOpen] = useState(false);
  const { run, isBusy } = useAction();
  const daysLeft = useDaysLeft(status.expiresAt);
  const expired = daysLeft !== null && daysLeft < 0;
  const locked = !status.storageReady;

  async function onFetch() {
    const result = await run(() => fetchInstagram(), { key: "fetch" });
    if (result.ok) setFetched(result.data);
  }

  async function onDisconnect() {
    const result = await run(() => disconnectInstagram(), { key: "disconnect", success: "Instagram disconnected" });
    if (!result.ok) return false;
    setFetched(null);
  }

  const description = "Fetch your latest followers, posts and reel views, check them, then update the numbers on your site.";

  if (!status.connected) {
    return (
      <>
        <PageHeader title="Instagram" description={description} />
        {locked ? <StorageNotice /> : null}
        <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
          <Panel title="Connect Instagram (one time)" description="Uses Instagram's official API. It's free.">
            <SetupGuide handle={handle} />
          </Panel>
          <Panel title="Paste your token">
            <ConnectForm disabled={locked} />
          </Panel>
        </div>
      </>
    );
  }

  const busyFetching = isBusy("fetch");

  return (
    <>
      <PageHeader
        title="Instagram"
        description={description}
        actions={
          <Button variant="primary" onClick={() => void onFetch()} pending={busyFetching} disabled={locked || expired}>
            {busyFetching ? null : <RefreshCw aria-hidden />}
            Fetch from Instagram
          </Button>
        }
      />
      {locked ? <StorageNotice /> : null}

      <div className="flex flex-col gap-6">
        <Panel
          title="Connection"
          actions={
            status.source === "admin" ? (
              <Button variant="danger-ghost" size="sm" onClick={() => setConfirmOpen(true)} disabled={locked}>
                <Unplug aria-hidden />
                Disconnect
              </Button>
            ) : null
          }
        >
          <div className="flex flex-col gap-3 text-sm">
            <p className="flex items-start gap-2 text-(--a-ink)">
              {expired ? (
                <CircleAlert className="mt-0.5 size-4 shrink-0 text-red-700" aria-hidden />
              ) : (
                <CircleCheck className="mt-0.5 size-4 shrink-0 text-(--a-primary)" aria-hidden />
              )}
              <span>
                {status.username ? (
                  <>
                    Connected as <strong className="font-semibold">@{status.username}</strong>
                  </>
                ) : (
                  <>Connected with the server&apos;s INSTAGRAM_ACCESS_TOKEN. Fetch once to check it.</>
                )}
                {expired ? null : <span className="text-(--a-ink-soft)"> · token renews automatically when you fetch</span>}
                {status.expiresAt ? (
                  <span className={expired ? "font-medium text-red-700" : "text-(--a-ink-soft)"}>
                    {" "}
                    · {expired ? "expired" : "expires"} <LocalDateTime iso={status.expiresAt} />
                  </span>
                ) : null}
              </span>
            </p>
            {status.source === "env" ? (
              <p className="text-xs text-(--a-ink-soft)">
                This token comes from the server environment. Pasting a token below replaces it here; remove the env variable in
                Vercel to stop using it entirely.
              </p>
            ) : null}
            {expired ? (
              <p role="alert" className="text-sm text-(--a-ink)">
                Instagram tokens can&apos;t be renewed after they expire. Generate a new token in the Meta app dashboard and
                connect again.
              </p>
            ) : daysLeft !== null && daysLeft <= 14 ? (
              <p className="text-sm text-(--a-ink)">
                The token expires in {daysLeft <= 0 ? "less than a day" : `${daysLeft} ${daysLeft === 1 ? "day" : "days"}`}. Fetch
                now to renew it for another 60 days.
              </p>
            ) : null}

            {expired ? (
              <ConnectForm submitLabel="Reconnect" disabled={locked} />
            ) : (
              <details className="text-(--a-ink-soft)">
                <summary className={cn("flex min-h-11 cursor-pointer items-center rounded text-sm font-medium text-(--a-ink) sm:pointer-fine:min-h-8", focusRing)}>
                  Use a different token
                </summary>
                <div className="pt-2">
                  <ConnectForm submitLabel="Replace token" disabled={locked} />
                </div>
              </details>
            )}
          </div>
        </Panel>

        {/* Always mounted (empty when idle) so screen readers announce the text when it appears. */}
        <p role="status" aria-live="polite" className="text-sm text-(--a-ink-soft) empty:hidden">
          {busyFetching ? "Reading your profile and the views on each reel. This can take up to a minute." : null}
        </p>

        {fetched ? (
          <ReviewTable
            snapshot={fetched.snapshot}
            review={fetched.review}
            onApplied={(review) => setFetched((prev) => (prev ? { ...prev, review } : prev))}
            disabled={locked}
          />
        ) : (
          <Panel>
            <p className="py-4 text-center text-sm text-(--a-ink-soft)">
              Click <strong className="font-medium text-(--a-ink)">Fetch from Instagram</strong> to see your current numbers
              next to the ones on your site. Nothing changes on the site until you click Update website.
            </p>
          </Panel>
        )}
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Disconnect Instagram?"
        description="The saved token and the last fetch are removed. The numbers already on your site stay as they are. You can connect again any time with a new token."
        confirmLabel="Disconnect"
        onConfirm={onDisconnect}
      />
    </>
  );
}

function StorageNotice() {
  return (
    <div role="status" className="mb-5 flex items-start gap-2 rounded-md border border-(--a-warn-line) bg-(--a-warn-bg) px-3 py-2.5 text-sm text-(--a-ink)">
      <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
      <p>Connect Supabase first: the Instagram connection is stored in the database, so it can&apos;t be saved in preview mode.</p>
    </div>
  );
}
