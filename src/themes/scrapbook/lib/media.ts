import { imageUrl, videoPosterUrl, videoUrl } from "@/core/cloudinary/urls";
import type { Brand, Collection, MediaItem, SiteContent } from "@/core/types/content";

export const isVideo = (m: MediaItem) => m.resourceType === "video";

/** Reels and other videos shown in the work grid. */
export const isWork = (m: MediaItem) => m.kind === "reel" || m.kind === "video";

/** Poster/still for a media item, or null when only the video itself can show a frame. */
export function posterOf(m: MediaItem, width: number): string | null {
  if (isVideo(m)) return videoPosterUrl(m, { width, offset: m.posterOffset });
  return imageUrl(m, { width, crop: "limit" });
}

export function videoSrcOf(m: MediaItem, width: number): string {
  return videoUrl(m, { width });
}

/** Local preview has no poster service: show the frame at 0.5s instead. */
export function withFrameHint(src: string): string {
  return src.includes("#") ? src : `${src}#t=0.5`;
}

export function labelOf(m: MediaItem): string {
  return m.alt || m.title || m.caption || (isVideo(m) ? "Video by the creator" : "Photo by the creator");
}

export interface MediaMeta {
  id: string;
  title: string;
  brand: string | null;
  collection: string | null;
  collectionSlug: string | null;
}

/** Plain, serialisable labels for client components. */
export function metaOf(
  m: MediaItem,
  brands: Map<string, Brand>,
  collections: Map<string, Collection>,
): MediaMeta {
  const c = m.collectionId ? collections.get(m.collectionId) : undefined;
  const b = m.brandId ? brands.get(m.brandId) : undefined;
  return {
    id: m.id,
    title: m.title || m.caption || "Untitled",
    brand: b?.name ?? null,
    collection: c?.title ?? null,
    collectionSlug: c?.slug ?? null,
  };
}

export function indexContent(content: SiteContent) {
  return {
    brands: new Map(content.brands.map((b) => [b.id, b])),
    collections: new Map(content.collections.map((c) => [c.id, c])),
  };
}

export function resolveMedia(content: SiteContent, id: string | null | undefined): MediaItem | null {
  return id ? (content.mediaById[id] ?? null) : null;
}

/** Portrait for hero/about: the configured one, else any portrait, else a BTS photo. */
export function portraitOf(content: SiteContent): MediaItem | null {
  return (
    resolveMedia(content, content.settings.identity.portraitMediaId) ??
    content.media.find((m) => m.kind === "portrait" && !isVideo(m)) ??
    content.media.find((m) => m.kind === "bts" && !isVideo(m)) ??
    null
  );
}

/** Three reels for the hero fan: hero media first, then featured, then any. */
export function heroReels(content: SiteContent): MediaItem[] {
  const work = content.media.filter(isWork);
  const hero = resolveMedia(content, content.settings.identity.heroMediaId);
  const picks: MediaItem[] = [];
  const add = (m: MediaItem | null | undefined) => {
    if (m && isVideo(m) && !picks.some((p) => p.id === m.id)) picks.push(m);
  };
  add(hero);
  work.filter((m) => m.featured).forEach(add);
  work.forEach(add);
  return picks.slice(0, 3);
}

/** Pick the visible handle-free label for a social platform. */
export function socialUrl(content: SiteContent, platform: string): string | null {
  const s = content.settings.socials.find((x) => x.platform.toLowerCase() === platform && x.url);
  return s?.url ?? null;
}

export function instagramUrl(content: SiteContent): string {
  return (
    socialUrl(content, "instagram") ??
    `https://www.instagram.com/${encodeURIComponent(content.settings.identity.handle)}/`
  );
}

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

/** `settings.theme` overrides the theme understands, validated as hex colours. */
export function themeOverrides(theme: Record<string, string>): Record<string, string> {
  const map: Record<string, string> = {
    cream: "--cream",
    cream2: "--cream-2",
    ink: "--ink",
    inkSoft: "--ink-soft",
    rose: "--rose",
    roseDeep: "--rose-deep",
    terracotta: "--terracotta",
    blush: "--blush",
    gold: "--gold",
  };
  const out: Record<string, string> = {};
  for (const [key, cssVar] of Object.entries(map)) {
    const v = theme[key];
    if (v && HEX.test(v)) out[cssVar] = v;
  }
  return out;
}
