# Scripts

The scripts run with `tsx` and read `.env.local`, then `.env`. Variables already set in the shell take precedence. See `.env.example` for every variable.

There is no admin-account script. The admin panel has no user accounts: `/admin` opens with the single password in `ADMIN_PASSWORD`, set in `.env.local` locally and in Vercel's environment variables in production.

## `npm run seed`

This script uploads the active creator's media (`src/creators/active.ts`, files under `SEED_DATA_DIR`, default `./data`) to Cloudinary and fills Supabase. Run the migration first.

1. **Validate the manifest.** Every `media[].source` must exist with exact filename case. Every collection and brand slug must be known. Every `settingsMedia`, `coverSource` and `logoSource` path must also appear in `media[]`. No two files may map to the same public_id. If any check fails, the script lists every problem and exits 1 before touching the network.
2. **Compress oversize files** with ffmpeg into `.seed-cache/`. A video over `SEED_MAX_VIDEO_MB` (default 95) becomes H.264 MP4: the shorter side is scaled to 1080 (never upscaled), CRF 23, preset medium, AAC 128k, `+faststart`, with metadata stripped. An image over `SEED_MAX_IMAGE_MB` (default 9.5) becomes a JPEG at most 4000px on its long side, quality about 85. Cached outputs are reused, and ffmpeg is only needed when something must be encoded.
3. **Upload** to `<NEXT_PUBLIC_CLOUDINARY_FOLDER>/seed/<slug of the path>`. A short hash is added only when the slug would be cut off or come out empty. The script sets `public_id` and `asset_folder` and uses `upload_large` with 20 MB chunks for videos. It skips assets that already exist.
4. **Write the database** in this order: collections and brands, then media (keyed by `source_path`), then the collection cover and brand logo links, then testimonials (keyed by `seed_key` `<creator>-t<i>`), then site settings. The portrait, hero and OG image ids are resolved from `settingsMedia`.

| Flag | Effect |
| --- | --- |
| `--dry-run` (or `npm run seed:dry`) | Prints the plan: each file, its public_id and whether it will be compressed. No network, no ffmpeg, no credentials needed. |
| `--only-db` | Skips uploads and writes rows for the deterministic public_ids. If Cloudinary credentials are set, it reads the real metadata; otherwise it trusts that the assets exist. |
| `--force` | Re-uploads assets (overwrite plus CDN invalidate) and overwrites seeded rows, links and site settings. Combine it with `--only-db` to overwrite the database without re-uploading. |
| `--concurrency=N` | Sets the number of parallel uploads (1–8, default 2). ffmpeg encodes always run one at a time. |

**Re-runs are safe.** By default the seed only inserts what is missing. Assets already on Cloudinary are skipped, and existing collection, brand, media and testimonial rows are left alone. Cover and logo links are filled only where they are empty, and settings are written only while they are still `{}`. After the first seed the admin panel is the source of truth, so a re-run will not undo edits made there unless you pass `--force`. A file that fails does not stop the run: the script reports it at the end and exits 1, and the next run retries only what is missing. If a `settingsMedia` file failed, settings are not written, so a later run can fill them in.

**Cloudinary free plan limits:** videos over 100 MB and images over 10 MB are rejected, which is why the defaults are 95 / 9.5 (MiB). The plan has 25 monthly credits, where one credit is 1 GB of storage, 1 GB of bandwidth or 1,000 transformations. The current `/data` is about 2.1 GB raw and roughly 1 GB after compression, so avoid repeated `--force` runs. Video transformations, such as the posters and adaptive streaming the site uses, also count against the quota.

## Tests

```
npx tsx --test scripts/seed/plan.test.ts
```
