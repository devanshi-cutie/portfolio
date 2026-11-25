"use server";

import { z } from "zod";
import { runAnalyticsSync } from "@/core/analytics/sync";
import type { SyncResult } from "@/core/analytics/types";
import { isPreviewUser, requireAdmin } from "@/core/auth/guard";
import { PREVIEW_ERROR, invalid } from "@/core/db/errors";
import { fail, ok, type ActionResult } from "./result";

/*
 * The Analytics tab's "Refresh from Vercel" button. Admin only. Vercel-side problems (bad token,
 * rate limit, analytics unavailable) come back as ok(SyncResult) with status
 * "error" / "partial" so the page can explain them; only a preview session, a
 * malformed request or an unexpected crash fail. Nothing public is cached from
 * this data, so no cache tags are touched.
 */

const inputSchema = z.object({ force: z.boolean().optional() }).strict();

export async function syncAnalytics(input: { force?: boolean } = {}): Promise<ActionResult<SyncResult>> {
  const user = await requireAdmin();
  if (isPreviewUser(user)) return fail(PREVIEW_ERROR);

  const parsed = inputSchema.safeParse(input ?? {});
  if (!parsed.success) return invalid(parsed.error, "That sync request isn't valid.");

  try {
    return ok(await runAnalyticsSync({ force: parsed.data.force ?? false }));
  } catch (err) {
    console.error("[analytics] sync failed:", "", err instanceof Error ? err.message : String(err));
    return fail("Could not sync analytics. Please try again.");
  }
}
