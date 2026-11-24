"use server";

import { requireAdmin, isPreviewUser } from "@/core/auth/guard";
import { adminCounter } from "@/core/config/admin-extras";
import { incrementCounter } from "@/core/data/counters";

/**
 * Called by the admin header on every admin page open / refresh. Adds the
 * creator's `perView` to their counter and returns the new total (null when
 * the counter is off, in preview mode, or unavailable).
 */
export async function trackAdminView(): Promise<number | null> {
  const user = await requireAdmin();
  const counter = adminCounter();
  if (!counter || isPreviewUser(user)) return null;
  return incrementCounter(counter.key, counter.perView);
}
