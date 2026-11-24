# Creator Portfolio — Devanshi Jain

A portfolio website with a built-in admin panel for **Devanshi Jain**, a UGC creator from Jaipur ([@devanshyyii](https://www.instagram.com/devanshyyii/)).

It is built as a reusable **creator-portfolio engine**: the core (data, admin panel, media pipeline, auth) stays the same, and each new creator only needs a new *creator package* (their content) and, optionally, a new *theme* (their look).

- **Next.js 16** (App Router, TypeScript, Tailwind v4, `motion`) on **Vercel**
- **Supabase** (Postgres) for content, settings and contact-form inquiries
- **Cloudinary** for every photo and video
- **Admin panel** at `/admin`, protected by a single password (`ADMIN_PASSWORD`)

```
src/
  core/            the engine — types, data, actions, auth, Cloudinary, admin UI  (same for every creator)
  themes/          the public site's look; src/themes/active.ts picks one         (swap per creator)
  creators/        initial content + media manifest; src/creators/active.ts       (swap per creator)
  app/             thin Next.js routes: (site)/ public, admin/, api/
scripts/seed/      uploads /data to Cloudinary and fills Supabase
supabase/          database migration
docs/              ARCHITECTURE.md, THEME-SCRAPBOOK.md
```

Read [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the full design.

---

## 1. Run it locally (no accounts needed)

```powershell
npm install
npm run dev
```

Open http://localhost:3000. With no environment variables set, the site runs in **preview mode**: content comes from `src/creators/devanshi`, and videos and photos are streamed straight from the local `data/` folder. `/admin` opens read-only so you can look around.

> `data/` (about 2.1 GB) is git-ignored and never deployed. It only exists on your machine and is uploaded to Cloudinary by the seed script.

## 2. Create the services

### Supabase
1. Create a project at [supabase.com](https://supabase.com).
2. Create the tables: push the repo to GitHub with the `SUPABASE_DB_URL` secret set (see **Database changes** below) and the workflow applies every migration, or paste `supabase/migrations/20261124000000_init.sql` into **SQL Editor** and run it.
3. From **Project Settings → API**, copy the project URL, the `anon` (publishable) key and the `service_role` (secret) key.

### Cloudinary
1. Create an account at [cloudinary.com](https://cloudinary.com).
2. From **Settings → API Keys**, copy the cloud name, API key and API secret.

## 3. Environment variables

Copy `.env.example` to `.env.local` and fill it in. Every variable is explained in the file.

| Variable | Where it's used |
| --- | --- |
| `NEXT_PUBLIC_SITE_URL` | Your live URL (for SEO, sitemap, link previews) |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public site reads and the contact form |
| `SUPABASE_SERVICE_ROLE_KEY` | Admin panel (server-side only) and the seed script |
| `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`, `NEXT_PUBLIC_CLOUDINARY_API_KEY` | Media URLs and the upload widget |
| `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | Signing uploads, deleting files, the seed script |
| `NEXT_PUBLIC_CLOUDINARY_FOLDER` | Root folder in Cloudinary (default `devanshi`) |
| `ADMIN_PASSWORD` | **The password for `/admin`.** Use a long passphrase. |
| `ADMIN_SESSION_SECRET` | Optional. Signs login cookies; derived from the password if empty |
| `SEED_*` | Seed script options (size limits, data folder) |
| `ALLOW_PREVIEW_CONTENT` | Leave empty. Set to `1` only to build/deploy a demo without Supabase |

## 4. Upload her work (one time)

```powershell
npm run seed:dry
```
```powershell
npm run seed
```

The dry run checks every file and shows the plan without touching the network. The real run compresses files that are too big for Cloudinary's free plan (the two real-estate videos, one travel video and one photo; this needs `ffmpeg`), uploads everything, and fills the database with her profile, 9 collections, 47 brands, 37 media items and 4 testimonials. It is safe to re-run: it only adds what's missing and never overwrites edits made in the admin panel (unless you pass `--force`). See [scripts/README.md](scripts/README.md).

## 5. Deploy to Vercel

1. Push this repo to GitHub (`data/` and `.env*` are ignored automatically).
2. In Vercel, **Add New → Project**, import the repo (framework: Next.js, defaults are fine).
3. Add every variable from `.env.local` under **Settings → Environment Variables**. Set `NEXT_PUBLIC_SITE_URL` to the production URL. **`ADMIN_PASSWORD` lives here.**
4. Deploy. To change the admin password later, edit `ADMIN_PASSWORD` in Vercel and redeploy; everyone gets signed out.

## Database changes (automatic migrations)

`.github/workflows/supabase-migrations.yml` runs on every push to `main`. It checks `supabase/migrations/` and applies any SQL file the database hasn't run yet (the Supabase CLI keeps a history table, so each file runs once). When nothing is new it does nothing.

- **One-time setup:** in GitHub → **Settings → Secrets and variables → Actions**, add `SUPABASE_DB_URL` = the **Session pooler** connection string (Supabase → **Connect** → Session pooler, with your database password filled in). The "Direct connection" string won't work from GitHub.
- **To change the database:** add a new file `supabase/migrations/<YYYYMMDDHHMMSS>_<what>.sql`, commit and push. Never edit a file that has already run.
- Keep changes backwards-compatible (add columns/tables before the code that needs them), because Vercel deploys the new code at the same time.
- You can re-run it by hand from the **Actions** tab (**Run workflow**).

## 6. Using the admin panel

Go to `/admin` and enter the password; the sign-in page greets her by name with her portrait (Profile & SEO → portrait). Everything on the site is editable there:

- **Profile & SEO**: name, tagline, bio, location, rotating keywords, portrait/hero/share image, email, phone, WhatsApp, social links, Google title and description
- **Page sections**: reorder, show/hide, and rename every homepage section; edit the numbers, "why work with me" highlights, services and process steps
- **Media library**: upload photos and videos, replace a file, delete, change title/caption, assign a collection or brand, feature, publish/hide, drag to reorder, pick a video's cover frame
- **Photo & video editor** (crop icon on any item, or right after an upload): crop with shape presets (Original, 9:16, 4:5, 1:1, 16:9), zoom, rotate, straighten, flip, brightness/contrast/saturation, and trim videos. Edits are non-destructive: the original stays on Cloudinary and **Reset to original** undoes everything
- **Collections**: the work categories (Jewellery, Real estate…) and their covers
- **Brands**: add brands she has worked with, upload logos, tag UGC/Instagram, feature, reorder
- **Testimonials** and **Inquiries** (messages from the contact form)

Changes go live on the public site straight away. The link preview card (what WhatsApp, Instagram, LinkedIn and X show when the site is shared) is generated from her name, tagline, featured brands and portrait (or the share image set under Profile & SEO); it refreshes on the next deploy, and the apps themselves cache previews for a while. If you ever edit data directly in Supabase or re-run the seed after deploying, press **Refresh live site** on the admin dashboard.

## 7. Reusing this for another creator

1. Copy `src/creators/devanshi/` to `src/creators/<name>/`, edit the content, id and media manifest, and point `src/creators/active.ts` and `src/creators/active-id.ts` at it.
2. Replace the favicon files `src/app/icon.png` (round, 256px), `src/app/apple-icon.png` (180px) and `src/app/favicon.ico` with the new creator's face. They live in the repo, not on Cloudinary.
3. For a different look, copy `src/themes/scrapbook/` to `src/themes/<theme>/`, redesign it, and point `src/themes/active.ts` at it. A theme receives all content as props, and its `brand` tokens also re-skin the admin panel.
4. Create a new Supabase project and Cloudinary folder, set the env vars, run the migration and `npm run seed`, then deploy.

Nothing in `src/core`, `src/app/admin` or `scripts` needs to change.

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Local dev server |
| `npm run build` / `npm start` | Production build / serve |
| `npm run lint` | ESLint |
| `npm run seed:dry` / `npm run seed` | Check / upload `data/` to Cloudinary + Supabase |
