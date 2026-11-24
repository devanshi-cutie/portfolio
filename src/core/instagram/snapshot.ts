import "server-only";

import { instagramToken } from "./config";
import {
  InstagramApiError,
  getProfile,
  graphGet,
  graphGetUrl,
  isPermissionError,
  isRateLimitError,
  isTokenError,
  logInstagramError,
} from "./graph";
import type { InstagramSnapshot } from "./types";

/*
 * One "Refresh from Instagram", run only when the admin clicks it: read the
 * profile counts, page through recent media, read `views` for each reel.
 * Uses the INSTAGRAM_ACCESS_TOKEN env token as is (no renewal) and stores
 * nothing; the admin reviews the numbers and applies them separately.
 */

/** Media items scanned per fetch (newest first). */
const MEDIA_CAP = 200;
const PAGE_SIZE = 100;
/** Parallel insights requests. */
const CONCURRENCY = 6;
/**
 * One budget for the whole fetch (profile, media paging, insights). No new
 * Graph request starts after it; what finished is returned with a warning.
 * With the 8 s per-request timeout this stays well under the page's
 * `maxDuration = 60` (src/app/admin/(panel)/instagram/page.tsx).
 */
const FETCH_BUDGET_MS = 40_000;

/** INSTAGRAM_ACCESS_TOKEN is not set. */
export class InstagramNotConfiguredError extends Error {
  constructor() {
    super("INSTAGRAM_ACCESS_TOKEN is not set");
    this.name = "InstagramNotConfiguredError";
  }
}

interface MediaRow {
  id: string;
  mediaType: string;
  productType: string | null;
  permalink: string | null;
}

interface MediaPage {
  data?: { id?: unknown; media_type?: unknown; media_product_type?: unknown; permalink?: unknown }[];
  paging?: { next?: unknown };
}

interface MediaList {
  items: MediaRow[];
  /** why scanning stopped early: the item cap or the time budget */
  stopped: "cap" | "time" | null;
}

async function listMedia(token: string, withProductType: boolean, deadline: number): Promise<MediaList> {
  const fields = withProductType ? "id,media_type,media_product_type,permalink,timestamp" : "id,media_type,permalink,timestamp";
  const items: MediaRow[] = [];
  if (Date.now() > deadline) return { items, stopped: "time" };
  let page = await graphGet<MediaPage>("me/media", { fields, limit: String(PAGE_SIZE) }, token);
  for (;;) {
    for (const m of page.data ?? []) {
      if (typeof m.id !== "string") continue;
      items.push({
        id: m.id,
        mediaType: typeof m.media_type === "string" ? m.media_type : "",
        productType: typeof m.media_product_type === "string" ? m.media_product_type : null,
        permalink: typeof m.permalink === "string" ? m.permalink : null,
      });
      if (items.length >= MEDIA_CAP) return { items, stopped: "cap" };
    }
    const next = page.paging?.next;
    if (typeof next !== "string" || next === "" || (page.data ?? []).length === 0) return { items, stopped: null };
    if (Date.now() > deadline) return { items, stopped: "time" };
    page = await graphGetUrl<MediaPage>(next);
  }
}

interface InsightsBody {
  data?: { name?: unknown; values?: { value?: unknown }[]; total_value?: { value?: unknown } }[];
}

async function reelViews(token: string, mediaId: string): Promise<number | null> {
  const body = await graphGet<InsightsBody>(`${mediaId}/insights`, { metric: "views" }, token);
  const metric = (body.data ?? []).find((d) => d.name === "views") ?? body.data?.[0];
  const raw = metric?.values?.[0]?.value ?? metric?.total_value?.value;
  return typeof raw === "number" && Number.isFinite(raw) ? raw : null;
}

/** Runs `fn` over `items` with at most `limit` in flight; stops starting new work once `stop()` is true. */
async function pool<T>(items: T[], limit: number, fn: (item: T) => Promise<void>, stop: () => boolean): Promise<void> {
  let next = 0;
  const worker = async () => {
    while (next < items.length && !stop()) {
      const item = items[next++];
      await fn(item);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
}

/**
 * Fetches fresh numbers with the env token. Throws `InstagramNotConfiguredError`
 * or `InstagramApiError` (token, rate limit, network); missing insights
 * permission and running out of time are warnings, not failures.
 */
export async function fetchInstagramSnapshot(): Promise<InstagramSnapshot> {
  const deadline = Date.now() + FETCH_BUDGET_MS;
  const token = instagramToken();
  if (!token) throw new InstagramNotConfiguredError();

  try {
    const profile = await getProfile(token);

    const warnings: string[] = [];
    if (profile.followers === null || profile.posts === null) {
      warnings.push("Instagram didn't return the follower or post count this time, so it's shown as not available.");
    }
    let media: MediaList;
    let typeKnown = true;
    try {
      media = await listMedia(token, true, deadline);
    } catch (err) {
      // media_product_type is documented for Facebook Login; fall back if this API rejects the field.
      if (!(err instanceof InstagramApiError) || err.code !== 100) throw err;
      media = await listMedia(token, false, deadline);
      typeKnown = false;
    }
    if (media.stopped === "cap") {
      warnings.push(`Only the latest ${MEDIA_CAP} posts were scanned, so older reels aren't in the views total.`);
    } else if (media.stopped === "time") {
      warnings.push(
        `Instagram was slow, so only the latest ${media.items.length} posts were scanned before the time limit; older reels aren't in the views total. Refresh again later for a fuller count.`,
      );
    }

    // Every feed video on Instagram is a reel now; trust media_product_type when present.
    const reels = media.items.filter((m) => (typeKnown && m.productType ? m.productType === "REELS" : m.mediaType === "VIDEO"));

    // Mutable tally shared by the concurrent insights workers.
    const tally = {
      counted: 0,
      failed: 0,
      sum: 0,
      top: null as number | null,
      topLink: null as string | null,
      fatal: null as unknown,
      noPermission: false,
    };
    let reelViewsTotal: number | null = null;

    if (reels.length === 0) {
      warnings.push(
        media.stopped === "time" && media.items.length === 0
          ? "Instagram was too slow to list your posts in time, so reel views weren't calculated. Try again in a minute."
          : "No reels were found among the scanned posts, so reel views weren't calculated.",
      );
    } else if (Date.now() > deadline) {
      warnings.push("Ran out of time before reading reel views; followers and posts are up to date. Refresh again for views.");
    } else {
      const one = async (reel: MediaRow) => {
        try {
          const views = await reelViews(token, reel.id);
          if (views === null) {
            tally.failed++;
            return;
          }
          tally.counted++;
          tally.sum += views;
          if (tally.top === null || views > tally.top) {
            tally.top = views;
            tally.topLink = reel.permalink;
          }
        } catch (err) {
          if (isTokenError(err) || isRateLimitError(err)) tally.fatal ??= err;
          else if (isPermissionError(err)) tally.noPermission = true;
          else {
            tally.failed++;
            logInstagramError("reel insights", err, token);
          }
        }
      };

      // Probe one reel first: a token without the insights scope fails every call.
      await one(reels[0]);
      if (tally.fatal === null && !tally.noPermission) {
        await pool(reels.slice(1), CONCURRENCY, one, () => tally.fatal !== null || tally.noPermission || Date.now() > deadline);
      }
      if (tally.fatal !== null) throw tally.fatal;

      if (tally.noPermission && tally.counted === 0) {
        warnings.push(
          "Reel views aren't available: this token doesn't include the instagram_business_manage_insights permission. " +
            "Generate a new token with insights enabled, replace INSTAGRAM_ACCESS_TOKEN in Vercel and redeploy.",
        );
        tally.top = null;
        tally.topLink = null;
      } else {
        // Never propose "0 views" because every insights call failed.
        reelViewsTotal = tally.counted > 0 ? tally.sum : null;
        const skipped = reels.length - tally.counted - tally.failed;
        if (tally.failed > 0) {
          warnings.push(
            `${tally.failed} of ${reels.length} reels returned no view data (for example reels posted before the account became professional); they're left out of the total.`,
          );
        }
        if (skipped > 0) {
          warnings.push(
            `Counted views on ${tally.counted} of ${reels.length} reels before the time limit; the total covers those reels only.`,
          );
        }
      }
    }

    const snapshot: InstagramSnapshot = {
      username: profile.username,
      followers: profile.followers,
      posts: profile.posts,
      reels: reels.length,
      reelViews: reelViewsTotal,
      topReelViews: tally.top,
      topReelPermalink: tally.topLink,
      reelsWithViews: tally.counted,
      mediaScanned: media.items.length,
      fetchedAt: new Date().toISOString(),
      warnings,
    };

    return snapshot;
  } catch (err) {
    if (err instanceof InstagramApiError) logInstagramError("fetch", err, token);
    throw err;
  }
}
