import "server-only";

import { requireAdmin } from "@/core/auth/guard";
import { isSupabaseServiceConfigured } from "@/core/supabase/service";
import type { AnalyticsStatus } from "./types";

/*
 * Vercel Web Analytics access comes only from env vars set in Vercel
 * (VERCEL_ANALYTICS_TOKEN, VERCEL_ANALYTICS_PROJECT_ID, optional
 * VERCEL_ANALYTICS_TEAM_ID). The token is never stored, logged or sent to the
 * browser. CRON_SECRET authorizes Vercel Cron's daily sync request.
 */

export interface VercelAnalyticsConfig {
  token: string;
  projectId: string;
  /** sent only when set (projects owned by a team) */
  teamId?: string;
}

const read = (name: string): string => (process.env[name] ?? "").trim();

/** The Vercel API settings, or null when the token or project id is missing. Server-only. */
export function vercelAnalyticsConfig(): VercelAnalyticsConfig | null {
  const token = read("VERCEL_ANALYTICS_TOKEN");
  const projectId = read("VERCEL_ANALYTICS_PROJECT_ID");
  if (!token || !projectId) return null;
  const teamId = read("VERCEL_ANALYTICS_TEAM_ID");
  return teamId ? { token, projectId, teamId } : { token, projectId };
}

/** Minimum CRON_SECRET length; anything shorter is treated as unset. */
const CRON_SECRET_MIN = 16;

/** CRON_SECRET, or "" when unset or too short to be trusted. Server-only. */
export function cronSecret(): string {
  const secret = read("CRON_SECRET");
  return secret.length >= CRON_SECRET_MIN ? secret : "";
}

/** The admin page's view of the setup: whether analytics is configured, nothing more. */
export async function getAnalyticsStatus(): Promise<AnalyticsStatus> {
  await requireAdmin();
  return { configured: vercelAnalyticsConfig() !== null, storageReady: isSupabaseServiceConfigured() };
}
