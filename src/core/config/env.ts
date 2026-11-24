/**
 * Public configuration, safe to import from client and server code.
 *
 * Next.js only inlines `process.env.NEXT_PUBLIC_*` into client bundles when the
 * property is accessed literally, so every read below spells the name out.
 * Nothing here throws: missing config means the app runs in **preview mode**
 * (content from `src/creators/active.ts`, media streamed from `/data`).
 *
 * Server-only secrets (service-role key, Cloudinary API secret) are read inside
 * `src/core/supabase/service.ts` and `src/core/cloudinary/server.ts` instead.
 */

import { ACTIVE_CREATOR_ID } from "@/creators/active-id";

const clean = (value: string | undefined): string => (value ?? "").trim();

export const env = {
  get siteUrl(): string {
    return clean(process.env.NEXT_PUBLIC_SITE_URL);
  },
  get supabaseUrl(): string {
    return clean(process.env.NEXT_PUBLIC_SUPABASE_URL);
  },
  get supabaseAnonKey(): string {
    return clean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  },
  get cloudinaryCloudName(): string {
    return clean(process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME);
  },
  get cloudinaryApiKey(): string {
    return clean(process.env.NEXT_PUBLIC_CLOUDINARY_API_KEY);
  },
  get cloudinaryFolder(): string {
    return clean(process.env.NEXT_PUBLIC_CLOUDINARY_FOLDER);
  },
};

/** Supabase URL and anon key are both set. Otherwise the app is in preview mode. */
export function isSupabaseConfigured(): boolean {
  return env.supabaseUrl !== "" && env.supabaseAnonKey !== "";
}

/**
 * A Cloudinary cloud name is set, so delivery URLs can be built.
 * Server-side signing additionally needs `CLOUDINARY_API_KEY` + `CLOUDINARY_API_SECRET`
 * (see `isCloudinaryServerConfigured()` in `src/core/cloudinary/server.ts`).
 */
export function isCloudinaryConfigured(): boolean {
  return env.cloudinaryCloudName !== "";
}

/** Root folder for this creator's assets, without leading/trailing slashes. Defaults to the active creator's id. */
export function cloudinaryFolder(): string {
  const folder = env.cloudinaryFolder.replace(/^\/+|\/+$/g, "");
  return folder || ACTIVE_CREATOR_ID;
}

/** "example.com/" or "https://example.com/" -> "https://example.com"; "" stays "". */
function normalizeOrigin(value: string | undefined): string {
  const raw = clean(value).replace(/\/+$/, "");
  if (!raw) return "";
  return /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
}

/**
 * Public site URL without a trailing slash. Order: NEXT_PUBLIC_SITE_URL, then
 * Vercel's production domain, then the deployment URL, then localhost. Never throws.
 */
export function siteUrl(): string {
  return (
    normalizeOrigin(process.env.NEXT_PUBLIC_SITE_URL) ||
    normalizeOrigin(process.env.VERCEL_PROJECT_PRODUCTION_URL) ||
    normalizeOrigin(process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL) ||
    normalizeOrigin(process.env.VERCEL_URL) ||
    normalizeOrigin(process.env.NEXT_PUBLIC_VERCEL_URL) ||
    "http://localhost:3000"
  );
}
