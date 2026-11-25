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
| `VERCEL_ANALYTICS_TOKEN` | Optional. Vercel token for the admin's Analytics tab (server-only, see **Analytics** below) |
| `VERCEL_ANALYTICS_PROJECT_ID` | Optional. The Vercel project ID (`prj_…`) the Analytics tab reads |
| `VERCEL_ANALYTICS_TEAM_ID` | Only with a **Full Account** token: the team ID (`team_…`). Leave empty for a project-scoped token |
| `CRON_SECRET` | Protects the daily analytics copy job. 16+ letters and digits; Vercel sends it automatically |
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
- **Instagram**: click Refresh to get her current followers, posts and reel views from Instagram, compare them with the numbers on the site, and update the ones she ticks (see below)
- **Analytics**: visits from Vercel Web Analytics (pageviews, visitors, top pages, referrers, countries, devices, browsers) and the clicks the site counts itself (reel opens, contact buttons, social links…), for the last 7 days up to all time (see below)

Changes go live on the public site straight away. The link preview card (what WhatsApp, Instagram, LinkedIn and X show when the site is shared) is generated from her name, tagline, featured brands and portrait (or the share image set under Profile & SEO); it refreshes on the next deploy, and the apps themselves cache previews for a while. If you ever edit data directly in Supabase or re-run the seed after deploying, press **Refresh live site** on the admin dashboard.

## Instagram numbers (official API)

The Numbers section can show Instagram followers, posts, total reel views and top-reel views. They come from Meta's free, official **Instagram API with Instagram Login** (`graph.instagram.com`): no scraping and no password sharing. The site never calls Instagram on its own (nothing on a schedule, nothing when a page loads). In the admin she clicks **Refresh from Instagram**, checks the new numbers next to the ones on the site, and clicks **Update website**. Nothing fetched is stored until then.

**Needs:** a public Instagram **Professional** account (Creator or Business; switching is free in the Instagram app), a free Meta developer app, and the token in Vercel as `INSTAGRAM_ACCESS_TOKEN`. Without the token the Refresh button is disabled and the site keeps the numbers typed in Page sections.

**Setup** (the same steps are shown on Admin → Instagram):

1. Instagram app → Settings → *Account type and tools* → *Switch to professional account* → Creator.
2. [developers.facebook.com/apps](https://developers.facebook.com/apps) → *Create app* → use case **Other** → app type **Business**.
3. Add the **Instagram** product → *API setup with Instagram login* → under *Generate access tokens*, click **Add account** and log in as her account. Your own account works with Standard Access, so no App Review is needed.
4. Make sure the permissions include `instagram_business_basic` and `instagram_business_manage_insights` (needed for reel views), click **Generate token** and copy it. Dashboard tokens are long-lived (60 days). There's no exchange step and no app secret involved.
5. In Vercel → **Settings → Environment Variables**, add `INSTAGRAM_ACCESS_TOKEN` with that token for **Production**, then redeploy. The token is server-only; the admin panel never shows it.

If the dashboard asks for an Instagram tester: *App roles → Roles* → add her as an Instagram Tester, then accept in Instagram → Settings → *Website permissions* → *Apps and websites* → *Tester invites*.

**Every 60 days:** the token expires 60 days after it's generated and the site does **not** renew it. When Refresh says the token has expired (or was revoked), generate a new one (step 4), replace `INSTAGRAM_ACCESS_TOKEN` in Vercel and redeploy. The numbers already on the site are unaffected while the token is expired.

**A token pasted in an earlier version:** the admin briefly stored a pasted token in the database. Dropping that table (migration `20261125020000_drop_integrations.sql`) deletes it but doesn't revoke it. To cut it off now, remove the app in Instagram → Settings → *Apps and websites*; otherwise it simply expires 60 days after it was generated.

**What's fetched on Refresh:** followers and total posts (profile counts). The latest 200 posts are scanned for reels; each reel's lifetime `views` insight is summed for "views across my reels", and the highest single reel is "top reel views". A refresh stops after about 40 seconds and shows what it got, with a note. Instagram can take up to 48 hours to update view counts. Reels posted before the account became professional may have no insights; they're left out, and the page says how many.

**What isn't:** stories, likes, comments, follower demographics, other people's accounts, and anything automatic. Brand and reel counts don't come from Instagram: set a number's source to *Brands on this site* or *Reels on this site* and it's counted from the published content automatically.

**Choosing which numbers update:** in Page sections → Numbers, each number has a **Source**: typed by hand, one of the Instagram metrics, or one of the site counts. Only numbers with an Instagram source appear in the review table, and the table can add a missing Instagram metric to the list. Labels and order are still edited in Page sections.

## Analytics (Vercel Web Analytics + click counts)

Admin → Analytics shows two things: **visits** from Vercel Web Analytics (pageviews, visitors, top pages, referrers, countries, devices, browsers), and **clicks** the site counts itself. Click counts only need Supabase. Visits need a Vercel token; without it the tab shows the setup steps below.

**Setup:**

1. Vercel → this project → **Analytics** → **Enable Web Analytics**, then redeploy. The site already includes Vercel's script; admin pages are never counted.
2. [vercel.com/account/tokens](https://vercel.com/account/tokens) → **Create Token**. Set the scope to **this project only** and pick an expiry. Vercel has no read-only token, so a project-scoped token is the narrowest option.
3. Project → **Settings → General** → copy the **Project ID** (starts with `prj_`).
4. In Vercel → **Settings → Environment Variables**, add for **Production**: `VERCEL_ANALYTICS_TOKEN` (the token), `VERCEL_ANALYTICS_PROJECT_ID` (the project ID) and `CRON_SECRET` (a random string of 16+ letters and digits). Add `VERCEL_ANALYTICS_TEAM_ID` (`team_…`) only if you made a **Full Account** token instead. Redeploy.

All four are server-only: never prefix them with `NEXT_PUBLIC_`, and the admin panel never shows them. When the token expires or is revoked, the tab says Vercel rejected it: create a new one (step 2), replace `VERCEL_ANALYTICS_TOKEN` and redeploy. History already copied is unaffected.

**On the free Hobby plan:** Vercel keeps 1 month of data and caps Web Analytics at 50,000 events a month. Vercel doesn't document API access for Hobby, so the tab may say the analytics API is **unavailable**. Click counts work either way.

**How history is kept:** the numbers are copied into Supabase, so they outlive Vercel's 1 month. A copy runs when the Analytics tab is opened (at most once every 10 minutes; **Refresh from Vercel** runs it straight away) and once a day at 00:30 UTC from a Vercel Cron job (`vercel.json`), which Vercel authorizes with `CRON_SECRET`. Each copy covers the last 30 days, so that is all that can be backfilled on day one; "Last 90 days" and longer fill in over time. All days are UTC.

**Visitors are unique per day.** Vercel counts a visitor once a day (no cookies). Over several days the tab adds the daily numbers, so someone who came back on three days counts three times. Read it as "visits", not "people".

**Clicks counted:** reel opened, "view original post", social links (Instagram and others), email link, WhatsApp, media kit, the contact buttons (hero, top menu, floating button), and contact-form sends. Each is stored only as a count per day, click type and target (which reel, which button). No IP, cookie, user agent or anything else about the visitor is stored. Do Not Track isn't honoured, since nothing personal is kept. Local dev, preview deployments and obvious bots aren't counted.

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
