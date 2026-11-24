/**
 * Input/patch shapes shared by the admin UI (src/core/admin, src/app/admin) and
 * the server actions (src/core/actions). Zod schemas in src/core/schemas mirror these.
 */
import type { InquiryStatus, MediaEdits, MediaKind } from "./content";

/** Editable fields of a media item. */
export interface MediaPatch {
  kind?: MediaKind;
  title?: string | null;
  caption?: string | null;
  alt?: string | null;
  collectionId?: string | null;
  brandId?: string | null;
  featured?: boolean;
  published?: boolean;
  posterOffset?: number;
  /** null resets to the original */
  edits?: MediaEdits | null;
  /** link to the original post (http/https); null clears it */
  sourceUrl?: string | null;
}

export interface MediaFilter {
  kind?: MediaKind;
  collectionId?: string;
  brandId?: string;
  /** case-insensitive match on title / caption / public id */
  q?: string;
  published?: boolean;
}

export interface CollectionInput {
  slug: string;
  title: string;
  description: string | null;
  coverMediaId: string | null;
  published: boolean;
}

export interface BrandInput {
  slug: string;
  name: string;
  logoMediaId: string | null;
  websiteUrl: string | null;
  tags: string[];
  featured: boolean;
  published: boolean;
}

export interface TestimonialInput {
  quote: string;
  authorName: string | null;
  authorRole: string | null;
  brandId: string | null;
  avatarMediaId: string | null;
  published: boolean;
}

/** Public contact-form payload. */
export interface InquiryInput {
  name: string;
  email: string;
  company: string | null;
  budget: string | null;
  message: string;
}

export interface DashboardStats {
  media: number;
  published: number;
  collections: number;
  brands: number;
  testimonials: number;
  newInquiries: number;
}

export type { InquiryStatus };
