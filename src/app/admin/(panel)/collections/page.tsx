import type { Metadata } from "next";
import { requireAdmin } from "@/core/auth/guard";
import { listCollections, listMedia } from "@/core/data/admin";
import { CollectionsManager } from "@/core/admin/collections/collections-manager";

/** Exempts this auth-gated, always-dynamic page from instant-navigation validation (set per page; the layout alone does not silence the dev insight). */
export const instant = false;

export const metadata: Metadata = { title: "Collections" };

export default async function CollectionsPage() {
  await requireAdmin();
  const [collections, media] = await Promise.all([listCollections(), listMedia()]);
  return <CollectionsManager collections={collections} media={media} />;
}
