/**
 * Domain contract for the creator-portfolio engine.
 *
 * Everything theme-agnostic speaks these types: the database rows (snake_case in
 * SQL, mapped to camelCase here by the data layer), the admin panel, the seed
 * script and every theme. A theme receives a `SiteContent` and nothing else.
 *
 * Changing a shape here is a breaking change for every theme — add optional
 * fields rather than renaming existing ones.
 */

/* ------------------------------------------------------------------ media */

export type ResourceType = "image" | "video";

/** What a media item is *for*. Themes decide where each kind is shown. */
export type MediaKind =
  | "reel" // vertical short-form brand/creator video
  | "video" // any other video (horizontal, long-form)
  | "photo" // portfolio / editorial photo
  | "bts" // behind-the-scenes photo or clip
  | "logo" // brand logo (normally attached to a Brand)
  | "portrait" // photos of the creator used for hero/about/avatar
  | "other";

export const MEDIA_KINDS: readonly MediaKind[] = [
  "reel",
  "video",
  "photo",
  "bts",
  "logo",
  "portrait",
  "other",
] as const;

export interface MediaItem {
  id: string;
  /**
   * Cloudinary public_id, e.g. "devanshi/media/jewellery-ring-reel".
   * In local preview mode (no Cloudinary configured) this is "local:<path inside /data>".
   */
  publicId: string;
  resourceType: ResourceType;
  format: string | null;
  width: number | null;
  height: number | null;
  /** seconds, videos only */
  duration: number | null;
  bytes: number | null;
  kind: MediaKind;
  title: string | null;
  caption: string | null;
  /** alt text for images / accessible label for videos */
  alt: string | null;
  collectionId: string | null;
  brandId: string | null;
  featured: boolean;
  published: boolean;
  sortOrder: number;
  /** second of the video used as the poster frame */
  posterOffset: number;
  /** non-destructive edits applied at delivery time by Cloudinary; null = original */
  edits: MediaEdits | null;
  /**
   * Link to the original post (e.g. the Instagram reel) so visitors can see its
   * real views, likes and comments. null = not linked.
   */
  sourceUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Non-destructive edits for a photo or video. The original file on Cloudinary
 * is never modified: delivery URLs apply these as transformations, in this
 * order: flip → rotate → crop → adjustments → (video) trim → resize.
 *
 * Coordinates follow react-easy-crop: `crop` is a percentage (0–100) rectangle
 * of the media's bounding box AFTER flip + rotation.
 */
export interface MediaEdits {
  crop: { x: number; y: number; width: number; height: number } | null;
  /** aspect preset last used in the editor: "original" | "free" | "9:16" | "4:5" | "1:1" | "16:9" (UI only) */
  aspect: string | null;
  /** clockwise degrees, -180..180 */
  rotation: number;
  flipH: boolean;
  flipV: boolean;
  /** -100..100; 0 = unchanged */
  brightness: number;
  contrast: number;
  saturation: number;
  /** videos only: seconds from the start of the original; null = untouched */
  trimStart: number | null;
  trimEnd: number | null;
}

/* ------------------------------------------------------------ collections */

/** A body of work: "Jewellery", "Real estate", "Travel", an agency, a campaign… */
export interface Collection {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  coverMediaId: string | null;
  sortOrder: number;
  published: boolean;
}

/* ------------------------------------------------------------------ brands */

/** Free-form tags; the defaults the admin offers are below. */
export type BrandTag = "ugc" | "instagram" | string;
export const DEFAULT_BRAND_TAGS = ["ugc", "instagram"] as const;

export interface Brand {
  id: string;
  slug: string;
  name: string;
  logoMediaId: string | null;
  websiteUrl: string | null;
  tags: BrandTag[];
  featured: boolean;
  sortOrder: number;
  published: boolean;
}

/* ------------------------------------------------------------ testimonials */

export interface Testimonial {
  id: string;
  quote: string;
  authorName: string | null;
  authorRole: string | null;
  brandId: string | null;
  avatarMediaId: string | null;
  sortOrder: number;
  published: boolean;
}

/* --------------------------------------------------------------- inquiries */

export type InquiryStatus = "new" | "read" | "archived";

export interface Inquiry {
  id: string;
  name: string;
  email: string;
  company: string | null;
  budget: string | null;
  message: string;
  status: InquiryStatus;
  createdAt: string;
}

/* ----------------------------------------------------------- site settings */

/**
 * Section keys a theme may render. Order and visibility come from
 * `SiteSettings.sections`; a theme silently skips keys it does not implement.
 */
export type SectionKey =
  | "hero"
  | "about"
  | "stats"
  | "highlights"
  | "work"
  | "brands"
  | "bts"
  | "services"
  | "process"
  | "testimonials"
  | "contact";

export const SECTION_KEYS: readonly SectionKey[] = [
  "hero",
  "about",
  "stats",
  "highlights",
  "work",
  "brands",
  "bts",
  "services",
  "process",
  "testimonials",
  "contact",
] as const;

export interface SectionConfig {
  key: SectionKey;
  enabled: boolean;
  /** small label above the heading */
  eyebrow: string;
  title: string;
  subtitle: string;
}

export interface SocialLink {
  /** "instagram" | "youtube" | "linkedin" | "tiktok" | "x" | "website" | "whatsapp" | "email" | other */
  platform: string;
  label: string;
  url: string;
}

export interface BrandGroup {
  tag: string;
  label: string;
}

/**
 * Where a stat's number comes from. "manual" (or absent) shows `value` as typed.
 * - "instagram.*": `value` is stored; the admin's "Fetch from Instagram" fills
 *   in fresh numbers for review and "Update website" writes them into `value`.
 * - "site.*": counted from this site's own published content at render time,
 *   falling back to `value`.
 */
export type StatSource =
  | "manual"
  | "instagram.followers" // followers_count
  | "instagram.posts" // media_count
  | "instagram.reelViews" // sum of `views` across her reels
  | "instagram.topReelViews" // highest `views` on a single reel
  | "site.brands" // published brands on this site
  | "site.reels"; // published reels on this site

export const STAT_SOURCES: readonly StatSource[] = [
  "manual",
  "instagram.followers",
  "instagram.posts",
  "instagram.reelViews",
  "instagram.topReelViews",
  "site.brands",
  "site.reels",
] as const;

export interface Stat {
  value: string; // "40+", "2.6K" — what the site shows (the fallback for "site.*")
  label: string;
  /** absent = "manual" */
  source?: StatSource;
}

export interface Highlight {
  title: string;
  body: string;
}

export interface Service {
  title: string;
  description: string;
  deliverables: string[];
}

export interface ProcessStep {
  title: string;
  body: string;
}

export interface SiteSettings {
  identity: {
    name: string;
    handle: string; // without "@"
    role: string; // "UGC Creator"
    location: string;
    tagline: string;
    shortBio: string;
    longBio: string;
    /** creator portrait used in hero/about */
    portraitMediaId: string | null;
    /** optional hero background / showreel video or image */
    heroMediaId: string | null;
    /** rotating words for the hero, e.g. ["Fashion", "Lifestyle", "Real estate"] */
    keywords: string[];
  };
  contact: {
    email: string;
    phone: string;
    whatsapp: string; // digits with country code, e.g. "919876543210"
    ctaLabel: string;
    availability: string; // "Open for collaborations — Jan 2027"
    mediaKitUrl: string;
    /** options for the contact form's budget select; empty → the field is hidden */
    budgetOptions: string[];
  };
  socials: SocialLink[];
  /** how brand tags are grouped/labelled on the site, e.g. { tag: "ugc", label: "UGC content creation" } */
  brandGroups: BrandGroup[];
  stats: Stat[];
  highlights: Highlight[];
  services: Service[];
  process: ProcessStep[];
  sections: SectionConfig[];
  seo: {
    title: string;
    description: string;
    ogImageMediaId: string | null;
  };
  /** optional theme overrides; themes read only the keys they understand */
  theme: Record<string, string>;
}

/* ------------------------------------------------------- aggregate payload */

/**
 * Everything a theme needs to render the public site, already filtered to
 * published rows and sorted by sortOrder. Media references are resolved via
 * `mediaById`.
 */
export interface SiteContent {
  settings: SiteSettings;
  /** enabled sections in display order */
  sections: SectionConfig[];
  collections: Collection[];
  media: MediaItem[];
  brands: Brand[];
  testimonials: Testimonial[];
  mediaById: Record<string, MediaItem>;
  /** true when served from local fixtures because Supabase is not configured */
  preview: boolean;
}
