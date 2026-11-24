/**
 * npm run seed — uploads the active creator's /data media to Cloudinary and
 * fills Supabase. See scripts/README.md for flags and re-run behaviour.
 *
 * Imports only @/creators/*, @/core/types/* and @/core/lib/slug from the app;
 * everything else (clients, env) is built here so no `server-only` module loads.
 */
import path from "node:path";
import creator from "@/creators/active";
import { UserError, exitWithError, flushAndExit, loadEnv, missingEnv, readEnv, readNumberEnv } from "../lib/env";
import { SUPABASE_ENV, createServiceClient } from "../lib/supabase";
import { USAGE, parseArgs, type SeedArgs } from "./args";
import {
  configureCloudinary,
  findAsset,
  pingCloudinary,
  readCloudinaryCredentials,
  uploadAsset,
  type AssetMeta,
} from "./cloudinary";
import { cachePathFor, ensureFfmpeg, isCached, prepareFile } from "./compress";
import { DbError, preflightDb, writeDatabase, type DbReport, type WriteCount } from "./db";
import { MB, buildPlan, normalizeFolderRoot, type PlannedMedia, type SeedPlan } from "./plan";
import { runPool } from "./pool";

interface Settings {
  dataDir: string;
  cacheDir: string;
  folderRoot: string;
  maxVideoBytes: number;
  maxImageBytes: number;
}

interface FileFailure {
  source: string;
  message: string;
}

const mb = (bytes: number | null) => (bytes === null ? "?" : `${(bytes / MB).toFixed(1)} MB`);

function readSettings(): Settings {
  const rawFolder = readEnv("NEXT_PUBLIC_CLOUDINARY_FOLDER") ?? creator.id;
  const folderRoot = normalizeFolderRoot(rawFolder);
  if (!folderRoot) {
    throw new UserError(
      `NEXT_PUBLIC_CLOUDINARY_FOLDER "${rawFolder}" is not a valid folder (letters, digits, "-", "_" and "/" only).`,
    );
  }
  return {
    dataDir: path.resolve(readEnv("SEED_DATA_DIR") ?? "data"),
    cacheDir: path.resolve(".seed-cache"),
    folderRoot,
    maxVideoBytes: readNumberEnv("SEED_MAX_VIDEO_MB", 95) * MB,
    maxImageBytes: readNumberEnv("SEED_MAX_IMAGE_MB", 9.5) * MB,
  };
}

/* ------------------------------------------------------------ dry run */

function printPlan(plan: SeedPlan, settings: Settings): void {
  const width = String(plan.media.length).length;
  console.log(`\nMedia (${plan.media.length} files):`);
  for (const m of plan.media) {
    const n = String(m.index + 1).padStart(width);
    const action = m.compress ? "compress" : "upload";
    const cache = m.compress ? (isCached(m, settings.cacheDir) ? "  [cached]" : "  [will encode]") : "";
    console.log(
      `  [${n}] ${action.padEnd(8)} ${m.resourceType.padEnd(5)} ${mb(m.bytes).padStart(9)}  ${m.source}\n` +
        `  ${" ".repeat(width + 2)} ${"".padEnd(8)} → ${m.publicId}${cache}`,
    );
  }

  const toCompress = plan.media.filter((m) => m.compress);
  console.log(
    `\nCompression (videos > ${mb(settings.maxVideoBytes)}, images > ${mb(settings.maxImageBytes)}): ${toCompress.length} file(s)`,
  );
  for (const m of toCompress) {
    console.log(`  - ${m.source} (${mb(m.bytes)}) → ${path.relative(process.cwd(), cachePathFor(m, settings.cacheDir))}`);
  }

  const total = plan.media.reduce((sum, m) => sum + m.bytes, 0);
  const sm = creator.settingsMedia;
  console.log(`
Database (insert-missing-only; --force overwrites):
  collections   ${creator.collections.length}
  brands        ${creator.brands.length}
  media         ${plan.media.length}  (keyed by source_path)
  testimonials  ${creator.testimonials.length}  (seed_key ${creator.id}-t0 … ${creator.id}-t${Math.max(0, creator.testimonials.length - 1)})
  settings      portrait ← ${sm.portraitSource ?? "—"}, hero ← ${sm.heroSource ?? "—"}, og image ← ${sm.ogImageSource ?? "—"}

Source total: ${mb(total)} · Cloudinary folder: ${plan.assetFolder}`);

  const missingDb = missingEnv(SUPABASE_ENV);
  const cloud = readCloudinaryCredentials();
  const missingCloud = "missing" in cloud ? cloud.missing : [];
  const missing = [...missingDb, ...missingCloud];
  console.log(
    missing.length === 0
      ? "Credentials: all present."
      : `Credentials needed for a real run (not set): ${missing.join(", ")}`,
  );
  console.log("\nDry run: nothing was compressed, uploaded or written.");
}

/* ----------------------------------------------------------- real run */

function fallbackMeta(m: PlannedMedia): AssetMeta {
  const format = m.compress ? (m.resourceType === "video" ? "mp4" : "jpg") : m.extension === "jpeg" ? "jpg" : m.extension;
  return { publicId: m.publicId, resourceType: m.resourceType, format, width: null, height: null, duration: null, bytes: null };
}

function describeAsset(a: AssetMeta): string {
  const parts = [mb(a.bytes)];
  if (a.width && a.height) parts.push(`${a.width}×${a.height}`);
  if (a.duration) parts.push(`${a.duration.toFixed(1)}s`);
  return parts.join(" · ");
}

async function processFiles(
  plan: SeedPlan,
  settings: Settings,
  args: SeedArgs,
  cloudinaryReady: boolean,
): Promise<{ assets: Map<string, AssetMeta>; failures: FileFailure[]; counts: Record<string, number> }> {
  const assets = new Map<string, AssetMeta>();
  const failures: FileFailure[] = [];
  const counts = { uploaded: 0, skipped: 0, compressed: 0, trusted: 0 };
  const width = String(plan.media.length).length;
  let done = 0;
  const line = (action: string, m: PlannedMedia, detail: string) =>
    console.log(`  [${String(++done).padStart(width)}/${plan.media.length}] ${action.padEnd(8)} ${m.source}  ${detail}`);

  await runPool(plan.media, args.concurrency, async (m) => {
    try {
      if (args.onlyDb) {
        const found = cloudinaryReady ? await findAsset(m.publicId, m.resourceType) : null;
        if (cloudinaryReady && !found) {
          console.warn(`  ! ${m.source}: ${m.publicId} is not on Cloudinary — writing the row anyway`);
        }
        assets.set(m.source, found ?? fallbackMeta(m));
        counts.trusted++;
        line("db-only", m, `→ ${m.publicId}${found ? ` (${describeAsset(found)})` : ""}`);
        return;
      }

      if (!args.force) {
        const existing = await findAsset(m.publicId, m.resourceType);
        if (existing) {
          assets.set(m.source, existing);
          counts.skipped++;
          line("skip", m, `exists → ${m.publicId}`);
          return;
        }
      }

      if (m.compress && !isCached(m, settings.cacheDir)) {
        console.log(`  … compress ${m.source} (${mb(m.bytes)}) — this can take a while`);
      }
      const prepared = await prepareFile(m, {
        cacheDir: settings.cacheDir,
        maxVideoBytes: settings.maxVideoBytes,
        maxImageBytes: settings.maxImageBytes,
        onProgress: (msg) => console.log(`  … ${msg}`),
      });
      if (prepared.compressed) {
        counts.compressed++;
        console.log(
          `  … compress ${m.source}: ${mb(m.bytes)} → ${mb(prepared.bytes)}${prepared.cached ? " (cached)" : ""}`,
        );
      }

      const uploaded = await uploadAsset({
        filePath: prepared.uploadPath,
        bytes: prepared.bytes,
        publicId: m.publicId,
        assetFolder: plan.assetFolder,
        resourceType: m.resourceType,
        overwrite: args.force,
      });
      assets.set(m.source, uploaded);
      counts.uploaded++;
      line("upload", m, `→ ${uploaded.publicId} (${describeAsset(uploaded)})`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      failures.push({ source: m.source, message });
      line("FAIL", m, message);
    }
  });

  return { assets, failures, counts };
}

function fmtCount(c: WriteCount, force: boolean): string {
  return `${c.written} ${force ? "written" : "new"}${c.kept ? `, ${c.kept} kept` : ""}`;
}

function printDbReport(report: DbReport, force: boolean): void {
  console.log(`
Database:
  collections   ${fmtCount(report.collections, force)}
  brands        ${fmtCount(report.brands, force)}
  media         ${fmtCount(report.media, force)}
  covers/logos  ${report.covers} cover(s), ${report.logos} logo(s) linked
  testimonials  ${fmtCount(report.testimonials, force)}
  settings      ${report.settings === "kept" ? "kept (already set; use --force to overwrite)" : report.settings}`);
  for (const w of report.warnings) console.warn(`  ! ${w}`);
}

async function run(): Promise<number> {
  loadEnv();
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(USAGE);
    return 0;
  }

  const settings = readSettings();
  const mode = [args.dryRun && "dry run", args.onlyDb && "db only", args.force && "force"].filter(Boolean).join(", ");
  console.log(`Seeding creator "${creator.id}"${mode ? ` (${mode})` : ""}`);
  console.log(`  data:   ${settings.dataDir}`);
  console.log(`  folder: ${settings.folderRoot}/seed`);

  const result = buildPlan(creator, settings);
  if (!result.ok) {
    console.error(`\nManifest check failed (${result.errors.length} problem${result.errors.length === 1 ? "" : "s"}):`);
    for (const e of result.errors) console.error(`  - ${e}`);
    throw new UserError("Fix the creator package (src/creators/) or SEED_DATA_DIR and re-run. Nothing was uploaded or written.");
  }
  const plan = result.plan;
  console.log(`  manifest OK: ${plan.media.length} files, no public_id collisions`);

  if (args.dryRun) {
    printPlan(plan, settings);
    return 0;
  }

  // credentials and connectivity before touching anything
  const db = createServiceClient();
  const cloud = readCloudinaryCredentials();
  let cloudinaryReady = false;
  if ("missing" in cloud) {
    if (!args.onlyDb) {
      throw new UserError(`Missing ${cloud.missing.join(", ")}. Add them to .env.local, or use --only-db.`);
    }
  } else {
    configureCloudinary(cloud);
    cloudinaryReady = true;
  }

  try {
    await preflightDb(db);
    if (cloudinaryReady) await pingCloudinary();
  } catch (error) {
    throw new UserError(error instanceof Error ? error.message : String(error));
  }

  if (!args.onlyDb && plan.media.some((m) => m.compress && !isCached(m, settings.cacheDir))) {
    try {
      await ensureFfmpeg();
    } catch (error) {
      throw new UserError((error as Error).message);
    }
  }

  console.log(`\nFiles (concurrency ${args.concurrency}):`);
  const { assets, failures, counts } = await processFiles(plan, settings, args, cloudinaryReady);

  let dbFailed = false;
  try {
    const report = await writeDatabase(db, { creator, plan, assets, force: args.force });
    printDbReport(report, args.force);
  } catch (error) {
    dbFailed = true;
    const message = error instanceof DbError || error instanceof Error ? error.message : String(error);
    console.error(`\n✖ Database step failed: ${message}`);
  }

  console.log(
    `\nSummary: ${counts.uploaded} uploaded, ${counts.skipped} skipped (already on Cloudinary), ` +
      `${counts.compressed} compressed${args.onlyDb ? `, ${counts.trusted} db-only` : ""}, ${failures.length} failed.`,
  );
  if (failures.length > 0) {
    console.error("\nFailed files (re-run to retry; finished files are skipped):");
    for (const f of failures) console.error(`  - ${f.source}: ${f.message}`);
  }
  return failures.length > 0 || dbFailed ? 1 : 0;
}

run().then(
  (code) => flushAndExit(code),
  (error) => exitWithError(error),
);
