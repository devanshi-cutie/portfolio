/**
 * Writes the creator package into Supabase with the service-role client.
 *
 * Order (binding): collections + brands → media → cover/logo links →
 * testimonials → settings. Default is insert-missing-only so admin edits
 * survive a re-seed; `force` overwrites seeded rows.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CreatorPackage } from "@/creators/types";
import type { SiteSettings } from "@/core/types/content";
import { describeDbError } from "../lib/supabase";
import type { AssetMeta } from "./cloudinary";
import type { PlannedMedia, SeedPlan } from "./plan";

export interface DbReport {
  collections: WriteCount;
  brands: WriteCount;
  media: WriteCount;
  covers: number;
  logos: number;
  testimonials: WriteCount;
  settings: "written" | "kept" | "skipped";
  warnings: string[];
}

export interface WriteCount {
  /** rows inserted (or overwritten with force) */
  written: number;
  /** rows that already existed and were left alone */
  kept: number;
}

export class DbError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DbError";
  }
}

function check<T>(context: string, result: { data: T; error: { message: string; code?: string } | null }): T {
  if (result.error) throw new DbError(describeDbError(context, result.error));
  return result.data;
}

/** Cheap query that proves the URL/key work and the migration ran. */
export async function preflightDb(db: SupabaseClient): Promise<void> {
  check("Supabase check (site_settings)", await db.from("site_settings").select("id").limit(1));
}

async function idsBy(db: SupabaseClient, table: "collections" | "brands", slugs: string[]): Promise<Map<string, string>> {
  const rows = check(`read ${table}`, await db.from(table).select("id, slug").in("slug", slugs)) as {
    id: string;
    slug: string;
  }[];
  return new Map(rows.map((r) => [r.slug, r.id]));
}

function count(total: number, written: number): WriteCount {
  return { written, kept: Math.max(0, total - written) };
}

export interface SeedDbInput {
  creator: CreatorPackage;
  plan: SeedPlan;
  /** Cloudinary metadata per manifest source; files that failed are absent */
  assets: Map<string, AssetMeta>;
  force: boolean;
}

export async function writeDatabase(db: SupabaseClient, input: SeedDbInput): Promise<DbReport> {
  const { creator, plan, assets, force } = input;
  const ignoreDuplicates = !force;
  const warnings: string[] = [];

  /* ------------------------------------------- collections + brands */
  const collectionRows = creator.collections.map((c, i) => ({
    slug: c.slug,
    title: c.title,
    description: c.description ?? null,
    sort_order: i,
  }));
  const collectionsWritten = check(
    "upsert collections",
    await db.from("collections").upsert(collectionRows, { onConflict: "slug", ignoreDuplicates }).select("id"),
  ) as unknown[];

  const brandRows = creator.brands.map((b, i) => ({
    slug: plan.brandSlugs[i],
    name: b.name,
    website_url: b.websiteUrl ?? null,
    tags: b.tags,
    featured: b.featured ?? false,
    sort_order: i,
  }));
  const brandsWritten = check(
    "upsert brands",
    await db.from("brands").upsert(brandRows, { onConflict: "slug", ignoreDuplicates }).select("id"),
  ) as unknown[];

  const collectionIds = await idsBy(db, "collections", collectionRows.map((r) => r.slug));
  const brandIds = await idsBy(db, "brands", brandRows.map((r) => r.slug));

  /* ------------------------------------------------------------ media */
  const ready = plan.media.filter((m) => assets.has(m.source));
  const mediaRows = ready.map((m: PlannedMedia) => {
    const asset = assets.get(m.source)!;
    return {
      source_path: m.source,
      public_id: asset.publicId,
      resource_type: asset.resourceType,
      format: asset.format,
      width: asset.width === null ? null : Math.round(asset.width),
      height: asset.height === null ? null : Math.round(asset.height),
      duration: asset.duration,
      bytes: asset.bytes === null ? null : Math.round(asset.bytes),
      kind: m.seed.kind,
      title: m.seed.title,
      caption: m.seed.caption ?? null,
      alt: m.seed.alt ?? null,
      collection_id: m.seed.collection ? (collectionIds.get(m.seed.collection) ?? null) : null,
      brand_id: m.seed.brand ? (brandIds.get(m.seed.brand) ?? null) : null,
      featured: m.seed.featured ?? false,
      sort_order: m.index,
      poster_offset: m.seed.posterOffset ?? 0,
    };
  });
  let mediaWritten: unknown[] = [];
  if (mediaRows.length > 0) {
    mediaWritten = check(
      "upsert media",
      await db.from("media").upsert(mediaRows, { onConflict: "source_path", ignoreDuplicates }).select("id"),
    ) as unknown[];
  }

  // ids for every seeded path, including rows from earlier runs
  const mediaIdRows = check(
    "read media",
    await db.from("media").select("id, source_path").not("source_path", "is", null),
  ) as { id: string; source_path: string }[];
  const mediaIds = new Map(mediaIdRows.map((r) => [r.source_path, r.id]));

  const mediaIdFor = (source: string | undefined, where: string): string | null => {
    if (!source) return null;
    const id = mediaIds.get(source);
    if (!id) warnings.push(`${where}: "${source}" has no media row (upload failed?) — left empty`);
    return id ?? null;
  };

  /* ------------------------------------------------ cover / logo links */
  let covers = 0;
  for (const c of creator.collections) {
    const mediaId = mediaIdFor(c.coverSource, `collection "${c.slug}" cover`);
    if (!mediaId) continue;
    let query = db.from("collections").update({ cover_media_id: mediaId }).eq("slug", c.slug);
    if (!force) query = query.is("cover_media_id", null);
    const rows = check(`set cover for collection "${c.slug}"`, await query.select("id")) as unknown[];
    covers += rows.length;
  }

  let logos = 0;
  for (const [i, b] of creator.brands.entries()) {
    const slug = plan.brandSlugs[i];
    const mediaId = mediaIdFor(b.logoSource, `brand "${slug}" logo`);
    if (!mediaId) continue;
    let query = db.from("brands").update({ logo_media_id: mediaId }).eq("slug", slug);
    if (!force) query = query.is("logo_media_id", null);
    const rows = check(`set logo for brand "${slug}"`, await query.select("id")) as unknown[];
    logos += rows.length;
  }

  /* ----------------------------------------------------- testimonials */
  const testimonialRows = creator.testimonials.map((t, i) => ({
    seed_key: `${creator.id}-t${i}`,
    quote: t.quote,
    author_name: t.authorName ?? null,
    author_role: t.authorRole ?? null,
    brand_id: t.brandSlug ? (brandIds.get(t.brandSlug) ?? null) : null,
    sort_order: i,
  }));
  let testimonialsWritten: unknown[] = [];
  if (testimonialRows.length > 0) {
    testimonialsWritten = check(
      "upsert testimonials",
      await db.from("testimonials").upsert(testimonialRows, { onConflict: "seed_key", ignoreDuplicates }).select("id"),
    ) as unknown[];
  }

  /* --------------------------------------------------------- settings */
  let settings: DbReport["settings"] = "kept";
  const current = check(
    "read site_settings",
    await db.from("site_settings").select("data").eq("id", 1).maybeSingle(),
  ) as { data: unknown } | null;
  const isEmpty =
    !current ||
    current.data === null ||
    (typeof current.data === "object" && Object.keys(current.data as object).length === 0);

  if (isEmpty || force) {
    const sm = creator.settingsMedia;
    const unresolved = (
      [
        ["portraitSource", sm.portraitSource],
        ["heroSource", sm.heroSource],
        ["ogImageSource", sm.ogImageSource],
      ] as const
    ).filter(([, source]) => source && !mediaIds.has(source));

    if (unresolved.length > 0) {
      // Writing now would lock in null media ids (settings are only written while empty).
      settings = "skipped";
      warnings.push(
        `site settings not written: ${unresolved.map(([k, s]) => `${k} "${s}"`).join(", ")} has no media row — fix the upload and re-run`,
      );
    } else {
      const data: SiteSettings = structuredClone(creator.settings);
      data.identity.portraitMediaId = sm.portraitSource ? mediaIds.get(sm.portraitSource)! : data.identity.portraitMediaId;
      data.identity.heroMediaId = sm.heroSource ? mediaIds.get(sm.heroSource)! : data.identity.heroMediaId;
      data.seo.ogImageMediaId = sm.ogImageSource ? mediaIds.get(sm.ogImageSource)! : data.seo.ogImageMediaId;
      check("write site_settings", await db.from("site_settings").upsert({ id: 1, data }, { onConflict: "id" }));
      settings = "written";
    }
  }

  return {
    collections: count(collectionRows.length, collectionsWritten.length),
    brands: count(brandRows.length, brandsWritten.length),
    media: count(mediaRows.length, mediaWritten.length),
    covers,
    logos,
    testimonials: count(testimonialRows.length, testimonialsWritten.length),
    settings,
    warnings,
  };
}
