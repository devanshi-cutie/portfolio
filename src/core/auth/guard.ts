import "server-only";

import { redirect } from "next/navigation";
import { cache } from "react";
import { isAdminPasswordConfigured, isAdminPreviewMode } from "./mode";
import { readSession } from "./session";

export { isAdminPasswordConfigured, isAdminPreviewMode } from "./mode";

/** The single admin. There are no user accounts: access is one password (ADMIN_PASSWORD). */
export interface AdminUser {
  id: string;
  role: "admin" | "preview";
  email?: string | null;
}

/**
 * Read-only preview (nothing configured, not production): the admin panel is
 * viewable with fixture data. `requireAdmin()` returns this sentinel instead of
 * redirecting, and every mutating action returns `fail("Supabase is not configured")`.
 */
export const PREVIEW_USER: AdminUser = Object.freeze({ id: "preview", role: "preview", email: null });

const ADMIN_USER: AdminUser = Object.freeze({ id: "admin", role: "admin", email: null });

export function isPreviewUser(user: AdminUser | null | undefined): boolean {
  return user?.role === "preview";
}

/**
 * How /admin/login should behave:
 * - "preview": nothing configured (dev only) — the panel is open read-only;
 * - "locked": no ADMIN_PASSWORD (e.g. production) — nobody can sign in;
 * - "password": sign in with ADMIN_PASSWORD.
 */
export function adminAuthMode(): "preview" | "locked" | "password" {
  if (isAdminPreviewMode()) return "preview";
  return isAdminPasswordConfigured() ? "password" : "locked";
}

/** The admin when the request has a valid session cookie, `PREVIEW_USER` in preview mode, else `null`. Per-request cached. */
export const getAdminUser = cache(async (): Promise<AdminUser | null> => {
  if (isAdminPreviewMode()) return PREVIEW_USER;
  return (await readSession()) ? ADMIN_USER : null;
});

/**
 * Returns the admin or redirects to `/admin/login`. Every admin page, admin read
 * and mutating server action calls this; the proxy check is only optimistic.
 */
export async function requireAdmin(): Promise<AdminUser> {
  const user = await getAdminUser();
  if (!user) redirect("/admin/login");
  return user;
}
