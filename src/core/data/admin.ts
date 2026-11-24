import "server-only";

import { requireAdmin } from "@/core/auth/guard";
import { idSchema } from "@/core/schemas/common";
import { normalizeSettings } from "@/core/schemas/settings";
import { createSupabaseServiceClient, isSupabaseServiceConfigured } from "@/core/supabase/service";
import type { DashboardStats, MediaFilter } from "@/core/types/admin";
import type {
  Brand,
  Collection,
  Inquiry,
  InquiryStatus,
  MediaItem,
  SiteSettings,
  Testimonial,
} from "@/core/types/content";
import {
  BRAND_COLUMNS,
  COLLECTION_COLUMNS,
  INQUIRY_COLUMNS,
  MEDIA_COLUMNS,
  TESTIMONIAL_COLUMNS,
  mapBrand,
  mapCollection,
  mapInquiry,
  mapMedia,
  mapTestimonial,
  type BrandRow,
  type CollectionRow,
  type InquiryRow,
  type MediaRow,
  type TestimonialRow,
} from "./mappers";
import { getPreviewContent } from "./preview";

/*
 * Admin reads: uncached, every row including unpublished ones. Each function
 * calls `requireAdmin()` itself (per-request cached), then uses the service-role
 * client, which bypasses RLS — so never call these from public code paths.
 * Without the service-role config they return the fixture (inquiries empty).
 */

/** Admin check, then the service-role client, or null when it is not configured (same rule as the actions). */
async function db() {
  await requireAdmin();
  return isSupabaseServiceConfigured() ? createSupabaseServiceClient() : null;
}

function check<T>(res: { data: T | null; error: { message: string } | null }, what: string): T {
  if (res.error) {
    console.error(`[admin data] ${what} failed:`, res.error.message);
    throw new Error(`Could not load ${what}`);
  }
  return res.data as T;
}

const matchesQuery = (m: MediaItem, q: string): boolean => {
  const needle = q.toLowerCase();
  return [m.title, m.caption, m.publicId].some((v) => v?.toLowerCase().includes(needle));
};

function applyFilter(items: MediaItem[], filter: MediaFilter = {}): MediaItem[] {
  const q = filter.q?.trim();
  return items.filter(
    (m) =>
      (filter.kind === undefined || m.kind === filter.kind) &&
      (filter.collectionId === undefined || m.collectionId === filter.collectionId) &&
      (filter.brandId === undefined || m.brandId === filter.brandId) &&
      (filter.published === undefined || m.published === filter.published) &&
      (!q || matchesQuery(m, q)),
  );
}

export async function getSettings(): Promise<SiteSettings> {
  const supabase = await db();
  if (!supabase) return getPreviewContent().settings;
  const row = check(
    await supabase.from("site_settings").select("data").eq("id", 1).maybeSingle(),
    "settings",
  ) as { data: unknown } | null;
  return normalizeSettings(row?.data);
}

export async function listMedia(filter?: MediaFilter): Promise<MediaItem[]> {
  const supabase = await db();
  if (!supabase) return applyFilter(getPreviewContent().media, filter);

  let query = supabase.from("media").select(MEDIA_COLUMNS);
  if (filter?.kind) query = query.eq("kind", filter.kind);
  if (filter?.collectionId) {
    if (!idSchema.safeParse(filter.collectionId).success) return [];
    query = query.eq("collection_id", filter.collectionId);
  }
  if (filter?.brandId) {
    if (!idSchema.safeParse(filter.brandId).success) return [];
    query = query.eq("brand_id", filter.brandId);
  }
  if (filter?.published !== undefined) query = query.eq("published", filter.published);

  const rows = check(
    await query.order("sort_order", { ascending: true }).order("created_at", { ascending: true }),
    "media",
  ) as MediaRow[];
  // Text search runs in memory: the library is small and this avoids building
  // PostgREST filter strings from user input.
  const items = rows.map(mapMedia);
  return filter?.q?.trim() ? applyFilter(items, { q: filter.q }) : items;
}

export async function getMedia(id: string): Promise<MediaItem | null> {
  const supabase = await db();
  if (!supabase) return getPreviewContent().mediaById[id] ?? null;
  if (!idSchema.safeParse(id).success) return null;
  const row = check(await supabase.from("media").select(MEDIA_COLUMNS).eq("id", id).maybeSingle(), "media item");
  return row ? mapMedia(row as MediaRow) : null;
}

export async function listCollections(): Promise<Collection[]> {
  const supabase = await db();
  if (!supabase) return getPreviewContent().collections;
  const rows = check(
    await supabase
      .from("collections")
      .select(COLLECTION_COLUMNS)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true }),
    "collections",
  );
  return (rows as CollectionRow[]).map(mapCollection);
}

export async function listBrands(): Promise<Brand[]> {
  const supabase = await db();
  if (!supabase) return getPreviewContent().brands;
  const rows = check(
    await supabase
      .from("brands")
      .select(BRAND_COLUMNS)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true }),
    "brands",
  );
  return (rows as BrandRow[]).map(mapBrand);
}

export async function listTestimonials(): Promise<Testimonial[]> {
  const supabase = await db();
  if (!supabase) return getPreviewContent().testimonials;
  const rows = check(
    await supabase
      .from("testimonials")
      .select(TESTIMONIAL_COLUMNS)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true }),
    "testimonials",
  );
  return (rows as TestimonialRow[]).map(mapTestimonial);
}

/** Newest first, capped at 500. */
export async function listInquiries(status?: InquiryStatus): Promise<Inquiry[]> {
  const supabase = await db();
  if (!supabase) return [];
  let query = supabase.from("inquiries").select(INQUIRY_COLUMNS);
  if (status) query = query.eq("status", status);
  const rows = check(await query.order("created_at", { ascending: false }).limit(500), "inquiries");
  return (rows as InquiryRow[]).map(mapInquiry);
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const supabase = await db();
  if (!supabase) {
    const c = getPreviewContent();
    return {
      media: c.media.length,
      published: c.media.filter((m) => m.published).length,
      collections: c.collections.length,
      brands: c.brands.length,
      testimonials: c.testimonials.length,
      newInquiries: 0,
    };
  }

  const count = (table: string) => supabase.from(table).select("id", { count: "exact", head: true });
  const [media, published, collections, brands, testimonials, newInquiries] = await Promise.all([
    count("media"),
    count("media").eq("published", true),
    count("collections"),
    count("brands"),
    count("testimonials"),
    count("inquiries").eq("status", "new"),
  ]);
  const n = (res: { count: number | null; error: { message: string } | null }, what: string) => {
    check({ data: null, error: res.error }, what);
    return res.count ?? 0;
  };
  return {
    media: n(media, "media count"),
    published: n(published, "published count"),
    collections: n(collections, "collections count"),
    brands: n(brands, "brands count"),
    testimonials: n(testimonials, "testimonials count"),
    newInquiries: n(newInquiries, "inquiries count"),
  };
}
