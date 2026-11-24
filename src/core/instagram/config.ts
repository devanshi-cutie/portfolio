import "server-only";

import { requireAdmin } from "@/core/auth/guard";
import { isSupabaseServiceConfigured } from "@/core/supabase/service";
import type { InstagramStatus } from "./types";

/*
 * The Instagram access token comes only from the INSTAGRAM_ACCESS_TOKEN env var
 * (set in Vercel). It is never stored in the database, never renewed by the
 * app and never sent to the browser: Meta's dashboard tokens last 60 days, then
 * a new one is generated and replaced in Vercel.
 */

/** The token, or "" when not configured. Server-only. */
export function instagramToken(): string {
  return (process.env.INSTAGRAM_ACCESS_TOKEN ?? "").trim();
}

/** The admin page's view of the setup: whether a token is configured, nothing more. */
export async function getInstagramStatus(): Promise<InstagramStatus> {
  await requireAdmin();
  return { configured: instagramToken() !== "", storageReady: isSupabaseServiceConfigured() };
}
