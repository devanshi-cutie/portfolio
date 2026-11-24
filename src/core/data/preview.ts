/**
 * Preview fixture: the site content built from the active creator package, used
 * when Supabase is not configured. Ids are deterministic (stable across builds
 * and requests) and UUID-shaped so the same zod schemas accept them. Media
 * point at `local:<path inside /data>`, streamed by `/api/dev-media`.
 */
import creator from "@/creators/active";
import type { CreatorPackage } from "@/creators/types";
import { slugify } from "@/core/lib/slug";
import { LOCAL_PREFIX } from "@/core/cloudinary/paths";
import { normalizeSettings } from "@/core/schemas/settings";
import type {
  Brand,
  Collection,
  MediaItem,
  ResourceType,
  SiteContent,
  Testimonial,
} from "@/core/types/content";

/** Fixed timestamp: prerendering must not depend on the clock. */
const FIXTURE_TIME = "2026-01-01T00:00:00.000Z";

/** 32-bit FNV-1a with a seed. */
function fnv1a(input: string, seed: number): number {
  let hash = (0x811c9dc5 ^ seed) >>> 0;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

/** Deterministic UUID (v4 layout) derived from a namespace and a key. */
export function fixtureId(namespace: string, key: string): string {
  const source = `${namespace}:${key}`;
  const hex = [0x0, 0x9e3779b9, 0x85ebca6b, 0xc2b2ae35]
    .map((seed) => fnv1a(source, seed).toString(16).padStart(8, "0"))
    .join("")
    .split("");
  hex[12] = "4"; // version
  hex[16] = ((parseInt(hex[16], 16) & 0x3) | 0x8).toString(16); // RFC 4122 variant
  const h = hex.join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
}

const VIDEO_EXT = new Set(["mp4", "mov", "m4v", "webm"]);

function extensionOf(path: string): string {
  const dot = path.lastIndexOf(".");
  return dot === -1 ? "" : path.slice(dot + 1).toLowerCase();
}

export function buildPreviewContent(pkg: CreatorPackage = creator): SiteContent {
  const mediaId = (source: string) => fixtureId("media", source);
  const collectionId = (slug: string) => fixtureId("collection", slug);
  const brandId = (slug: string) => fixtureId("brand", slug);

  const mediaSources = new Set(pkg.media.map((m) => m.source));
  const resolveMedia = (source: string | undefined): string | null =>
    source && mediaSources.has(source) ? mediaId(source) : null;

  const collections: Collection[] = pkg.collections.map((c, i) => ({
    id: collectionId(c.slug),
    slug: c.slug,
    title: c.title,
    description: c.description ?? null,
    coverMediaId: resolveMedia(c.coverSource),
    sortOrder: i,
    published: true,
  }));
  const collectionSlugs = new Set(collections.map((c) => c.slug));

  const brands: Brand[] = pkg.brands.map((b, i) => {
    const slug = b.slug ?? slugify(b.name);
    return {
      id: brandId(slug),
      slug,
      name: b.name,
      logoMediaId: resolveMedia(b.logoSource),
      websiteUrl: b.websiteUrl ?? null,
      tags: [...b.tags],
      featured: b.featured ?? false,
      sortOrder: i,
      published: true,
    };
  });
  const brandSlugs = new Set(brands.map((b) => b.slug));

  const media: MediaItem[] = pkg.media.map((m, i) => {
    const format = extensionOf(m.source) || null;
    const resourceType: ResourceType = format && VIDEO_EXT.has(format) ? "video" : "image";
    return {
      id: mediaId(m.source),
      publicId: `${LOCAL_PREFIX}${m.source}`,
      resourceType,
      format,
      width: null,
      height: null,
      duration: null,
      bytes: null,
      kind: m.kind,
      title: m.title,
      caption: m.caption ?? null,
      alt: m.alt ?? null,
      collectionId: m.collection && collectionSlugs.has(m.collection) ? collectionId(m.collection) : null,
      brandId: m.brand && brandSlugs.has(m.brand) ? brandId(m.brand) : null,
      featured: m.featured ?? false,
      published: true,
      sortOrder: i,
      posterOffset: m.posterOffset ?? 0,
      edits: null,
      sourceUrl: m.sourceUrl ?? null,
      createdAt: FIXTURE_TIME,
      updatedAt: FIXTURE_TIME,
    };
  });

  const testimonials: Testimonial[] = pkg.testimonials.map((t, i) => ({
    id: fixtureId("testimonial", `${pkg.id}-t${i}`),
    quote: t.quote,
    authorName: t.authorName ?? null,
    authorRole: t.authorRole ?? null,
    brandId: t.brandSlug && brandSlugs.has(t.brandSlug) ? brandId(t.brandSlug) : null,
    avatarMediaId: null,
    sortOrder: i,
    published: true,
  }));

  const settings = normalizeSettings(pkg.settings);
  settings.identity.portraitMediaId = resolveMedia(pkg.settingsMedia.portraitSource) ?? settings.identity.portraitMediaId;
  settings.identity.heroMediaId = resolveMedia(pkg.settingsMedia.heroSource) ?? settings.identity.heroMediaId;
  settings.seo.ogImageMediaId = resolveMedia(pkg.settingsMedia.ogImageSource) ?? settings.seo.ogImageMediaId;

  const mediaById: Record<string, MediaItem> = {};
  for (const item of media) mediaById[item.id] = item;

  return {
    settings,
    sections: settings.sections.filter((s) => s.enabled),
    collections,
    media,
    brands,
    testimonials,
    mediaById,
    preview: true,
  };
}

let memo: SiteContent | null = null;

/** The preview fixture for the active creator (built once per server process). */
export function getPreviewContent(): SiteContent {
  memo ??= buildPreviewContent();
  return memo;
}
