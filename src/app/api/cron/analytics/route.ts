import { createHash, timingSafeEqual } from "node:crypto";
import { cronSecret } from "@/core/analytics/config";
import { runAnalyticsSync } from "@/core/analytics/sync";
import type { SyncResult } from "@/core/analytics/types";

/**
 * Daily Vercel Cron job (vercel.json): copies Vercel Web Analytics into
 * Supabase. Vercel sends `Authorization: Bearer <CRON_SECRET>`; anything else
 * is 401, and so is every request while CRON_SECRET is unset. Safe to repeat
 * (cron can fire twice): the sync isn't forced, so a second delivery shortly
 * after the first is skipped, and it upserts anyway. The body is the SyncResult, which
 * carries no secrets.
 */

export const maxDuration = 60;

const NO_STORE = { "Cache-Control": "no-store" };

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: NO_STORE });

const sha256 = (value: string): Buffer => createHash("sha256").update(value, "utf8").digest();

/** Constant-time compare; hashing first makes both sides the same length. */
function authorized(header: string, secret: string): boolean {
  if (!secret) return false;
  return timingSafeEqual(sha256(header), sha256(`Bearer ${secret}`));
}

function httpStatus(result: SyncResult): number {
  if (result.status !== "error") return 200; // synced, partial, skipped
  if (result.reason === "not_configured" || result.reason === "storage") return 503;
  return 502; // token, unavailable, rate_limited, network: Vercel's side
}

export async function GET(request: Request) {
  // Reading the request headers also keeps this handler from being prerendered.
  const header = request.headers.get("authorization") ?? "";
  if (!authorized(header, cronSecret())) return json({ error: "Unauthorized" }, 401);

  try {
    // not forced: a duplicate delivery within the sync's minimum interval comes back "skipped"
    const result = await runAnalyticsSync({ force: false });
    return json(result, httpStatus(result));
  } catch (err) {
    console.error("[analytics] cron sync failed:", "", err instanceof Error ? err.message : String(err));
    return json({ error: "Sync failed" }, 500);
  }
}
