import type { Metadata } from "next";
import { requireAdmin } from "@/core/auth/guard";
import { getSettings } from "@/core/data/admin";
import { getInstagramStatus } from "@/core/instagram/config";
import { InstagramManager } from "@/core/admin/instagram/instagram-manager";

/** Exempts this auth-gated, always-dynamic page from instant-navigation validation (set per page; the layout alone does not silence the dev insight). */
export const instant = false;

/**
 * Server Actions take their time limit from the page they're used on. A refresh
 * stops starting Graph requests after 40 s (src/core/instagram/snapshot.ts).
 */
export const maxDuration = 60;

export const metadata: Metadata = { title: "Instagram" };

export default async function InstagramPage() {
  await requireAdmin();
  const [status, settings] = await Promise.all([getInstagramStatus(), getSettings()]);
  return <InstagramManager status={status} handle={settings.identity.handle} />;
}
