/**
 * Admin auth mode. Plain module (no `server-only`, no `next/headers`) so the
 * proxy can import it too. Reads non-public env vars, which are `undefined` in
 * client bundles — nothing secret is exposed by importing this.
 */
import { isSupabaseConfigured } from "@/core/config/env";

/** `ADMIN_PASSWORD` is set: the only way into /admin. */
export function isAdminPasswordConfigured(): boolean {
  return (process.env.ADMIN_PASSWORD ?? "").trim() !== "";
}

/**
 * Read-only preview of the admin panel with fixture data: only when nothing is
 * configured at all (no Supabase, no admin password) and not in production.
 */
export function isAdminPreviewMode(): boolean {
  // A service key alone must never open the panel without a password: the
  // actions would then write to a real database with no session.
  const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim() !== "";
  return !isSupabaseConfigured() && !serviceKey && !isAdminPasswordConfigured() && process.env.NODE_ENV !== "production";
}

/**
 * Session cookie name. In production the `__Host-` prefix makes browsers insist
 * on Secure, Path=/ and no Domain, so a sibling subdomain cannot plant it.
 */
export function sessionCookieName(): string {
  return process.env.NODE_ENV === "production" ? "__Host-admin_session" : "admin_session";
}
