/**
 * Row <-> domain mapping. DB rows are snake_case; domain types are camelCase.
 * Mappers are defensive about numeric columns (`numeric` arrives as a string
 * from PostgREST in some configurations).
 */
import { normalizeEdits } from "@/core/lib/media-edits";
import type { BrandInput, CollectionInput, MediaPatch, TestimonialInput } from "@/core/types/admin";
import type {
  Brand,
  Collection,
  Inquiry,
  InquiryStatus,
  MediaItem,
  MediaKind,
  ResourceType,
  Testimonial,
} from "@/core/types/content";

/* --------------------------------------------------------------- rows */

export interface MediaRow {
  id: string;
  public_id: string;
  resource_type: ResourceType;
  format: string | null;
  width: number | null;
  height: number | null;
  duration: number | string | null;
  bytes: number | string | null;
  kind: MediaKind;
  title: string | null;
  caption: string | null;
  alt: string | null;
  collection_id: string | null;
  brand_id: string | null;
  featured: boolean;
  published: boolean;
  sort_order: number;
  poster_offset: number | string | null;
  /** MediaEdits JSON; normalized on read so bad stored data never crashes */
  edits?: unknown;
  source_path?: string | null;
  /** absent until migration 20261125000000 has run */
  source_url?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CollectionRow {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  cover_media_id: string | null;
  sort_order: number;
  published: boolean;
}

export interface BrandRow {
  id: string;
  slug: string;
  name: string;
  logo_media_id: string | null;
  website_url: string | null;
  tags: string[] | null;
  featured: boolean;
  sort_order: number;
  published: boolean;
}

export interface TestimonialRow {
  id: string;
  quote: string;
  author_name: string | null;
  author_role: string | null;
  brand_id: string | null;
  avatar_media_id: string | null;
  sort_order: number;
  published: boolean;
}

export interface InquiryRow {
  id: string;
  name: string;
  email: string;
  company: string | null;
  budget: string | null;
  message: string;
  status: InquiryStatus;
  created_at: string;
}

/**
 * Column lists, so selects never pull provenance or unknown columns.
 *
 * Media is the exception: it selects `*` so reads keep working on a database
 * that does not have a newly added column yet (e.g. `source_url` between a
 * deploy and its migration). Naming a missing column fails the whole query
 * (Postgres 42703); `*` just omits it and `mapMedia()` falls back to a default.
 * `mapMedia()` whitelists fields, so extra columns such as `source_path` never
 * reach a MediaItem.
 *
 * Public reads rely on anon's table-level SELECT grant on public.media
 * (supabase/migrations/20261124000000_init.sql); a column-level grant would
 * break `*`. TODO: once 20261125000000_media_source_url.sql has run on every
 * database, go back to an explicit column list that includes source_url.
 */
export const MEDIA_COLUMNS = "*";
export const COLLECTION_COLUMNS = "id, slug, title, description, cover_media_id, sort_order, published";
export const BRAND_COLUMNS = "id, slug, name, logo_media_id, website_url, tags, featured, sort_order, published";
export const TESTIMONIAL_COLUMNS =
  "id, quote, author_name, author_role, brand_id, avatar_media_id, sort_order, published";
export const INQUIRY_COLUMNS = "id, name, email, company, budget, message, status, created_at";

/* ----------------------------------------------------------- row -> type */

const num = (v: number | string | null | undefined): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
};

export function mapMedia(row: MediaRow): MediaItem {
  return {
    id: row.id,
    publicId: row.public_id,
    resourceType: row.resource_type,
    format: row.format,
    width: num(row.width),
    height: num(row.height),
    duration: num(row.duration),
    bytes: num(row.bytes),
    kind: row.kind,
    title: row.title,
    caption: row.caption,
    alt: row.alt,
    collectionId: row.collection_id,
    brandId: row.brand_id,
    featured: row.featured,
    published: row.published,
    sortOrder: row.sort_order,
    posterOffset: num(row.poster_offset) ?? 0,
    edits: normalizeEdits(row.edits),
    sourceUrl: row.source_url ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapCollection(row: CollectionRow): Collection {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    coverMediaId: row.cover_media_id,
    sortOrder: row.sort_order,
    published: row.published,
  };
}

export function mapBrand(row: BrandRow): Brand {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    logoMediaId: row.logo_media_id,
    websiteUrl: row.website_url,
    tags: row.tags ?? [],
    featured: row.featured,
    sortOrder: row.sort_order,
    published: row.published,
  };
}

export function mapTestimonial(row: TestimonialRow): Testimonial {
  return {
    id: row.id,
    quote: row.quote,
    authorName: row.author_name,
    authorRole: row.author_role,
    brandId: row.brand_id,
    avatarMediaId: row.avatar_media_id,
    sortOrder: row.sort_order,
    published: row.published,
  };
}

export function mapInquiry(row: InquiryRow): Inquiry {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    company: row.company,
    budget: row.budget,
    message: row.message,
    status: row.status,
    createdAt: row.created_at,
  };
}

/* ---------------------------------------------------------- type -> row */

/** Only keys present in the patch are written (undefined = leave unchanged). */
function pick<T extends object>(source: T, map: { [K in keyof T]?: string }): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(map) as (keyof T)[]) {
    const value = source[key];
    if (value !== undefined) out[map[key] as string] = value;
  }
  return out;
}

const blankToNull = (v: string | null | undefined): string | null | undefined =>
  v === undefined ? undefined : v === null || v.trim() === "" ? null : v;

export function mediaPatchToRow(patch: MediaPatch): Record<string, unknown> {
  return pick(
    {
      ...patch,
      title: blankToNull(patch.title),
      caption: blankToNull(patch.caption),
      alt: blankToNull(patch.alt),
      sourceUrl: blankToNull(patch.sourceUrl),
      // null clears; all-default edits are stored as null too
      edits: patch.edits === undefined ? undefined : normalizeEdits(patch.edits),
    },
    {
      kind: "kind",
      title: "title",
      caption: "caption",
      alt: "alt",
      collectionId: "collection_id",
      brandId: "brand_id",
      featured: "featured",
      published: "published",
      posterOffset: "poster_offset",
      edits: "edits",
      sourceUrl: "source_url",
    },
  );
}

export function collectionInputToRow(input: Partial<CollectionInput>): Record<string, unknown> {
  return pick(
    { ...input, description: blankToNull(input.description) },
    {
      slug: "slug",
      title: "title",
      description: "description",
      coverMediaId: "cover_media_id",
      published: "published",
    },
  );
}

export function brandInputToRow(input: Partial<BrandInput>): Record<string, unknown> {
  return pick(
    {
      ...input,
      websiteUrl: blankToNull(input.websiteUrl),
      tags: input.tags ? Array.from(new Set(input.tags.map((t) => t.trim().toLowerCase()).filter(Boolean))) : undefined,
    },
    {
      slug: "slug",
      name: "name",
      logoMediaId: "logo_media_id",
      websiteUrl: "website_url",
      tags: "tags",
      featured: "featured",
      published: "published",
    },
  );
}

export function testimonialInputToRow(input: Partial<TestimonialInput>): Record<string, unknown> {
  return pick(
    { ...input, authorName: blankToNull(input.authorName), authorRole: blankToNull(input.authorRole) },
    {
      quote: "quote",
      authorName: "author_name",
      authorRole: "author_role",
      brandId: "brand_id",
      avatarMediaId: "avatar_media_id",
      published: "published",
    },
  );
}
