import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "@/core/config/env";

/*
 * Service-role client. **Bypasses RLS.** Server-only, never sent to the browser.
 * Used by the admin panel's reads and server actions, and only AFTER
 * `requireAdmin()` has verified the admin session. The CLI scripts build their
 * own client and do not import this file.
 */

const serviceKey = (): string => (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();

/** Supabase URL and service-role key are both set. */
export function isSupabaseServiceConfigured(): boolean {
  return env.supabaseUrl !== "" && serviceKey() !== "";
}

let client: SupabaseClient | null = null;
let clientKey = "";

/** Holds no session, so one instance is reused across requests. */
export function createSupabaseServiceClient(): SupabaseClient {
  if (!isSupabaseServiceConfigured()) {
    throw new Error("Supabase service role is not configured");
  }
  const key = `${env.supabaseUrl}\0${serviceKey()}`;
  if (!client || clientKey !== key) {
    client = createClient(env.supabaseUrl, serviceKey(), {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });
    clientKey = key;
  }
  return client;
}
