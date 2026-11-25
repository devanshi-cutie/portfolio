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
- `POST /api/track` — **public** first-party click counter; body `{ event, target? }`; always `204` with no body, counted or not (drop rules under **Analytics**).
- `GET /api/cron/analytics` — Vercel Cron only (`vercel.json`, daily 00:30 UTC); `401` unless `Authorization: Bearer <CRON_SECRET>`; returns the `SyncResult`. `maxDuration = 60`.

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
`src/themes/active.ts` re-exports the active theme (`export { default } from "./scrapbook"`). Routes in `src/app/(site)/` stay thin: fetch `getSiteContent()`, render the theme. A theme may import from `@/core/types`, `@/core/cloudinary/urls`, `@/core/lib`, and `@/core/actions/inquiries` (`submitInquiry`) — nothing else from core, and nothing from `src/core/admin`. For click tracking that means `@/core/lib/track` (`track()`), `@/core/lib/track-events` (`trackAttr()`, event names) and `@/core/lib/track-clicks` (`TrackClicks`); never `@/core/analytics` (server-only). Themes render the sections listed in `content.sections` in that order and skip keys they don't implement. Theme CSS/tokens/fonts live inside the theme folder; the root layout stays theme-neutral.

## Admin panel (`/admin`)

Theme-independent and shared by every creator. Routes in `src/app/admin/`, components in `src/core/admin/`. Neutral, dense, fast UI (Tailwind, Radix primitives via `radix-ui`, `sonner` toasts, `@dnd-kit` for reordering, `react-hook-form` + zod for complex forms).

Screens: login · dashboard (counts, recent inquiries, quick links) · **Profile & contact** (identity, bio, keywords, portrait/hero/OG media pickers, contact, socials) · **Page sections** (reorder, show/hide, edit eyebrow/title/subtitle; stats, highlights, services, process lists) · **Media library** (grid with posters, filter by kind/collection/brand/published, upload via Cloudinary widget, edit metadata, replace file, delete with confirm, drag reorder, bulk publish/assign) · **Collections** · **Brands** (logo upload, tags, featured, reorder) · **Testimonials** · **Inquiries** (inbox, mark read/archive, delete, mailto reply) · **Instagram** · **Analytics** (Vercel visits copied into Supabase: daily chart, top pages/referrers/countries/devices/browsers; first-party click counts; range picker; Refresh) · SEO lives under Profile.

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
- **`/api/track` throttle is per server instance** (in-memory, 60 hits per IP per 10 minutes). Instances don't share it, so it slows a casual spammer but doesn't stop one.
- **Click counts can be inflated.** The endpoint is public and stores nothing about the visitor, so anyone can post fake clicks (within the throttle and the same-origin check, which a non-browser client can fake). Target checks keep them to valid slugs and existing media ids, so spam inflates counts but can't add free-text rows. Treat the numbers as a trend, not an audit.
- **No Vercel custom events on Hobby.** Clicks are counted first-party (`/api/track` → Supabase) instead of with `@vercel/analytics` `track()`. Moving to Pro wouldn't change this unless the code is switched over.
- **Vercel's "Others" row shape is unverified.** Breakdown requests use `limit=50`; Vercel groups the rest into an overflow row. `isOthersRow()` in `vercel.ts` guesses its shape (a value of "Others", or a missing key plus an `others`/`isOthers` flag) and stores it as `(other)`. If a real overflow row slips through, it would show up as `(unknown)` or a literal value.

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

## Analytics (binding)

One admin tab (`/admin/analytics`), two sources: **Vercel Web Analytics** (visits), copied into Supabase so history outlives Vercel's retention (1 month on Hobby), and **first-party click counts** (Vercel custom events aren't on Hobby). Migration `20261125030000_analytics.sql`. All days are UTC.

- **Tables** (RLS on, no policies, everything revoked from `anon`/`authenticated`, granted to `service_role` only):
  - `analytics_daily` — `day date` pk, `pageviews`, `visitors` (unique **per day** only: never sum it as "people"), `synced_at`, `breakdown_synced_at` (null until the day's breakdown is fully written).
  - `analytics_daily_breakdown` — pk `(day, dimension, value)`, plus `pageviews`, `visitors`. `dimension` ∈ `path | referrer | country | device | browser`; `value` 1–300 chars. Empty values are stored as `(direct)` (referrer) or `(unknown)`; Vercel's overflow row as `(other)`.
  - `analytics_interactions` — pk `(day, event, target)`, plus `count`. `event` matches `^[a-z_]{1,32}$`; `target` ≤ 80 chars, default `''`.
- **Functions** (all `set search_path = public`, execute revoked from `public, anon, authenticated`, granted to `service_role` only):
  - `analytics_track(p_event, p_target) → bigint` (`language sql`) — adds 1 to today's (UTC) row (insert … on conflict do update) and returns the new count. The table checks reject bad events.
  - `analytics_replace_breakdown(p_day, p_dimension, p_rows jsonb) → integer` (`plpgsql`) — replaces one `(day, dimension)` in a single transaction: takes a transaction-scoped advisory lock on that pair, deletes its rows, then inserts `p_rows` (grouped by value, negatives clamped to 0, `on conflict do update`). Returns the rows written. Two syncs at once can't interleave or leave a half-written breakdown.
  - `analytics_breakdown(p_since, p_until, p_limit)` → `(dimension, value, pageviews, visitors)` (`language sql`) — top `p_limit` values per dimension over the range (null = unbounded), summed across days, ranked by pageviews.
  - `analytics_interaction_summary(p_since, p_until, p_limit)` → `(event, target, count, event_total)` (`language sql`) — top targets per event; `event_total` sums **all** targets before the cut, so adding up the top rows never undercounts.
- **Env** (server-only, read only in `src/core/analytics/config.ts`): `VERCEL_ANALYTICS_TOKEN`, `VERCEL_ANALYTICS_PROJECT_ID`, optional `VERCEL_ANALYTICS_TEAM_ID` (sent as `teamId` only when set), `CRON_SECRET` (shorter than 16 chars counts as unset). Never `NEXT_PUBLIC_`, never stored, logged or sent to the browser. `getAnalyticsStatus()` (requireAdmin) returns only `{ configured, storageReady }`.
- **Modules:** `src/core/analytics/` is `server-only` except `types.ts`.
  - `vercel.ts` — client for `GET https://api.vercel.com/v1/query/web-analytics/visits/aggregate`. 8 s timeout per call; the token travels only in the `Authorization` header. Errors become `VercelAnalyticsError` with a reason: 401/403 → `token`, 429 → `rate_limited`, 404 and other statuses or a bad body → `unavailable`, fetch failure or timeout → `network`. Error messages are `HTTP <status> [code]` at most, never the URL, headers or Vercel's text. Counts are parsed with zod and clamped to non-negative integers. `fetchDailyTotals(cfg, since, until)` (`by=day`, `limit=100`), `fetchDayBreakdown(cfg, dim, day)` (`limit=50`; dims map to `requestPath`, `referrerHostname`, `country`, `deviceType`, `browserName`).
  - `sync.ts` — `runAnalyticsSync({ force?, budgetMs?, now? }): Promise<SyncResult>`. Does no auth; callers authorize.
  - `interactions.ts` — `recordInteraction(event, target): Promise<void>`. Public code paths call it; it never throws. It is a no-op unless `VERCEL_ENV === "production"`, without the service role, for a malformed target (`isValidTarget()`), and for a media id that isn't a row in `media` (primary-key lookup, so random uuids can't add rows). Also exports `normalizeTarget()` (sanitized + lowercased) and `isValidTarget(event, target)`.
  - Reads: `getAnalyticsOverview(range)` in `src/core/data/analytics.ts` (requireAdmin, uncached, empty in preview; ranges `7d | 30d | 90d | 12m | all`, top 10 per dimension, top 5 targets per event).
  - Action: `syncAnalytics({ force? }): ActionResult<SyncResult>` in `src/core/actions/analytics.ts` (requireAdmin; preview → `fail(PREVIEW_ERROR)`). Touches no cache tags: nothing public is built from this data.
- **Sync algorithm** (`runAnalyticsSync`):
  1. Missing config → `error` / `not_configured`; missing service role → `error` / `storage`.
  2. **10-minute skip:** unless `force`, if the newest `analytics_daily.synced_at` is under 10 minutes old, return `skipped` without calling Vercel. The admin page syncs unforced on open and **Refresh from Vercel** passes `force: true`. The cron passes `force: false`, so a duplicate delivery minutes later comes back `skipped`.
  3. One `by=day` request for the last **30** UTC days, today included. Only days Vercel returned are overwritten (upsert with `synced_at = now`). A day Vercel left out (no traffic, or past its retention) gets a zero row only if none is stored yet, plus a `synced_at` touch; stored history is never zeroed. No upsert payload has `breakdown_synced_at`, so it is left alone.
  4. Pending = window days whose breakdown isn't final, newest first. **Final-day rule:** final once `breakdown_synced_at ≥ day + 1 day + 1 h` (written at least an hour after the UTC day ended). Final days are never fetched again. Days older than 30 days can't be backfilled.
  5. **Quiet days** (no pageviews per Vercel): no requests and nothing deleted. A quiet day is finalized (`breakdown_synced_at = now`) only once it is at least 2 full days past its end **and** its stored pageviews are 0, so a day that fell out of Vercel's retention keeps the breakdown stored earlier. Until then a later run re-checks it.
     **Days with traffic:** one request per dimension (5 per day), 3 in flight. Each `(day, dimension)` is written through `analytics_replace_breakdown()`; `breakdown_synced_at = now` once all five are written.
     **Empty-path guard:** if a day has traffic but its `path` breakdown comes back empty (Vercel hasn't caught up), that empty result isn't stored, the day isn't finalized and the run is `partial`; the next run retries. Once the day is 2+ full days old it is finalized anyway, like a quiet day.
  6. **40 s budget:** no new Vercel request starts after 40 s (`budgetMs`), which fits `maxDuration = 60` on the cron route and the admin page. Unfinished days wait for the next run.
  7. Failures: `rate_limited` or `token` stops new requests (`partial`); other Vercel errors skip just that request (`partial`). A breakdown write (or finalize) failure skips just that job and leaves the day unfinalized; after 3 such failures the run stops starting requests. Any of these makes the result `partial` with reason `storage`, which outranks every other reason. Only a failed daily-totals request (`error` with its reason) or a failed daily-totals read/write (`error` / `storage`) returns `error`.
  Repeating a run is safe (upserts and atomic replaces), so a duplicate cron call is harmless.
- **`SyncResult` contract** (`types.ts`):
  ```ts
  interface SyncResult {
    status: "synced" | "partial" | "skipped" | "error";
    reason?: "not_configured" | "token" | "unavailable" | "rate_limited" | "network" | "storage";
    message?: string;          // plain English, safe to show the admin
    lastSyncedAt: string | null; // ISO; newest stored sync, null when nothing has synced
    daysUpdated: number;       // daily total rows written this run
    breakdownDaysUpdated: number; // days whose full breakdown was written this run
  }
  ```
  `syncAnalytics` returns Vercel-side problems as `ok(SyncResult)` with status `error` / `partial` so the page can explain them; it fails only for a preview session, bad input or a crash. The cron route maps it to HTTP: `200` for synced / partial / skipped, `503` for `not_configured` / `storage`, `502` for the Vercel-side reasons, `500` on a crash.
- **Cron:** `vercel.json` → `GET /api/cron/analytics` at `30 0 * * *`. The route compares the `Authorization` header with `Bearer <CRON_SECRET>` in constant time (both SHA-256 hashed first); while `CRON_SECRET` is unset every request is `401`. Reading the header keeps the handler dynamic.
- **Vercel's script:** `src/app/(site)/site-analytics.tsx` is a `"use client"` wrapper around `<Analytics>` from `@vercel/analytics/next` whose `beforeSend` drops `/admin` URLs. Only the public `(site)` layout renders it, so the layout stays static.
- **Click tracking:**
  - Events (`src/core/lib/track-events.ts`, pure): client `reel_open`, `source_link`, `social_click`, `email_click`, `whatsapp_click`, `media_kit_click`, `cta_click`; server-only `contact_sent`. Targets:
    - `reel_open`, `source_link`: the uuid of an existing `media` row;
    - `social_click`: `instagram-hero | instagram-nav | instagram-footer | instagram-contact | instagram-lightbox` (Instagram is named by placement), any other social a platform slug (the footer's `socialTarget()`, e.g. `youtube`);
    - `cta_click`, `email_click`, `whatsapp_click`, `media_kit_click`, `contact_sent`: a placement (`hero`, `nav`, `floating`, `contact`, `form`).

    Every non-media target must match `/^[a-z0-9_-]{1,32}$/` after `normalizeTarget()`. `sanitizeTarget()` removes control characters, collapses whitespace and cuts to 80 code points.
  - Browser: theme elements carry `data-track={trackAttr(event, target)}`; `TrackClicks` (one delegated capture listener for click and middle-click, rendered by the theme's `SiteShell`) reports them through `track()` (`src/core/lib/track.ts`): production builds only, never on `/admin` or a local host (`localhost`, `127.0.0.1`, `[::1]`, `*.localhost`); the JSON is sent with `sendBeacon` as a plain string (`text/plain`, no CORS preflight), with a `fetch` `keepalive` fallback (also `text/plain`); never throws. Code can also call `track()` directly (the lightbox does for `reel_open`).
  - Server: `submitInquiry` records `contact_sent` / `form` with `after()` once the inquiry is saved.
- **`POST /api/track` drop rules.** Every request gets `204`, no body, `Cache-Control: no-store`, so a caller can't tell whether it counted. It is dropped when:
  - `VERCEL_ENV !== "production"`, including unset (preview deployments, local `next start`);
  - the user agent is empty or matches `bot|crawl|spider|slurp|headless|lighthouse|preview`;
  - an `Origin` header is present and its host isn't the request's host (`x-forwarded-host`, else `host`); a missing `Origin` is allowed;
  - the IP (`x-forwarded-for` first entry, else `x-real-ip`) has sent more than 60 hits in a 10-minute window (in-memory per instance; past 5000 IPs the oldest entries are evicted, so rotating IPs can't wipe everyone else's window);
  - the body is over 1 KB (checked against `Content-Length` when sent, and while streaming, which stops reading at the cap), isn't JSON, or fails zod (`event` must be a client event, so `contact_sent` is rejected; `target` ≤ 200 chars). Any content type is read, so `text/plain` beacons work;
  - the target fails the per-event check (`isValidTarget()`: a uuid for media events, else the slug pattern).

  Accepted hits are counted with `after()` → `recordInteraction()`, which checks the production gate again, validates the target shape and confirms a media id exists before counting. The IP lives only in the throttle map and the user agent is only tested against the bot pattern; neither is stored.
