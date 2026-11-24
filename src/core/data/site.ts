import "server-only";

import { cacheLife, cacheTag } from "next/cache";
import { isSupabaseConfigured } from "@/core/config/env";
import { formatCompact } from "@/core/instagram/format";
import { normalizeSettings } from "@/core/schemas/settings";
import { createSupabasePublicClient } from "@/core/supabase/public";
import type { Collection, MediaItem, SiteContent, Stat } from "@/core/types/content";
import {
  BRAND_COLUMNS,
  COLLECTION_COLUMNS,
  MEDIA_COLUMNS,
  TESTIMONIAL_COLUMNS,
  mapBrand,
  mapCollection,
  mapMedia,
  mapTestimonial,
  type BrandRow,
  type CollectionRow,
  type MediaRow,
  type TestimonialRow,
} from "./mappers";
import { getPreviewContent } from "./preview";
import { CONTENT_TAG } from "./tags";

/**
 * The bundled preview fixture may stand in for the database in development, or
 * anywhere when ALLOW_PREVIEW_CONTENT=1 (demo deploys, local `next build` checks).
 * A production deploy without Supabase fails loudly instead of silently showing it.
 */
function previewContentAllowed(): boolean {
  return process.env.NODE_ENV !== "production" || (process.env.ALLOW_PREVIEW_CONTENT ?? "").trim() === "1";
}

/**
 * Fills stats whose source is "site.*" with counts from the published content:
 * site.brands = published brands, site.reels = published media of kind "reel".
 * A zero count keeps the stored value (the fallback); a trailing "+" on the
 * stored value is kept. Themes only ever read `stat.value`.
 */
function withSiteCounts(content: SiteContent): SiteContent {
  const counts: Partial<Record<NonNullable<Stat["source"]>, number>> = {
    "site.brands": content.brands.length,
    "site.reels": content.media.filter((m) => m.kind === "reel").length,
  };
  let changed = false;
  const stats = content.settings.stats.map((stat) => {
    const count = stat.source ? counts[stat.source] : undefined;
    if (!count) return stat;
    const value = formatCompact(count) + (stat.value.trim().endsWith("+") ? "+" : "");
    if (value === stat.value) return stat;
    changed = true;
    return { ...stat, value };
  });
  return changed ? { ...content, settings: { ...content.settings, stats } } : content;
}

/**
 * Everything a theme renders: published rows only, sorted by `sort_order`.
 * Cached (`'use cache'`, tag `CONTENT_TAG`) and invalidated by server actions
 * via `updateTag(CONTENT_TAG)`. Without Supabase it returns the preview fixture
 * (development or ALLOW_PREVIEW_CONTENT=1) or throws (production).
 */
export async function getSiteContent(): Promise<SiteContent> {
  "use cache";
  cacheTag(CONTENT_TAG);
  cacheLife("max");

  if (!isSupabaseConfigured()) {
    if (!previewContentAllowed()) {
      throw new Error(
        "Supabase is not configured: set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY " +
          "(or ALLOW_PREVIEW_CONTENT=1 to serve the bundled preview content).",
      );
    }
    return withSiteCounts(getPreviewContent());
  }

  const supabase = createSupabasePublicClient();
  const [settingsRes, collectionsRes, mediaRes, brandsRes, testimonialsRes] = await Promise.all([
    supabase.from("site_settings").select("data").eq("id", 1).maybeSingle(),
    supabase
      .from("collections")
      .select(COLLECTION_COLUMNS)
      .eq("published", true)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true }),
    supabase
      .from("media")
      .select(MEDIA_COLUMNS)
      .eq("published", true)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true }),
    supabase
      .from("brands")
      .select(BRAND_COLUMNS)
      .eq("published", true)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true }),
    supabase
      .from("testimonials")
      .select(TESTIMONIAL_COLUMNS)
      .eq("published", true)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true }),
  ]);

  const failed = [settingsRes, collectionsRes, mediaRes, brandsRes, testimonialsRes].find((r) => r.error);
  if (failed?.error) {
    console.error("[getSiteContent] Supabase query failed:", failed.error.message);
    throw new Error("Could not load site content");
  }

  const settings = normalizeSettings(settingsRes.data?.data);
  const collections = ((collectionsRes.data ?? []) as CollectionRow[]).map(mapCollection);
  const publishedCollectionIds = new Set(collections.map((c) => c.id));

  // Media in an unpublished collection is hidden with it.
  const media = ((mediaRes.data ?? []) as MediaRow[])
    .map(mapMedia)
    .filter((m) => m.collectionId === null || publishedCollectionIds.has(m.collectionId));

  const mediaById: Record<string, MediaItem> = {};
  for (const item of media) mediaById[item.id] = item;

  return withSiteCounts({
    settings,
    sections: settings.sections.filter((s) => s.enabled),
    collections,
    media,
    brands: ((brandsRes.data ?? []) as BrandRow[]).map(mapBrand),
    testimonials: ((testimonialsRes.data ?? []) as TestimonialRow[]).map(mapTestimonial),
    mediaById,
    preview: false,
  });
}

/** A published collection and its media, in order. `null` when the slug is unknown or unpublished. */
export async function getCollectionWork(
  slug: string,
): Promise<{ collection: Collection; items: MediaItem[] } | null> {
  const content = await getSiteContent();
  const collection = content.collections.find((c) => c.slug === slug);
  if (!collection) return null;
  return { collection, items: content.media.filter((m) => m.collectionId === collection.id) };
}
