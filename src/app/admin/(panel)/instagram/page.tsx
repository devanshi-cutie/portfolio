import type { Metadata } from "next";
import { requireAdmin } from "@/core/auth/guard";
import { getSettings } from "@/core/data/admin";
import { getInstagramStatus } from "@/core/instagram/connection";
import { buildReview } from "@/core/instagram/format";
import { InstagramManager } from "@/core/admin/instagram/instagram-manager";

/** Exempts this auth-gated, always-dynamic page from instant-navigation validation (set per page; the layout alone does not silence the dev insight). */
export const instant = false;

/**
 * Server Actions take their time limit from the page they're used on. A fetch
 * stops starting Graph requests after 50 s (src/core/instagram/snapshot.ts).
 */
export const maxDuration = 60;

export const metadata: Metadata = { title: "Instagram" };

export default async function InstagramPage() {
  await requireAdmin();
  const [status, settings] = await Promise.all([getInstagramStatus(), getSettings()]);
  const review = status.lastSnapshot ? buildReview(settings.stats, status.lastSnapshot) : null;
  // Keyed by account so connecting a different one starts with a clean review.
  return (
    <InstagramManager
      key={status.username ?? status.source ?? "none"}
      status={status}
      initialReview={review}
      handle={settings.identity.handle}
    />
  );
}
