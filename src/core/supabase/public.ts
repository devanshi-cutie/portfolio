import { createClient } from "@supabase/supabase-js";
import { env, isSupabaseConfigured } from "@/core/config/env";

/**
 * Anonymous Supabase client: anon key, **no cookies, no session**.
 * The only client allowed inside `'use cache'` (it reads no request data).
 * RLS limits it to published rows and inserting inquiries.
 */
export function createSupabasePublicClient() {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase is not configured");
  }
  return createClient(env.supabaseUrl, env.supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
