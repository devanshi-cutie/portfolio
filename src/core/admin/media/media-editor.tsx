"use client";

import { useEffect, useRef, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { Slider } from "radix-ui";
import { Crop, Crosshair, RefreshCw, Trash2, Wand2 } from "lucide-react";
import type { Brand, Collection, MediaItem, MediaKind } from "@/core/types/content";
import { MEDIA_KINDS } from "@/core/types/content";
import type { MediaPatch } from "@/core/types/admin";
import { mediaPatchSchema } from "@/core/schemas";
import { deleteMedia, replaceMediaAsset, updateMedia } from "@/core/actions/media";
import { imageUrl, videoPosterUrl, videoUrl } from "@/core/cloudinary/urls";
import { callAction } from "../lib/use-action";
import { emptyToNull, formatBytes, formatDuration } from "../lib/format";
import { useUnsavedChanges } from "../lib/use-unsaved-changes";
import { applyFieldErrors, validateWith } from "../lib/validate";
import { Button } from "../ui/button";
import { ConfirmDialog, Sheet } from "../ui/dialogs";
import { Field, Input, Select, Textarea, fieldA11y } from "../ui/field";
import { Switch } from "../ui/switch";
import { UploadButton } from "../upload/upload-button";
import { KIND_LABELS, mediaLabel } from "./labels";

interface MediaEditorProps {
  media: MediaItem | null;
  collections: Collection[];
  brands: Brand[];
  onClose: () => void;
  onSaved: (media: MediaItem) => void;
  onDeleted: (id: string) => void;
  /** open the crop / rotate / adjust studio for this item */
  onEditVisual: (id: string) => void;
}

export function MediaEditor({ media, collections, brands, onClose, onSaved, onDeleted, onEditVisual }: MediaEditorProps) {
  const [dirty, setDirty] = useState(false);
  const open = media !== null;

  function requestClose(next: boolean) {
    if (next) return;
    if (dirty && !window.confirm("Discard your unsaved changes to this item?")) return;
    setDirty(false);
    onClose();
  }

  return (
    <Sheet
      open={open}
      onOpenChange={requestClose}
      title={media ? mediaLabel(media) : "Edit media"}
      description={media ? `${KIND_LABELS[media.kind]}${media.published ? "" : " · draft"}` : undefined}
    >
      {media ? (
        <EditorBody
          key={`${media.id}:${media.updatedAt}`}
          media={media}
          collections={collections}
          brands={brands}
          onDirtyChange={setDirty}
          onEditVisual={() => onEditVisual(media.id)}
          onSaved={(m) => {
            setDirty(false);
            onSaved(m);
          }}
          onDeleted={(id) => {
            setDirty(false);
            onDeleted(id);
          }}
        />
      ) : null}
    </Sheet>
  );
}

interface FormValues {
  title: string;
  caption: string;
  alt: string;
  kind: MediaKind;
  collectionId: string;
  brandId: string;
  featured: boolean;
  published: boolean;
  posterOffset: number;
  sourceUrl: string;
}

function toFormValues(media: MediaItem): FormValues {
  return {
    title: media.title ?? "",
    caption: media.caption ?? "",
    alt: media.alt ?? "",
    kind: media.kind,
    collectionId: media.collectionId ?? "",
    brandId: media.brandId ?? "",
    featured: media.featured,
    published: media.published,
    posterOffset: media.posterOffset ?? 0,
    sourceUrl: media.sourceUrl ?? "",
  };
}

function toPatch(values: FormValues, media: MediaItem): MediaPatch {
  const sourceUrl = emptyToNull(values.sourceUrl);
  return {
    title: emptyToNull(values.title),
    caption: emptyToNull(values.caption),
    alt: emptyToNull(values.alt),
    kind: values.kind,
    collectionId: values.collectionId || null,
    brandId: values.brandId || null,
    featured: values.featured,
    published: values.published,
    posterOffset: Math.round(values.posterOffset * 10) / 10,
    // Only sent when changed, so saving other fields never touches the column
    // (keeps saves working on a database that doesn't have it yet).
    ...(sourceUrl !== (media.sourceUrl ?? null) ? { sourceUrl } : {}),
  };
}

function EditorBody({
  media,
  collections,
  brands,
  onDirtyChange,
  onEditVisual,
  onSaved,
  onDeleted,
}: {
  media: MediaItem;
  collections: Collection[];
  brands: Brand[];
  onDirtyChange: (dirty: boolean) => void;
  onEditVisual: () => void;
  onSaved: (media: MediaItem) => void;
  onDeleted: (id: string) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const {
    register,
    control,
    handleSubmit,
    setError,
    setValue,
    reset,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<FormValues>({ defaultValues: toFormValues(media) });

  useEffect(() => {
    onDirtyChange(isDirty);
  }, [isDirty, onDirtyChange]);
  useUnsavedChanges(isDirty);

  const video = media.resourceType === "video";
  const posterOffset = useWatch({ control, name: "posterOffset" });
  const duration = media.duration && media.duration > 0 ? media.duration : 0;
  // posterOffset is in seconds of the ORIGINAL clip; the preview below plays the
  // edited (trimmed) delivery, so it starts at trimStart.
  const posterMin = media.edits?.trimStart ?? 0;
  const posterMax = media.edits?.trimEnd ?? duration;
  const poster = video ? videoPosterUrl(media, { width: 720, offset: media.posterOffset }) : null;

  const onSubmit = handleSubmit(async (values) => {
    const patch = validateWith(mediaPatchSchema, toPatch(values, media), setError);
    if (!patch) return;
    const result = await callAction(() => updateMedia(media.id, patch as MediaPatch), { success: "Saved" });
    if (result.ok) {
      reset(toFormValues(result.data));
      onSaved(result.data);
    } else {
      applyFieldErrors(result.fieldErrors, setError);
    }
  });

  function seek(seconds: number) {
    const el = videoRef.current;
    if (!el) return;
    el.pause();
    try {
      el.currentTime = seconds;
    } catch {
      // metadata not loaded yet
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5" aria-label="Edit media details" noValidate>
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="secondary" size="sm" onClick={onEditVisual}>
          <Crop aria-hidden /> Edit {video ? "video" : "photo"}
        </Button>
        <span className="text-xs text-(--a-ink-soft)">
          {media.edits ? (
            <span className="inline-flex items-center gap-1">
              <Wand2 className="size-3.5" aria-hidden /> Edited. The original file is kept.
            </span>
          ) : (
            "Crop, rotate, zoom, adjust light" + (video ? " or trim." : ".")
          )}
        </span>
      </div>
      <div className="overflow-hidden rounded-lg bg-(--a-ink)">
        {video ? (
          <video
            ref={videoRef}
            src={videoUrl(media, { width: 720 })}
            poster={poster ?? undefined}
            controls
            playsInline
            preload="metadata"
            className="mx-auto max-h-[46dvh] w-full object-contain"
            aria-label={media.alt ?? mediaLabel(media)}
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element -- Cloudinary-sized preview
          <img
            src={imageUrl(media, { width: 900, crop: "limit" })}
            alt={media.alt ?? ""}
            className="mx-auto max-h-[46dvh] w-full object-contain"
          />
        )}
      </div>

      {video ? (
        <div className="flex flex-col gap-2 rounded-lg border border-(--a-line) p-3">
          <div className="flex items-center justify-between gap-2">
            <span id="poster-label" className="text-[13px] font-medium text-(--a-ink)">
              Cover frame
            </span>
            <span className="text-xs tabular-nums text-(--a-ink-soft)">{posterOffset.toFixed(1)}s</span>
          </div>
          <Controller
            control={control}
            name="posterOffset"
            render={({ field }) => (
              <Slider.Root
                className="relative flex h-11 w-full touch-none items-center select-none sm:h-6"
                min={posterMin}
                max={posterMax > posterMin ? posterMax : posterMin + 30}
                step={0.1}
                value={[Math.min(Math.max(field.value, posterMin), posterMax > posterMin ? posterMax : posterMin + 30)]}
                onValueChange={([v]) => {
                  field.onChange(v);
                  seek(v - posterMin);
                }}
                aria-labelledby="poster-label"
              >
                <Slider.Track className="relative h-1.5 grow rounded-full bg-(--a-muted-strong)">
                  <Slider.Range className="absolute h-full rounded-full bg-(--a-primary)" />
                </Slider.Track>
                <Slider.Thumb
                  aria-label="Cover frame time in seconds"
                  className="block size-5 cursor-grab rounded-full border border-(--a-line-strong) bg-(--a-surface) shadow outline-none focus-visible:ring-2 focus-visible:ring-(--a-ring) active:cursor-grabbing"
                />
              </Slider.Root>
            )}
          />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-(--a-ink-soft)">The frame shown before the video plays.</p>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                const t = (videoRef.current?.currentTime ?? 0) + posterMin;
                setValue("posterOffset", Math.round(t * 10) / 10, { shouldDirty: true });
              }}
            >
              <Crosshair aria-hidden />
              Use current frame
            </Button>
          </div>
        </div>
      ) : null}

      <div className="grid gap-4">
        <Field id="m-title" label="Title" error={errors.title?.message}>
          <Input {...fieldA11y("m-title", errors.title?.message)} {...register("title")} placeholder="e.g. Product try-on reel" />
        </Field>
        <Field id="m-caption" label="Caption" hint="Optional line shown with the item on your site." error={errors.caption?.message}>
          <Textarea {...fieldA11y("m-caption", errors.caption?.message, true)} rows={2} {...register("caption")} />
        </Field>
        <Field
          id="m-alt"
          label={video ? "Description for screen readers" : "Alt text"}
          hint="Describe what's in it in a few words. Helps accessibility and search."
          error={errors.alt?.message}
        >
          <Input {...fieldA11y("m-alt", errors.alt?.message, true)} {...register("alt")} />
        </Field>
        <Field
          id="m-source-url"
          label="Link to original post"
          hint="Visitors can open it to see the real views and likes."
          error={errors.sourceUrl?.message}
        >
          <Input
            {...fieldA11y("m-source-url", errors.sourceUrl?.message, true)}
            {...register("sourceUrl")}
            type="url"
            inputMode="url"
            autoComplete="off"
            spellCheck={false}
            placeholder="https://www.instagram.com/reel/…"
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field id="m-kind" label="Type" error={errors.kind?.message}>
            <Select {...fieldA11y("m-kind", errors.kind?.message)} {...register("kind")}>
              {MEDIA_KINDS.map((k) => (
                <option key={k} value={k}>
                  {KIND_LABELS[k]}
                </option>
              ))}
            </Select>
          </Field>
          <Field id="m-collection" label="Collection" error={errors.collectionId?.message}>
            <Select {...fieldA11y("m-collection", errors.collectionId?.message)} {...register("collectionId")}>
              <option value="">None</option>
              {collections.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </Select>
          </Field>
          <Field id="m-brand" label="Brand" error={errors.brandId?.message}>
            <Select {...fieldA11y("m-brand", errors.brandId?.message)} {...register("brandId")}>
              <option value="">None</option>
              {brands.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <div className="flex flex-wrap gap-x-6">
          <Controller
            control={control}
            name="published"
            render={({ field }) => (
              <Switch showLabel label="Published (visible on site)" checked={field.value} onCheckedChange={field.onChange} />
            )}
          />
          <Controller
            control={control}
            name="featured"
            render={({ field }) => <Switch showLabel label="Featured" checked={field.value} onCheckedChange={field.onChange} />}
          />
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 rounded-lg bg-(--a-muted) p-3 text-xs text-(--a-ink-soft) sm:grid-cols-4">
        <div>
          <dt className="text-(--a-ink-soft)">Size</dt>
          <dd>{media.width && media.height ? `${media.width}×${media.height}` : "—"}</dd>
        </div>
        <div>
          <dt className="text-(--a-ink-soft)">{video ? "Length" : "Format"}</dt>
          <dd>{video ? formatDuration(media.duration) || "—" : (media.format ?? "—")}</dd>
        </div>
        <div>
          <dt className="text-(--a-ink-soft)">File</dt>
          <dd>{formatBytes(media.bytes) || "—"}</dd>
        </div>
        <div className="min-w-0">
          <dt className="text-(--a-ink-soft)">ID</dt>
          <dd className="truncate" title={media.publicId}>
            {media.publicId}
          </dd>
        </div>
      </dl>

      <div className="sticky bottom-0 -mx-5 -mb-4 flex flex-wrap items-center gap-2 border-t border-(--a-line) bg-(--a-surface) px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <Button type="submit" variant="primary" pending={isSubmitting} disabled={!isDirty}>
          Save changes
        </Button>
        <UploadButton
          folder="media"
          variant="secondary"
          onUploaded={async (upload) => {
            const result = await callAction(() => replaceMediaAsset(media.id, upload), { success: "File replaced" });
            if (result.ok) onSaved(result.data);
            return result.ok;
          }}
        >
          <RefreshCw aria-hidden /> Replace file
        </UploadButton>
        <Button variant="danger-ghost" className="ml-auto" onClick={() => setConfirmDelete(true)}>
          <Trash2 aria-hidden /> Delete
        </Button>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`Delete “${mediaLabel(media)}”?`}
        description="The file is removed from your library and your site. This can't be undone."
        onConfirm={async () => {
          const result = await callAction(() => deleteMedia(media.id), { success: "Deleted" });
          if (result.ok) onDeleted(media.id);
          return result.ok;
        }}
      />
    </form>
  );
}
