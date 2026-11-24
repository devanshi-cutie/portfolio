import "server-only";
import { createSupabaseServiceClient, isSupabaseServiceConfigured } from "@/core/supabase/service";

/**
 * Atomically adds `by` to a named counter and returns the new total
 * (public.increment_admin_counter). Never throws: a counter must not break
 * sign-in or page loads, so failures return null.
 */
export async function incrementCounter(key: string, by: number): Promise<number | null> {
  if (!isSupabaseServiceConfigured()) return null;
  try {
    const { data, error } = await createSupabaseServiceClient().rpc("increment_admin_counter", { p_key: key, p_by: Math.max(0, Math.trunc(by)) });
    if (error) {
      console.error("[counters] increment failed:", error.code ?? "", error.message);
      return null;
    }
    return typeof data === "number" ? data : Number(data);
  } catch (err) {
    console.error("[counters] increment failed:", err);
    return null;
  }
}
