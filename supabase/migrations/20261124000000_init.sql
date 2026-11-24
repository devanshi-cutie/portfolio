-- Creator portfolio engine — initial schema.
-- Media binaries live on Cloudinary; this database holds metadata, ordering,
-- copy and settings. Public visitors (anon key) read published rows through
-- RLS. Contact-form inquiries are inserted server-side. All admin reads/writes happen server-side with
-- the service_role key after the ADMIN_PASSWORD session check in the app.

create extension if not exists "pgcrypto";

-- ------------------------------------------------------------------ helpers

create or replace function public.touch_updated_at()
returns trigger language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ------------------------------------------------------------ site settings

create table public.site_settings (
  id smallint primary key default 1 check (id = 1),
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create trigger site_settings_touch before update on public.site_settings
  for each row execute function public.touch_updated_at();

-- ------------------------------------------------------------- collections

create table public.collections (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  description text,
  cover_media_id uuid,
  sort_order integer not null default 0,
  published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger collections_touch before update on public.collections
  for each row execute function public.touch_updated_at();

-- ------------------------------------------------------------------ brands

create table public.brands (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  logo_media_id uuid,
  website_url text,
  tags text[] not null default '{}',
  featured boolean not null default false,
  sort_order integer not null default 0,
  published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger brands_touch before update on public.brands
  for each row execute function public.touch_updated_at();

-- ------------------------------------------------------------------- media

create table public.media (
  id uuid primary key default gen_random_uuid(),
  public_id text not null unique,
  resource_type text not null check (resource_type in ('image', 'video')),
  format text,
  width integer,
  height integer,
  duration numeric,
  bytes bigint,
  kind text not null default 'other'
    check (kind in ('reel', 'video', 'photo', 'bts', 'logo', 'portrait', 'other')),
  title text,
  caption text,
  alt text,
  collection_id uuid references public.collections (id) on delete set null,
  brand_id uuid references public.brands (id) on delete set null,
  featured boolean not null default false,
  published boolean not null default true,
  sort_order integer not null default 0,
  poster_offset numeric not null default 0,
  -- provenance for the seed script (path inside /data); lets re-runs upsert
  source_path text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index media_collection_idx on public.media (collection_id, sort_order);
create index media_brand_idx on public.media (brand_id);
create index media_kind_idx on public.media (kind, sort_order);

create trigger media_touch before update on public.media
  for each row execute function public.touch_updated_at();

-- media references added after media exists
alter table public.collections
  add constraint collections_cover_fk foreign key (cover_media_id)
  references public.media (id) on delete set null;
alter table public.brands
  add constraint brands_logo_fk foreign key (logo_media_id)
  references public.media (id) on delete set null;

-- ------------------------------------------------------------ testimonials

create table public.testimonials (
  id uuid primary key default gen_random_uuid(),
  quote text not null,
  author_name text,
  author_role text,
  brand_id uuid references public.brands (id) on delete set null,
  avatar_media_id uuid references public.media (id) on delete set null,
  -- natural key for the seed script so re-runs don't duplicate quotes
  seed_key text unique,
  sort_order integer not null default 0,
  published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger testimonials_touch before update on public.testimonials
  for each row execute function public.touch_updated_at();

-- --------------------------------------------------------------- inquiries

create table public.inquiries (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  email text not null check (char_length(email) between 3 and 254),
  company text check (company is null or char_length(company) <= 160),
  budget text check (budget is null or char_length(budget) <= 80),
  message text not null check (char_length(message) between 1 and 4000),
  status text not null default 'new' check (status in ('new', 'read', 'archived')),
  created_at timestamptz not null default now()
);

create index inquiries_created_idx on public.inquiries (created_at desc);

-- --------------------------------------------------------------------- RLS

alter table public.site_settings enable row level security;
alter table public.collections enable row level security;
alter table public.brands enable row level security;
alter table public.media enable row level security;
alter table public.testimonials enable row level security;
alter table public.inquiries enable row level security;

-- site settings: public read
create policy "settings public read" on public.site_settings
  for select to anon, authenticated using (true);

-- content tables: public reads published rows
create policy "collections public read" on public.collections
  for select to anon, authenticated using (published);

create policy "brands public read" on public.brands
  for select to anon, authenticated using (published);

create policy "media public read" on public.media
  for select to anon, authenticated using (published);

create policy "testimonials public read" on public.testimonials
  for select to anon, authenticated using (published);

-- inquiries: no anon access at all. The contact form inserts server-side
-- (service role) after its honeypot + throttle checks.

-- ------------------------------------------------------------------ grants
-- Newer Supabase projects don't auto-grant Data API access; RLS still applies on top.

grant usage on schema public to anon, authenticated;
grant select on public.site_settings, public.collections, public.brands, public.media, public.testimonials
  to anon, authenticated;
-- service_role bypasses RLS but still needs table privileges (seed script + server-side admin panel)
grant usage on schema public to service_role;
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;

-- empty settings row so the app always has something to read
insert into public.site_settings (id, data) values (1, '{}'::jsonb)
  on conflict (id) do nothing;
