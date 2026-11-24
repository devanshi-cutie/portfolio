-- Link from a media item to its original post (e.g. the Instagram reel), so
-- visitors can open it and see the real views, likes and comments.
-- null = not linked. Only http(s) URLs, at most 500 characters.
alter table public.media add column if not exists source_url text;

alter table public.media drop constraint if exists media_source_url_check;
alter table public.media
  add constraint media_source_url_check
  check (source_url is null or (source_url ~* '^https?://\S+$' and char_length(source_url) <= 500));

comment on column public.media.source_url is
  'Link to the original post (http/https), shown on the site as "Watch on Instagram" / "View original post". null = not linked.';
