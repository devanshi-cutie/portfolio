/**
 * Service-role Supabase client for CLI scripts only.
 *
 * Deliberately independent of `src/core/supabase` (those modules import
 * `server-only` and Next APIs). The service-role key bypasses RLS, so it must
 * never be used outside these scripts or server-only code.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { UserError, missingEnv, readEnv } from "./env";

export const SUPABASE_ENV = ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"] as const;

export function createServiceClient(): SupabaseClient {
  const missing = missingEnv(SUPABASE_ENV);
  if (missing.length > 0) {
    throw new UserError(
      `Missing ${missing.join(", ")}. Add them to .env.local (Supabase → Project Settings → API).`,
    );
  }
  const url = readEnv("NEXT_PUBLIC_SUPABASE_URL")!;
  try {
    new URL(url);
  } catch {
    throw new UserError(`NEXT_PUBLIC_SUPABASE_URL is not a valid URL (got "${url}").`);
  }
  return createClient(url, readEnv("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

interface PostgrestLikeError {
  message: string;
  code?: string;
  hint?: string | null;
  details?: string | null;
}

/** Turns a PostgREST error into a message with a hint for the common setup mistakes. */
export function describeDbError(context: string, error: PostgrestLikeError): string {
  let hint = "";
  if (error.code === "42P01" || error.code === "PGRST205") {
    hint = " — the table is missing; run supabase/migrations/20261124000000_init.sql first.";
  } else if (error.code === "42501") {
    hint =
      " — permission denied; the service_role needs table grants (e.g. `grant all on all tables in schema public to service_role;`).";
  } else if (/invalid api key|jwt|jws/i.test(error.message)) {
    hint = " — check SUPABASE_SERVICE_ROLE_KEY (it must be the service_role / secret key).";
  } else if (/fetch failed|ENOTFOUND|ECONNREFUSED/i.test(error.message)) {
    hint = " — could not reach Supabase; check NEXT_PUBLIC_SUPABASE_URL and your network.";
  }
  const code = error.code ? ` [${error.code}]` : "";
  return `${context}: ${error.message}${code}${hint}`;
}
