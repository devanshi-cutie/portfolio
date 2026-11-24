/**
 * Builds the seed plan from a creator package and validates it against the
 * files on disk. Pure apart from read-only `fs` calls, so it runs in --dry-run
 * with no credentials and is unit-tested in plan.test.ts.
 */
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { CreatorPackage, MediaSeed } from "@/creators/types";
import { MEDIA_KINDS, type ResourceType } from "@/core/types/content";
import { slugify } from "@/core/lib/slug";

export const MB = 1024 * 1024;

const VIDEO_EXTENSIONS = new Set(["mp4", "mov", "m4v", "webm", "mkv", "avi", "3gp"]);
const IMAGE_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp", "gif", "heic", "heif", "avif", "tif", "tiff"]);

/** slugify() truncates at 80 chars; anything at the cap may have lost its tail, so it gets a hash. */
const SLUG_CAP = 80;
const SLUG_KEEP = 70;

export interface PlanOptions {
  /** absolute path of the folder holding the creator's media */
  dataDir: string;
  /** Cloudinary root folder, e.g. "devanshi" */
  folderRoot: string;
  maxVideoBytes: number;
  maxImageBytes: number;
}

export interface PlannedMedia {
  /** position in creator.media (drives sort_order) */
  index: number;
  seed: MediaSeed;
  /** the manifest path, relative to dataDir; stored as media.source_path */
  source: string;
  absPath: string;
  bytes: number;
  mtimeMs: number;
  resourceType: ResourceType;
  extension: string;
  publicId: string;
  /** over the size limit for its resource type, so it is compressed before upload */
  compress: boolean;
}

export interface SeedPlan {
  creatorId: string;
  folderRoot: string;
  /** Cloudinary asset folder for seed uploads (dynamic-folder accounts) */
  assetFolder: string;
  dataDir: string;
  media: PlannedMedia[];
  /** resolved brand slug for each entry of creator.brands, same order */
  brandSlugs: string[];
}

export type PlanResult = { ok: true; plan: SeedPlan } | { ok: false; errors: string[] };

export function shortHash(input: string): string {
  return createHash("sha1").update(input.normalize("NFC")).digest("hex").slice(0, 8);
}

export function brandSlug(brand: { name: string; slug?: string }): string {
  return brand.slug ?? slugify(brand.name);
}

/** Lower-cased extension without the dot, e.g. "IMG_3603.JPG.jpeg" -> "jpeg". */
export function extensionOf(source: string): string {
  const base = source.split("/").pop() ?? source;
  const dot = base.lastIndexOf(".");
  return dot > 0 ? base.slice(dot + 1).toLowerCase() : "";
}

export function resourceTypeOf(source: string): ResourceType | null {
  const ext = extensionOf(source);
  if (VIDEO_EXTENSIONS.has(ext)) return "video";
  if (IMAGE_EXTENSIONS.has(ext)) return "image";
  return null;
}

/**
 * Normalises and validates the Cloudinary root folder ("devanshi", "clients/devanshi").
 * Returns null when it contains characters that would be unsafe in a public_id.
 */
export function normalizeFolderRoot(raw: string): string | null {
  const folder = raw.trim().replace(/^\/+|\/+$/g, "");
  return /^[A-Za-z0-9_-]+(\/[A-Za-z0-9_-]+)*$/.test(folder) ? folder : null;
}

/**
 * Deterministic public_id for a manifest path:
 * `<root>/seed/<slugify(path without extension)>`, with a short hash of the full
 * path appended when the slug is empty or may have been truncated. The result
 * depends only on the path, so re-runs and manifest edits never move an asset.
 */
export function seedPublicId(folderRoot: string, source: string): string {
  const withoutExt = source.replace(/\.[^./]+$/, "");
  let slug = slugify(withoutExt);
  if (!slug) {
    slug = `file-${shortHash(source)}`;
  } else if (slug.length >= SLUG_CAP) {
    slug = `${slug.slice(0, SLUG_KEEP).replace(/-+$/, "")}-${shortHash(source)}`;
  }
  return `${folderRoot}/seed/${slug}`;
}

/** Read-only directory listing cache, used for exact-case path checks. */
class DirCache {
  private entries = new Map<string, string[] | null>();

  list(dir: string): string[] | null {
    if (!this.entries.has(dir)) {
      try {
        this.entries.set(dir, fs.readdirSync(dir));
      } catch {
        this.entries.set(dir, null);
      }
    }
    return this.entries.get(dir)!;
  }
}

/**
 * Resolves a manifest path inside dataDir and checks it exists with the exact
 * same case (Windows and macOS are case-insensitive, Linux CI is not).
 */
function locate(dataDir: string, source: string, dirs: DirCache): { absPath: string } | { error: string } {
  if (source.includes("\\")) return { error: `"${source}": use "/" as the path separator` };
  const segments = source.split("/");
  if (path.isAbsolute(source) || segments.some((s) => s === "" || s === "." || s === "..")) {
    return { error: `"${source}": must be a plain relative path inside the data folder` };
  }
  let current = dataDir;
  for (const [i, segment] of segments.entries()) {
    const listing = dirs.list(current);
    if (!listing || !listing.includes(segment)) {
      const near = listing?.find((entry) => entry.toLowerCase() === segment.toLowerCase());
      const where = segments.slice(0, i + 1).join("/");
      const isFolder = i < segments.length - 1;
      return {
        error: near
          ? `"${source}": case mismatch — disk has "${near}" for "${where}"`
          : `"${source}": ${isFolder ? `folder "${where}"` : "file"} not found in the data folder`,
      };
    }
    current = path.join(current, segment);
  }
  return { absPath: current };
}

export function buildPlan(creator: CreatorPackage, options: PlanOptions): PlanResult {
  const errors: string[] = [];
  const { dataDir, folderRoot } = options;

  if (!fs.existsSync(dataDir) || !fs.statSync(dataDir).isDirectory()) {
    return { ok: false, errors: [`Data folder not found: ${dataDir} (set SEED_DATA_DIR)`] };
  }

  /* ----------------------------------------------------- collections */
  const collectionSlugs = new Set<string>();
  creator.collections.forEach((c, i) => {
    if (!c.slug || slugify(c.slug) !== c.slug) {
      errors.push(`collections[${i}] "${c.title}": slug "${c.slug}" is not a valid slug (expected "${slugify(c.slug || c.title)}")`);
    }
    if (collectionSlugs.has(c.slug)) errors.push(`collections[${i}]: duplicate slug "${c.slug}"`);
    collectionSlugs.add(c.slug);
  });

  /* ---------------------------------------------------------- brands */
  const brandSlugs = creator.brands.map(brandSlug);
  const brandSet = new Set<string>();
  creator.brands.forEach((b, i) => {
    const slug = brandSlugs[i];
    if (!slug || slugify(slug) !== slug) {
      errors.push(`brands[${i}] "${b.name}": slug "${slug}" is not a valid slug`);
    }
    if (brandSet.has(slug)) errors.push(`brands[${i}] "${b.name}": duplicate slug "${slug}"`);
    brandSet.add(slug);
  });

  /* ----------------------------------------------------------- media */
  const dirs = new DirCache();
  const media: PlannedMedia[] = [];
  const sources = new Set<string>();
  const byPublicId = new Map<string, string[]>();

  creator.media.forEach((seed, index) => {
    const label = `media[${index}]`;
    const source = seed.source;
    if (sources.has(source)) {
      errors.push(`${label}: "${source}" is listed more than once`);
      return;
    }
    sources.add(source);

    if (!MEDIA_KINDS.includes(seed.kind)) errors.push(`${label} "${source}": unknown kind "${seed.kind}"`);
    if (seed.collection && !collectionSlugs.has(seed.collection)) {
      errors.push(`${label} "${source}": unknown collection slug "${seed.collection}"`);
    }
    if (seed.brand && !brandSet.has(seed.brand)) {
      errors.push(`${label} "${source}": unknown brand slug "${seed.brand}"`);
    }

    const resourceType = resourceTypeOf(source);
    if (!resourceType) {
      errors.push(`${label} "${source}": unsupported file extension ".${extensionOf(source)}"`);
      return;
    }

    const found = locate(dataDir, source, dirs);
    if ("error" in found) {
      errors.push(`${label} ${found.error}`);
      return;
    }
    const stat = fs.statSync(found.absPath);
    if (!stat.isFile()) {
      errors.push(`${label} "${source}": is not a file`);
      return;
    }

    const publicId = seedPublicId(folderRoot, source);
    byPublicId.set(publicId, [...(byPublicId.get(publicId) ?? []), source]);

    const limit = resourceType === "video" ? options.maxVideoBytes : options.maxImageBytes;
    media.push({
      index,
      seed,
      source,
      absPath: found.absPath,
      bytes: stat.size,
      mtimeMs: stat.mtimeMs,
      resourceType,
      extension: extensionOf(source),
      publicId,
      compress: stat.size > limit,
    });
  });

  for (const [publicId, paths] of byPublicId) {
    if (paths.length > 1) {
      errors.push(`public_id collision "${publicId}" between ${paths.map((p) => `"${p}"`).join(" and ")} — rename one file`);
    }
  }

  /* ------------------------------------------------ media references */
  const needSource = (where: string, source: string | undefined) => {
    if (source !== undefined && !sources.has(source)) {
      errors.push(`${where}: "${source}" is not listed in media[]`);
    }
  };
  needSource("settingsMedia.portraitSource", creator.settingsMedia.portraitSource);
  needSource("settingsMedia.heroSource", creator.settingsMedia.heroSource);
  needSource("settingsMedia.ogImageSource", creator.settingsMedia.ogImageSource);
  creator.collections.forEach((c) => needSource(`collections "${c.slug}" coverSource`, c.coverSource));
  creator.brands.forEach((b, i) => needSource(`brands "${brandSlugs[i]}" logoSource`, b.logoSource));

  creator.testimonials.forEach((t, i) => {
    if (t.brandSlug && !brandSet.has(t.brandSlug)) {
      errors.push(`testimonials[${i}]: unknown brand slug "${t.brandSlug}"`);
    }
  });

  if (errors.length > 0) return { ok: false, errors };

  return {
    ok: true,
    plan: {
      creatorId: creator.id,
      folderRoot,
      assetFolder: `${folderRoot}/seed`,
      dataDir,
      media,
      brandSlugs,
    },
  };
}
