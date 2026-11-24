import type { MediaKind, SiteSettings } from "@/core/types/content";

/**
 * A creator package: the initial content for one creator's site.
 *
 * It is used twice:
 *  1. by `npm run seed` to upload `/data` to Cloudinary and fill Supabase, and
 *  2. by the data layer as a local preview fixture when Supabase is not configured.
 *
 * After seeding, the admin panel is the source of truth — editing this file does
 * not change a live site unless you re-run the seed.
 *
 * Every `source` / `*Source` field is a path relative to the `/data` folder.
 */
export interface CreatorPackage {
  /** short id, also the default Cloudinary folder */
  id: string;
  settings: SiteSettings;
  /** media paths for the settings' media slots, resolved to media ids by the seed */
  settingsMedia: {
    portraitSource?: string;
    heroSource?: string;
    ogImageSource?: string;
  };
  collections: CollectionSeed[];
  brands: BrandSeed[];
  testimonials: TestimonialSeed[];
  media: MediaSeed[];
  /** optional personal touches for this creator's admin panel (code config, not editable in the admin) */
  admin?: CreatorAdminExtras;
}

export interface CreatorAdminExtras {
  /** a checkbox that must be ticked to sign in */
  loginConsent?: {
    label: string;
    /** shown when someone tries to sign in without ticking it */
    error: string;
  };
  /** a counter in the admin header: +perLogin on every sign-in, +perView on every admin page open/refresh */
  counter?: {
    /** stable key in the admin_counters table */
    key: string;
    /** text after the number, e.g. "times Devanshi agreed she likes ADDI" */
    label: string;
    perLogin: number;
    perView: number;
  };
}

export interface CollectionSeed {
  slug: string;
  title: string;
  description?: string;
  coverSource?: string;
}

export interface BrandSeed {
  name: string;
  /** defaults to a slug of the name */
  slug?: string;
  tags: string[];
  featured?: boolean;
  websiteUrl?: string;
  /** optional logo file inside /data */
  logoSource?: string;
}

export interface TestimonialSeed {
  quote: string;
  authorName?: string;
  authorRole?: string;
  brandSlug?: string;
}

export interface MediaSeed {
  source: string;
  kind: MediaKind;
  title: string;
  caption?: string;
  alt?: string;
  collection?: string; // collection slug
  brand?: string; // brand slug
  featured?: boolean;
  posterOffset?: number;
  /** link to the original post, e.g. https://www.instagram.com/reel/… */
  sourceUrl?: string;
}
