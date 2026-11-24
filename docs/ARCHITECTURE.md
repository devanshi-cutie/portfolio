# Architecture

A reusable **creator-portfolio engine**. One codebase, three swap points:

| Layer | Folder | Changes per creator? |
| --- | --- | --- |
| **Core** — types, data access, admin panel, Cloudinary, auth, actions, seed | `src/core/`, `src/app/admin/`, `src/app/api/`, `scripts/`, `supabase/` | No |
| **Theme** — the public site's look, layout and motion | `src/themes/<theme-id>/` (+ thin routes in `src/app/(site)/`) | Yes — copy or write a new theme |
| **Creator package** — initial copy, brands, testimonials, media manifest | `src/creators/<creator-id>/` | Yes |

To launch a site for another creator: add `src/creators/<id>/`, point `src/creators/active.ts` at it, optionally add a theme and point `src/themes/active.ts` at it, set env vars, run the migration, `npm run seed`, set `ADMIN_PASSWORD`. After seeding, **the admin panel is the source of truth**.

Stack: Next.js 16.4 (App Router, `cacheComponents: true`, Turbopack), React 19.3, TypeScript, Tailwind v4, Supabase (Postgres + Auth), Cloudinary (all media), Vercel (hosting), `motion` + `gsap` for animation.

> **Next 16 is newer than most training data.** Before writing Next-specific code read the bundled docs in `node_modules/next/dist/docs/01-app/` — especially `01-getting-started/08-caching.md`, `09-revalidating.md`, `07-mutating-data.md`, `16-proxy.md` (middleware is now `proxy.ts`), `02-guides/authentication-with-cache-components.md`, and `03-api-reference` entries for `use cache`, `cacheTag`, `cacheLife`, `revalidateTag`/`updateTag`. With `cacheComponents` on, dynamic data (cookies, headers) must sit under `<Suspense>`.

## Storage split

- **Cloudinary**: every binary (videos, photos, logos, portraits). Folder root `NEXT_PUBLIC_CLOUDINARY_FOLDER` (default `devanshi`), sub-folders `media/`, `logos/`, `seed/`.
- **Supabase Postgres**: metadata, ordering, copy, settings, inquiries. Schema: `supabase/migrations/20261124000000_init.sql` (tables `site_settings` (singleton jsonb), `collections`, `brands`, `media`, `testimonials`, `inquiries`; RLS: anon reads published rows only; there are no write policies and no anon access to `inquiries` — the server-side service role does every write, including contact-form inserts).
- **Admin auth**: a single password in the `ADMIN_PASSWORD` env var (set in Vercel). `/admin/login` checks it (timing-safe, per-IP lockout) and sets an HMAC-signed, httpOnly session cookie (`src/core/auth/session.ts`, 7 days; key from `ADMIN_SESSION_SECRET` or derived from the password, so changing the password signs everyone out). Supabase Auth is not used. After `requireAdmin()` passes, admin reads and writes use the **service-role** client on the server; the browser never holds a Supabase key with write access.
- **Git**: code only. `/data`, `.env*` (except `.env.example`) and `/.seed-cache` are ignored.

## Contracts (already written — do not change shapes without coordinating)

- `src/core/types/content.ts` — all domain types incl. `SiteContent` (what a theme receives).
- `src/core/lib/slug.ts` — `slugify()`; brand/collection slugs everywhere use it.
- `src/creators/types.ts` — `CreatorPackage`; `src/creators/devanshi/` — Devanshi's package; `src/creators/active.ts`.
- `.env.example` — every env var.

DB rows are snake_case; the data layer maps them to the camelCase types. `media.source_path` is seed provenance (unique) so re-seeding upserts.

## Module map and public APIs

### `src/core/config/env.ts`
`env` getters plus `isSupabaseConfigured(): boolean`, `isCloudinaryConfigured(): boolean`, `cloudinaryFolder(): string`, `siteUrl(): string` (`NEXT_PUBLIC_SITE_URL` → `https://$VERCEL_PROJECT_PRODUCTION_URL` → `https://$VERCEL_URL` → localhost; scheme added if missing). `cloudinaryFolder()` defaults to the active creator id from `src/creators/active-id.ts` (a tiny module, so client code never pulls in creator content). Never throws at import time — missing config means **preview mode**.

### Preview mode (no Supabase configured)
`getSiteContent()` returns a fixture built from `src/creators/active.ts`: deterministic ids, every manifest file as a `MediaItem` with `publicId = "local:<path inside /data>"`, `preview: true`. In development, `GET /api/dev-media/[...path]` streams files from `SEED_DATA_DIR` (default `./data`) with HTTP Range support (videos need it), rejects path traversal, and returns 404 in production. This lets the whole site be viewed before any credentials exist. Admin pages show a "connect Supabase" notice in preview mode.

### `src/core/cloudinary/`
- `types.ts` — `CloudinaryUploadResult { public_id; resource_type: "image"|"video"; format; width; height; duration?; bytes }`.
- `urls.ts` (client-safe, no secrets):
  - `imageUrl(media: MediaItem | string, opts?: { width?: number; height?: number; crop?: "fill"|"limit"|"fit"; gravity?: "auto"|"face" }): string` → `f_auto,q_auto` delivery.
  - `videoUrl(media: MediaItem, opts?: { width?: number }): string` → `q_auto,vc_auto`, `.mp4`.
  - `videoPosterUrl(media: MediaItem, opts?: { width?: number; offset?: number }): string | null` → `so_<offset>` jpg frame; `null` for `local:` media.
  - `thumbUrl(media: MediaItem, width: number): string | null` → image URL or video poster.
  - `local:` ids map to `/api/dev-media/<encoded path>`; `width/height` ignored locally.
- `server.ts` (`import "server-only"`): `signUploadParams(params: Record<string, unknown>): string`, `destroyAsset(publicId: string, resourceType: ResourceType): Promise<void>`. Destroy is a no-op for `local:` ids.

### `src/core/supabase/`
- `server.ts` — `createSupabaseServerClient()` (cookies, `@supabase/ssr`) for admin reads/actions.
- `browser.ts` — `createSupabaseBrowserClient()`.
- `public.ts` — `createSupabasePublicClient()`; anon key, **no cookies** — the only client allowed inside `'use cache'`.
- `service.ts` — `createSupabaseServiceClient()`; service-role, server/scripts only, never imported by app routes except where explicitly noted.
- `src/proxy.ts` — optimistic gate: `/admin/*` without a session cookie redirects to `/admin/login?next=…` (signature is verified in `requireAdmin()`).

### `src/core/auth/guard.ts`
`getAdminUser()` (valid session cookie, or the read-only preview user), `requireAdmin()` (redirects to `/admin/login` without a valid session). Every admin page and every mutating action calls it; never rely on the proxy alone.

### `src/core/schemas/`
Zod schemas: `settings.ts` exports `siteSettingsSchema` and `normalizeSettings(raw: unknown): SiteSettings` (deep-merges stored jsonb over neutral defaults so a missing key never crashes a theme), plus schemas for media/collection/brand/testimonial/inquiry inputs. Admin forms and actions share them.

### `src/core/data/` (reads)
- `tags.ts` — `export const CONTENT_TAG = "site-content"`.
- `site.ts` — `getSiteContent(): Promise<SiteContent>`; `'use cache'` + `cacheTag(CONTENT_TAG)` + a long `cacheLife`; published rows only, sorted by `sort_order`; `sections` = enabled ones in order; falls back to the preview fixture. Also `getCollectionWork(slug): Promise<{ collection: Collection; items: MediaItem[] } | null>` derived from it.
- `admin.ts` — uncached, service-role client (server-only, after `requireAdmin()`), all rows incl. unpublished: `getSettings()`, `listMedia(filter?: { kind?: MediaKind; collectionId?: string; brandId?: string; q?: string; published?: boolean })`, `getMedia(id)`, `listCollections()`, `listBrands()`, `listTestimonials()`, `listInquiries(status?)`, `getDashboardStats()`.
- `mappers.ts` — row ↔ type mapping.

### `src/core/actions/` (`'use server'` mutations)
Every action: `requireAdmin()` (valid session cookie) → zod-validate → mutate with the service-role client → `revalidateTag(CONTENT_TAG, "max")` (or `updateTag` — read the docs for which applies in a Server Action) → return `ActionResult<T>`:
```ts
type ActionResult<T = void> = { ok: true; data: T } | { ok: false; error: string; fieldErrors?: Record<string, string[]> };
```
(defined in `src/core/actions/result.ts`)
- `settings.ts` — `updateSettings(input: SiteSettings)`.
- `media.ts` — `createMediaFromUpload(upload: CloudinaryUploadResult, defaults?: Partial<MediaPatch>)`, `updateMedia(id, patch: MediaPatch)`, `bulkUpdateMedia(ids, patch)`, `replaceMediaAsset(id, upload)` (swap asset, keep row/ordering/links, destroy old asset), `deleteMedia(id)` (destroy on Cloudinary, then delete row), `reorderMedia(ids: string[])`. `MediaPatch` = editable fields (kind, title, caption, alt, collectionId, brandId, featured, published, posterOffset).
- `collections.ts`, `brands.ts`, `testimonials.ts` — `create*`, `update*`, `delete*`, `reorder*`. `deleteBrand(id, { deleteLogo })`.
- `inquiries.ts` — `submitInquiry(prev: ActionResult | null, formData: FormData)` (**public**, no admin auth; honeypot field `website`, zod limits, inserted server-side with the service role, no cache invalidation), `setInquiryStatus(id, status)`, `deleteInquiry(id)`.
- `auth.ts` — `signIn(prev, formData)` (reads only `password` + optional `next`), `signOut()`.

### API routes
- `POST /api/cloudinary/sign` — admin only; body `{ paramsToSign }` (next-cloudinary `CldUploadWidget` `signatureEndpoint` format); forces `folder` under `NEXT_PUBLIC_CLOUDINARY_FOLDER`; returns `{ signature }`.
- `GET /api/dev-media/[...path]` — preview mode only (see above).

## Themes

`src/themes/types.ts`:
```ts
export interface ThemeModule {
  id: string;
  /** wraps every public page: fonts, CSS variables, nav, footer */
  SiteShell: ComponentType<{ content: SiteContent; children: ReactNode }>;
  HomePage: ComponentType<{ content: SiteContent }>;
  CollectionPage: ComponentType<{ content: SiteContent; collection: Collection; items: MediaItem[] }>;
}
```
`src/themes/active.ts` re-exports the active theme (`export { default } from "./scrapbook"`). Routes in `src/app/(site)/` stay thin: fetch `getSiteContent()`, render the theme. A theme may import from `@/core/types`, `@/core/cloudinary/urls`, `@/core/lib`, and `@/core/actions/inquiries` (`submitInquiry`) — nothing else from core, and nothing from `src/core/admin`. Themes render the sections listed in `content.sections` in that order and skip keys they don't implement. Theme CSS/tokens/fonts live inside the theme folder; the root layout stays theme-neutral.

## Admin panel (`/admin`)

Theme-independent and shared by every creator. Routes in `src/app/admin/`, components in `src/core/admin/`. Neutral, dense, fast UI (Tailwind, Radix primitives via `radix-ui`, `sonner` toasts, `@dnd-kit` for reordering, `react-hook-form` + zod for complex forms).

Screens: login · dashboard (counts, recent inquiries, quick links) · **Profile & contact** (identity, bio, keywords, portrait/hero/OG media pickers, contact, socials) · **Page sections** (reorder, show/hide, edit eyebrow/title/subtitle; stats, highlights, services, process lists) · **Media library** (grid with posters, filter by kind/collection/brand/published, upload via Cloudinary widget, edit metadata, replace file, delete with confirm, drag reorder, bulk publish/assign) · **Collections** · **Brands** (logo upload, tags, featured, reorder) · **Testimonials** · **Inquiries** (inbox, mark read/archive, delete, mailto reply) · SEO lives under Profile.

## Seed (`npm run seed`)

`scripts/seed/` (run with `tsx`, loads `.env.local`): reads `src/creators/active.ts`; for each `media` entry: probe with `ffprobe`, compress oversize files with `ffmpeg` into `/.seed-cache` (videos over `SEED_MAX_VIDEO_MB` → H.264 1080-wide, CRF ~23, `+faststart`; images over `SEED_MAX_IMAGE_MB` → max 4000px JPEG q85), upload to Cloudinary at a deterministic public_id `<folder>/seed/<slug of path>` (skip if it already exists; `upload_large` for big files), then upsert into Supabase with the service-role key (collections, brands, media by `source_path`, testimonials, settings with media ids resolved from `settingsMedia`). Idempotent; `--dry-run` prints the plan; `--only-db` skips uploads.

## Motion rules (all UI)

Durations: hover/press 100–150ms, UI transitions 150–300ms, panels ≤400ms; exits ~½ of entries. Ease-out `cubic-bezier(0.16,1,0.3,1)` in, ease-in `cubic-bezier(0.7,0,0.84,0)` out, `cubic-bezier(0.65,0,0.35,1)` for moves; linear only for marquees/spinners. Stagger 30–60ms, cascade ≤300ms, cap at 6–8 items. Popovers/modals/lightboxes grow from their trigger. Interruptible (springs/transitions, not keyframes, for reversible UI). 44px minimum touch targets. Feedback within 100ms. `prefers-reduced-motion` → fades or nothing. The admin animates very little (frequency of use).

## Binding decisions (from plan review — these override anything above)

**Shared contracts (read-only for implementers):** `src/core/types/content.ts`, `src/core/types/admin.ts` (`MediaPatch`, `MediaFilter`, `CollectionInput`, `BrandInput`, `TestimonialInput`, `InquiryInput`, `DashboardStats`), `src/core/actions/result.ts` (`ActionResult`, `ok`, `fail`), `src/core/cloudinary/types.ts` (`CloudinaryUploadResult`), `src/core/lib/slug.ts`, `src/creators/**`, the migration.

**Zod schema names** (`src/core/schemas/`): `siteSettingsSchema`, `mediaPatchSchema`, `collectionInputSchema`, `brandInputSchema`, `testimonialInputSchema`, `inquiryInputSchema`, plus `normalizeSettings()`.

**Action signatures** (all return `Promise<ActionResult<…>>`):
- `settings.ts`: `updateSettings(input: SiteSettings): ActionResult<SiteSettings>`
- `media.ts`: `createMediaFromUpload(upload: CloudinaryUploadResult, defaults?: MediaPatch): ActionResult<MediaItem>`; `updateMedia(id: string, patch: MediaPatch): ActionResult<MediaItem>`; `bulkUpdateMedia(ids: string[], patch: MediaPatch): ActionResult<number>`; `replaceMediaAsset(id: string, upload: CloudinaryUploadResult): ActionResult<MediaItem>`; `deleteMedia(id: string): ActionResult`; `reorderMedia(ids: string[]): ActionResult` — the given ids take the ascending set of their own current `sort_order` values (so reordering a filtered view is safe).
- `collections.ts`: `createCollection(input: CollectionInput): ActionResult<Collection>`; `updateCollection(id, patch: Partial<CollectionInput>): ActionResult<Collection>`; `deleteCollection(id): ActionResult`; `reorderCollections(ids): ActionResult`.
- `brands.ts`: `createBrand(input: BrandInput): ActionResult<Brand>`; `updateBrand(id, patch: Partial<BrandInput>)`; `deleteBrand(id, opts?: { deleteLogo?: boolean })`; `reorderBrands(ids)`.
- `testimonials.ts`: `createTestimonial(input: TestimonialInput)`; `updateTestimonial(id, patch: Partial<TestimonialInput>)`; `deleteTestimonial(id)`; `reorderTestimonials(ids)`.
- `inquiries.ts`: `submitInquiry(prev: ActionResult | null, formData: FormData): ActionResult` (public; inserted server-side with the service-role client — anon has no access to `inquiries`; without Supabase return `fail("…not connected yet…")`); `setInquiryStatus(id, status: InquiryStatus)`; `deleteInquiry(id)`.
- `auth.ts`: `signIn(prev: ActionResult | null, formData: FormData): ActionResult` (password only; redirects to `next` or `/admin` on success); `signOut(): Promise<void>`.
- Admin reads (`src/core/data/admin.ts`): `getSettings(): Promise<SiteSettings>`, `listMedia(filter?: MediaFilter): Promise<MediaItem[]>`, `getMedia(id)`, `listCollections()`, `listBrands()`, `listTestimonials()`, `listInquiries(status?: InquiryStatus)`, `getDashboardStats(): Promise<DashboardStats>`. In preview mode they return fixture data (inquiries empty) so the admin UI renders.

**Revalidation:** Server Actions call `updateTag(CONTENT_TAG)` (read-your-own-writes; only valid in actions). Route handlers would use `revalidateTag(CONTENT_TAG, "max")`.

**Routes:** collection page is `/work/[slug]` (`src/app/(site)/work/[slug]/page.tsx`); sitemap lists `/` and every `/work/<slug>`. Admin guarded pages live in `src/app/admin/(panel)/` whose layout calls `requireAdmin()`; `src/app/admin/login/` is NOT guarded (avoids a redirect loop). Cookie/session reads sit under `<Suspense>` or `loading.tsx` (cacheComponents).

**Cloudinary:** browser upload widget needs `NEXT_PUBLIC_CLOUDINARY_API_KEY` (added to `.env.example`). The sign route must NOT modify params (that breaks the signature) — it returns 400 unless `folder` / `asset_folder` / `public_id` is under the root folder, 401 without an admin session. Admin passes `options.folder = <root>/media` (or `<root>/logos`). `createMediaFromUpload` rejects `resource_type: "raw"` and public_ids outside the root. The seed sets both `public_id` and `asset_folder` (dynamic-folder accounts).

**Env access:** `env.ts` and `urls.ts` read `process.env.NEXT_PUBLIC_*` with literal property access (Next only inlines literal access). `env.ts` itself must NOT import `server-only` (client code reads the public getters); server-only secrets are read inside `server.ts`/`service.ts`.

**next.config.ts (core owns):** keep `cacheComponents`; add `outputFileTracingExcludes: { "*": ["./data/**", "./.seed-cache/**", "./reference/**"] }` and `images.remotePatterns` for `res.cloudinary.com`. `.vercelignore` already excludes `data`, `.seed-cache`, `reference`.

**Import rules:** the allowlist in "Themes" applies to `src/themes/**` only. Thin routes in `src/app/(site)/`, `sitemap.ts`, `robots.ts` may import `@/core/data/site` and `@/core/config/env`. `globals.css` holds only `@import "tailwindcss"` and a neutral base; theme CSS is scoped under a theme class/data attribute so nothing leaks into `/admin`.

**Prerender safety (theme):** no `new Date()` / `Math.random()` / `Date.now()` in server components (use a fixed seed for "random" rotations; derive years client-side or from data). `params` is a Promise. `generateStaticParams` must return ≥1 item.

**Seed rules:** insert-missing-only by default — collections & brands upsert by slug with `ignoreDuplicates`, media by `source_path`, testimonials by `seed_key` (e.g. `<creator>-t<index>`), settings only while `data = '{}'`; `--force` overwrites. Write order: collections + brands → media → update `cover_media_id` / `logo_media_id` → testimonials → settings. Seed must not import any `server-only` module or `src/core/supabase|cloudinary/server`; it builds its own clients and imports only `@/creators/*`, `@/core/types/*`, `@/core/lib/slug`. Validate the manifest up front (missing file, public_id collision, unknown collection/brand slug, `settingsMedia`/`coverSource` not in `media[]`) and fail with a clear message. Metadata comes from the Cloudinary response; size checks use `fs.stat`; ffmpeg is required only for oversize files.

**Process:** implementers do NOT run `npm install` or `npm run build` (parallel builds collide on `.next`). Check your own paths with `npx tsc --noEmit` (filter to your files — imports from other in-flight owners may be missing) and `npx eslint <your dirs>`. Only the verifier runs the full build. Do not commit.

## Auth update (supersedes Supabase-Auth references above)

Admin = one password (`ADMIN_PASSWORD`). `src/core/auth/mode.ts` (`isAdminPasswordConfigured`, `isAdminPreviewMode`, `sessionCookieName`), `src/core/auth/session.ts` (create/verify/clear signed cookie), `src/core/auth/guard.ts` (`requireAdmin`). Read-only preview of the admin happens only when nothing is configured (no Supabase, no password) outside production; in production without a password the admin is locked. `src/core/supabase/server.ts` / `browser.ts` and the `admins` table were removed; admin data access uses `src/core/supabase/service.ts` server-side only.

## Round-1 fixes (binding)

- **Settings contract additions:** `SiteSettings.contact.budgetOptions: string[]` (contact-form budget select; empty → the field is hidden; default `[]`, max 12 × 80 chars) and top-level `SiteSettings.brandGroups: BrandGroup[]` (`{ tag, label }`, how brand tags are grouped and labelled; tags lowercase and unique; default `[{ tag: "ugc", label: "UGC content" }, { tag: "instagram", label: "Instagram collaborations" }]`). `siteSettingsSchema`, `defaultSettings()` and `normalizeSettings()` cover both.
- **`refreshSiteCache(): Promise<ActionResult>`** in `src/core/actions/settings.ts`: `requireAdmin()` → fails without the service-role config → `updateTag(CONTENT_TAG)`. Backs the admin's "Refresh live site" button (after re-seeding or editing rows in the Supabase dashboard).
- **Preview content in production:** `getSiteContent()` serves the bundled fixture only when `NODE_ENV !== "production"` or `ALLOW_PREVIEW_CONTENT=1`; otherwise a missing Supabase config throws (`Supabase is not configured: …`), so a misconfigured deploy fails loudly instead of caching the fixture.
- **Admin reads** pick fixture vs database with `isSupabaseServiceConfigured()`, the same rule as the actions.
- **Reordering** is not atomic: `reorderRows()` returns `{ error, wrote }` and every `reorder*` action calls `updateTag(CONTENT_TAG)` whenever `wrote > 0`, even when it then reports an error.

## Known limitations

- **Soft 404 on the first hit to an unknown `/work/<slug>`.** With Cache Components the page shell streams before `notFound()` resolves, so the very first request for a slug that doesn't exist returns 200 with the not-found UI and `noindex`; later requests return 404. `dynamicParams = false` is not available with Cache Components in Next 16. Nothing links to such URLs, so impact is limited to typos.
- **Login lockout is per server instance** (in-memory). On Vercel each instance keeps its own counters; a strong `ADMIN_PASSWORD` is the real protection. Shared storage (e.g. Upstash) would be the upgrade.
- **Sessions are stateless** (7-day signed cookie). Signing out clears the cookie; to revoke every session, change `ADMIN_PASSWORD` (or `ADMIN_SESSION_SECRET`) and redeploy.
- **Upload widget param allowlist** (`/api/cloudinary/sign`) has not been exercised against a live Cloudinary account yet. If an upload fails with "Unsupported upload params", add the reported key to `ALLOWED_PARAMS` after checking it is harmless.

## Media edits (binding)

Non-destructive photo/video edits live in `media.edits` (jsonb, migration `20261124120000_media_edits.sql`) as `MediaEdits` (`src/core/types/content.ts`); `null` = original. The Cloudinary asset is never modified.

- `src/core/lib/media-edits.ts` (client-safe): `DEFAULT_EDITS`, `isDefaultEdits()`, `normalizeEdits(raw)` (clamps crop to 0–100 inside the frame with ≥0.1% size and drops a full-frame crop; wraps rotation into −180..180 whole degrees; adjustments are integers in −100..100, brightness ≥ −99; `trimStart` > 0 else null; `trimEnd` > `trimStart` else both null; all-default → `null`), `rotatedBox(w, h, deg)`, `cropPixels(edits, w, h)`.
- Zod: `mediaEditsSchema`; `mediaPatchSchema.edits` is nullable. Mappers normalize `edits` on read and on write, so bad stored JSON never crashes.
- Actions: `updateMedia` accepts `edits` (null clears); `replaceMediaAsset` resets `edits` to null; `bulkUpdateMedia` and `createMediaFromUpload` ignore `edits`.
- Delivery (`src/core/cloudinary/urls.ts`): edit components are chained before the size/format component, in this order: `a_hflip` / `a_vflip` → `a_<deg>` → `c_crop,x_,y_,w_,h_` → `e_brightness:<n>` / `e_contrast:<n>` / `e_saturation:<n>` → (`videoUrl` only) `so_<start>,eo_<end>` → resize + format. Crop values are **relative decimals** (percent / 100, e.g. `x_0.1,w_0.5`), not pixels. Cloudinary downscales very large images rotated by an arbitrary angle (tested: 3024×4032 at `a_30` came back as 3982×4299, not 4635×5004), which put pixel coordinates out of bounds with "Invalid crop coordinates". Relative values were verified for images, video posters and mp4. Posters put `so_<frame>` in the final component, after the edits; this was verified byte-identical to `so_` first, and frames at different offsets differ. The poster second is `posterOffset` clamped into the trim range.
- `editedDimensions(media)` gives the displayed size after rotation and crop (`null` when the size is unknown). Themes use it for aspect ratios and `<img width/height>`. `sourceImageUrl` / `sourceVideoUrl` return the UNEDITED proxies for the editor. `local:` media ignore edits.

## Instagram numbers (binding)

Stats can carry a `source` (`StatSource` in `src/core/types/content.ts`; absent = typed by hand). `normalizeSettings` keeps a known source and drops `"manual"` or unknown ones.

- **`site.*`** (`site.brands`, `site.reels`) are counted at render time in `getSiteContent()` (`src/core/data/site.ts`, live and preview paths) from published brands and published media of kind `reel`. They are compact-formatted and keep a trailing "+" from the stored value. A zero count falls back to the stored value. Themes still read only `stat.value`.
- **`instagram.*`** values are **stored** in `site_settings` and change only when the admin clicks Refresh and then approves with Update website. Never at render time and never on a schedule: the Graph API is slow (one insights call per reel), rate-limited and needs a secret token, and a public page must not fail or wait because Instagram is down.
- **Token:** only `INSTAGRAM_ACCESS_TOKEN` (Vercel env var), read by server-only code (`src/core/instagram/config.ts`). It is never stored in the database, never renewed by the app (a refreshed token couldn't be persisted without the database) and never sent to the browser; the admin page only learns whether it is set. Dashboard tokens last 60 days; the admin replaces the value in Vercel and redeploys. The earlier `public.integrations` table is dropped by `20261125020000_drop_integrations.sql`.
- **Server module** `src/core/instagram/` is server-only except `types.ts` and `format.ts`, which are pure. `graph.ts` is the graph.instagram.com client (version constant `GRAPH_VERSION`, 8 s timeout per call, Meta error codes mapped to friendly messages, token never logged). `config.ts` reads the env token and builds the page status. `snapshot.ts` has `fetchInstagramSnapshot()`.
- **Flow:** `fetchInstagram()` (requireAdmin) reads `/me` (followers_count, media_count), pages `/me/media` (cap 200) and reads `/{id}/insights?metric=views` for each reel (at most 6 in flight). One 40 s budget covers the whole refresh and partial results come back with a warning; the page sets `maxDuration = 60`. Permission errors become a warning with `null` views. It returns the snapshot plus a review from `buildReview()` (each instagram.* stat's current vs proposed value) and stores nothing. `applyInstagram({ update: [{ index, source, value }], add: [{ source, value }] })` receives the ticked rows with their raw counts from the page. That is acceptable because only the signed-in admin can call it and she can type any number in Page sections anyway. The counts are validated strictly (known sources, whole numbers 0–10¹², indexes in range and still holding that source, no duplicates), formatted on the server, and written to `site_settings` with `updateTag(CONTENT_TAG)`.
- **Formatting** (`format.ts`): 119 → "119", 2632 → "2.6K", 231522 → "231K", 1.2M. Values are rounded down, and a trailing "+" on the current value is kept.
- **Known limits:** applying writes the stored settings plus the new values, so a Page sections tab left open with older numbers can overwrite them on its next save; the success toast says to reload it. A reel's insights can lag up to 48 h.
