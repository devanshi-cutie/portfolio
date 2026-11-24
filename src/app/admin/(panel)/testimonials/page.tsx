import type { Metadata } from "next";
import { requireAdmin } from "@/core/auth/guard";
import { listBrands, listMedia, listTestimonials } from "@/core/data/admin";
import { TestimonialsManager } from "@/core/admin/testimonials/testimonials-manager";

/** Exempts this auth-gated, always-dynamic page from instant-navigation validation (set per page; the layout alone does not silence the dev insight). */
export const instant = false;

export const metadata: Metadata = { title: "Testimonials" };

export default async function TestimonialsPage() {
  await requireAdmin();
  const [testimonials, brands, media] = await Promise.all([listTestimonials(), listBrands(), listMedia()]);
  return <TestimonialsManager testimonials={testimonials} brands={brands} media={media} />;
}
