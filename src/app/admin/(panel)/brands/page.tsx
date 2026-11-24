import type { Metadata } from "next";
import { requireAdmin } from "@/core/auth/guard";
import { listBrands, listMedia } from "@/core/data/admin";
import { BrandsManager } from "@/core/admin/brands/brands-manager";

/** Exempts this auth-gated, always-dynamic page from instant-navigation validation (set per page; the layout alone does not silence the dev insight). */
export const instant = false;

export const metadata: Metadata = { title: "Brands" };

export default async function BrandsPage() {
  await requireAdmin();
  const [brands, media] = await Promise.all([listBrands(), listMedia()]);
  return <BrandsManager brands={brands} media={media} />;
}
