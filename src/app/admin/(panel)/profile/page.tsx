import type { Metadata } from "next";
import { requireAdmin } from "@/core/auth/guard";
import { getSettings, listMedia } from "@/core/data/admin";
import { ProfileForm } from "@/core/admin/profile/profile-form";

/** Exempts this auth-gated, always-dynamic page from instant-navigation validation (set per page; the layout alone does not silence the dev insight). */
export const instant = false;

export const metadata: Metadata = { title: "Profile & SEO" };

export default async function ProfilePage() {
  await requireAdmin();
  const [settings, media] = await Promise.all([getSettings(), listMedia()]);
  return <ProfileForm settings={settings} media={media} />;
}
