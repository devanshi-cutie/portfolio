-- Non-destructive photo/video edits (crop, rotate, flip, adjustments, trim),
-- applied by Cloudinary at delivery time. null = show the original.
alter table public.media add column if not exists edits jsonb;

comment on column public.media.edits is
  'MediaEdits JSON (see src/core/types/content.ts). Applied as Cloudinary transformations; the original asset is never modified.';
