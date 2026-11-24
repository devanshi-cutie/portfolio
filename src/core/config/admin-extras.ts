/**
 * Per-creator admin extras (login consent checkbox, header counter), read from
 * the active creator package. Strings only — safe to pass to client components.
 */
import creator from "@/creators/active";
import type { CreatorAdminExtras } from "@/creators/types";

export function loginConsent(): NonNullable<CreatorAdminExtras["loginConsent"]> | null {
  return creator.admin?.loginConsent ?? null;
}

export function adminCounter(): NonNullable<CreatorAdminExtras["counter"]> | null {
  return creator.admin?.counter ?? null;
}
