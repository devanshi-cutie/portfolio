import type { MetadataRoute } from "next";
import { siteUrl } from "@/core/config/env";
import { getSiteContent } from "@/core/data/site";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const { collections, media } = await getSiteContent();
  const withWork = collections.filter((c) => media.some((m) => m.collectionId === c.id));
  return [
    { url: `${base}/`, changeFrequency: "weekly", priority: 1 },
    ...withWork.map((c) => ({
      url: `${base}/work/${c.slug}`,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
  ];
}
