import type { Metadata } from "next";
import { requireAdmin } from "@/core/auth/guard";
import { getSettings } from "@/core/data/admin";
import { SectionsEditor } from "@/core/admin/sections/sections-editor";

/** Exempts this auth-gated, always-dynamic page from instant-navigation validation (set per page; the layout alone does not silence the dev insight). */
export const instant = false;

export const metadata: Metadata = { title: "Page sections" };

export default async function SectionsPage() {
  await requireAdmin();
  const settings = await getSettings();
  return <SectionsEditor settings={settings} />;
}
