import type { Metadata } from "next";
import { requireAdmin } from "@/core/auth/guard";
import { listBrands, listCollections, listMedia } from "@/core/data/admin";
import { MediaLibrary } from "@/core/admin/media/media-library";

/** Exempts this auth-gated, always-dynamic page from instant-navigation validation (set per page; the layout alone does not silence the dev insight). */
export const instant = false;

export const metadata: Metadata = { title: "Media library" };

export default async function MediaPage() {
  await requireAdmin();
  const [media, collections, brands] = await Promise.all([listMedia(), listCollections(), listBrands()]);
  return <MediaLibrary media={media} collections={collections} brands={brands} />;
}
