"use client";

import { useDeferredValue, useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { Building2, Pencil, Plus, Search, Star, Trash2, Upload } from "lucide-react";
import type { Brand, MediaItem } from "@/core/types/content";
import { DEFAULT_BRAND_TAGS } from "@/core/types/content";
import type { BrandInput } from "@/core/types/admin";
import { brandInputSchema } from "@/core/schemas";
import { createBrand, deleteBrand, reorderBrands, updateBrand } from "@/core/actions/brands";
import { createMediaFromUpload } from "@/core/actions/media";
import { slugify } from "@/core/lib/slug";
import { callAction, useAction } from "../lib/use-action";
import { useServerState } from "../lib/use-server-state";
import { emptyToNull, pluralize } from "../lib/format";
import { applyFieldErrors, validateWith } from "../lib/validate";
import { cn } from "../lib/cn";
import { Button, focusRing } from "../ui/button";
import { ConfirmDialog, Modal } from "../ui/dialogs";
import { Field, Input, Select, fieldA11y } from "../ui/field";
import { Badge, EmptyState, PageHeader } from "../ui/misc";
import { DragHandle, SortableContainer, SortableItem, moveItem } from "../ui/sortable";
import { Switch } from "../ui/switch";
import { TagInput } from "../ui/tag-input";
import { MediaThumb } from "../media/media-thumb";
import { MediaPickerField } from "../media/media-picker";
import { UploadButton } from "../upload/upload-button";

interface Props {
  brands: Brand[];
  media: MediaItem[];
}

export function BrandsManager({ brands, media }: Props) {
  const [items, setItems] = useServerState(brands);
  const [mediaList, setMediaList] = useServerState(media);
  const [q, setQ] = useState("");
  const [tag, setTag] = useState("");
  const deferredQ = useDeferredValue(q);
  const [editing, setEditing] = useState<Brand | "new" | null>(null);
  const [deleting, setDeleting] = useState<Brand | null>(null);
  const [deleteLogo, setDeleteLogo] = useState(true);
  const { run } = useAction();

  const mediaById = useMemo(() => new Map(mediaList.map((m) => [m.id, m])), [mediaList]);
  const allTags = useMemo(() => {
    const set = new Set<string>(DEFAULT_BRAND_TAGS);
    for (const b of items) for (const t of b.tags) set.add(t);
    return [...set].sort();
  }, [items]);

  const filtering = deferredQ.trim() !== "" || tag !== "";
  const visible = useMemo(() => {
    const query = deferredQ.trim().toLowerCase();
    return items.filter((b) => {
      if (tag === "featured" ? !b.featured : tag && !b.tags.includes(tag)) return false;
      if (query && !`${b.name} ${b.slug}`.toLowerCase().includes(query)) return false;
      return true;
    });
  }, [items, deferredQ, tag]);

  function handleMove(from: number, to: number) {
    const previous = items;
    const next = moveItem(items, from, to);
    void run(() => reorderBrands(next.map((b) => b.id)), {
      optimistic: () => setItems(next),
      rollback: () => setItems(previous),
    });
  }

  function patchBrand(brand: Brand, patch: Partial<BrandInput>, message: string) {
    const previous = items;
    void run(() => updateBrand(brand.id, patch), {
      success: message,
      optimistic: () => setItems((list) => list.map((b) => (b.id === brand.id ? { ...b, ...patch } : b))),
      rollback: () => setItems(previous),
    });
  }

  return (
    <>
      <PageHeader
        title="Brands"
        description={`${pluralize(items.length, "brand")} you've worked with. Featured brands are shown first; drag to set the order.`}
        actions={
          <Button variant="primary" onClick={() => setEditing("new")}>
            <Plus aria-hidden /> New brand
          </Button>
        }
      />

      <div role="search" className="mb-3 flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-(--a-ink-soft)" />
          <Input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search brands" aria-label="Search brands" className="pl-9" />
        </div>
        <Select aria-label="Filter by tag" className="sm:w-48" value={tag} onChange={(e) => setTag(e.target.value)}>
          <option value="">All tags</option>
          <option value="featured">Featured only</option>
          {allTags.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </Select>
      </div>
      {filtering ? (
        <p className="mb-3 text-xs text-(--a-ink-soft)" aria-live="polite">
          Showing {visible.length} of {items.length}. Clear the search to drag and reorder.
        </p>
      ) : null}

      {items.length === 0 ? (
        <EmptyState icon={<Building2 />} title="No brands yet">
          Add the brands you&apos;ve collaborated with. Their names and logos appear in the Brands section.
        </EmptyState>
      ) : (
        <SortableContainer
          ids={visible.map((b) => b.id)}
          onMove={handleMove}
          disabled={filtering}
          getLabel={(id) => items.find((b) => b.id === id)?.name ?? "brand"}
        >
          <ul className="flex flex-col gap-1.5" aria-label="Brands">
            {visible.map((b) => (
              <SortableItem key={b.id} id={b.id} className="rounded-lg border border-(--a-line) bg-(--a-surface)">
                {() => (
                  <div className={cn("flex flex-wrap items-center gap-x-2 gap-y-0 p-1.5 sm:flex-nowrap sm:gap-3", filtering && "pl-3")}>
                    <DragHandle label={b.name} />
                    <MediaThumb
                      media={b.logoMediaId ? mediaById.get(b.logoMediaId) : null}
                      width={120}
                      fit="contain"
                      className="size-10 shrink-0 rounded-md border border-(--a-line) bg-(--a-surface)"
                    />
                    <div className="min-w-36 flex-1">
                      <p className={cn("truncate text-sm font-medium", b.published ? "text-(--a-ink)" : "text-(--a-ink-soft)")}>
                        {b.name}
                        {!b.published ? <span className="ml-2 text-xs font-normal text-(--a-ink-soft)">Hidden</span> : null}
                      </p>
                      <div className="mt-0.5 flex flex-wrap gap-1">
                        {b.tags.map((t) => (
                          <Badge key={t}>{t}</Badge>
                        ))}
                      </div>
                    </div>
                    <div className="ml-auto flex items-center gap-1 sm:gap-2">
                    <button
                      type="button"
                      onClick={() => patchBrand(b, { featured: !b.featured }, b.featured ? `“${b.name}” unfeatured` : `“${b.name}” featured`)}
                      aria-pressed={b.featured}
                      aria-label={`Feature ${b.name}`}
                      className={cn(
                        "inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-md transition-colors duration-100 hover:bg-(--a-muted) sm:pointer-fine:size-8",
                        b.featured ? "text-(--a-accent)" : "text-(--a-ink-soft) hover:text-(--a-ink-soft)",
                        focusRing,
                      )}
                    >
                      <Star className={cn("size-4", b.featured && "fill-current")} aria-hidden />
                    </button>
                    <Switch
                      label={`Show ${b.name} on site`}
                      checked={b.published}
                      onCheckedChange={(v) => patchBrand(b, { published: v }, v ? `“${b.name}” is visible` : `“${b.name}” is hidden`)}
                      className="px-1"
                    />
                    <Button variant="ghost" size="icon-sm" aria-label={`Edit ${b.name}`} onClick={() => setEditing(b)}>
                      <Pencil />
                    </Button>
                    <Button
                      variant="danger-ghost"
                      size="icon-sm"
                      aria-label={`Delete ${b.name}`}
                      onClick={() => {
                        setDeleteLogo(true);
                        setDeleting(b);
                      }}
                    >
                      <Trash2 />
                    </Button>
                    </div>
                  </div>
                )}
              </SortableItem>
            ))}
          </ul>
        </SortableContainer>
      )}

      <Modal
        open={editing !== null}
        onOpenChange={(v) => !v && setEditing(null)}
        title={editing === "new" ? "New brand" : `Edit ${editing?.name ?? ""}`}
        size="lg"
        modalLock
      >
        {editing !== null ? (
          <BrandForm
            key={editing === "new" ? "new" : editing.id}
            brand={editing === "new" ? null : editing}
            media={mediaList}
            allTags={allTags}
            onMediaCreated={(m) => setMediaList((list) => [...list, m])}
            onCancel={() => setEditing(null)}
            onSaved={(saved, isNew) => {
              setItems((list) => (isNew ? [...list, saved] : list.map((b) => (b.id === saved.id ? saved : b))));
              setEditing(null);
            }}
          />
        ) : null}
      </Modal>

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={`Delete ${deleting?.name ?? "brand"}?`}
        description="The brand is removed from your site. Media tagged with it stay in your library."
        onConfirm={async () => {
          if (!deleting) return;
          const target = deleting;
          const withLogo = deleteLogo && target.logoMediaId !== null;
          const result = await run(() => deleteBrand(target.id, { deleteLogo: withLogo }), { success: `Deleted ${target.name}` });
          if (result.ok) setItems((list) => list.filter((b) => b.id !== target.id));
          return result.ok;
        }}
      >
        {deleting?.logoMediaId ? (
          <label className="flex min-h-11 cursor-pointer items-center gap-2.5 text-sm text-(--a-ink)">
            <input type="checkbox" checked={deleteLogo} onChange={(e) => setDeleteLogo(e.target.checked)} className="size-4 accent-(--a-primary)" />
            Also delete the logo file
          </label>
        ) : null}
      </ConfirmDialog>
    </>
  );
}

/* ------------------------------------------------------------------ form */

interface FormValues {
  name: string;
  slug: string;
  websiteUrl: string;
  tags: string[];
  featured: boolean;
  published: boolean;
  logoMediaId: string | null;
}

function BrandForm({
  brand,
  media,
  allTags,
  onMediaCreated,
  onCancel,
  onSaved,
}: {
  brand: Brand | null;
  media: MediaItem[];
  allTags: string[];
  onMediaCreated: (m: MediaItem) => void;
  onCancel: () => void;
  onSaved: (b: Brand, isNew: boolean) => void;
}) {
  const { run } = useAction();
  const [slugTouched, setSlugTouched] = useState(brand !== null);
  const {
    register,
    control,
    handleSubmit,
    setValue,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    defaultValues: {
      name: brand?.name ?? "",
      slug: brand?.slug ?? "",
      websiteUrl: brand?.websiteUrl ?? "",
      tags: brand?.tags ?? ["ugc"],
      featured: brand?.featured ?? false,
      published: brand?.published ?? true,
      logoMediaId: brand?.logoMediaId ?? null,
    },
  });

  const logoChoices = useMemo(() => media.filter((m) => m.resourceType === "image"), [media]);

  const onSubmit = handleSubmit(async (values) => {
    const input: BrandInput = {
      name: values.name.trim(),
      slug: values.slug.trim() || slugify(values.name),
      websiteUrl: emptyToNull(values.websiteUrl),
      tags: values.tags,
      featured: values.featured,
      published: values.published,
      logoMediaId: values.logoMediaId,
    };
    const parsed = validateWith(brandInputSchema, input, setError);
    if (!parsed) return;
    const result = brand
      ? await run(() => updateBrand(brand.id, parsed), { success: `Saved ${parsed.name}` })
      : await run(() => createBrand(parsed), { success: `Added ${parsed.name}` });
    if (result.ok) onSaved(result.data, !brand);
    else applyFieldErrors(result.fieldErrors, setError);
  });

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="b-name" label="Name" error={errors.name?.message}>
          <Input
            {...fieldA11y("b-name", errors.name?.message)}
            {...register("name", { onChange: (e) => !slugTouched && setValue("slug", slugify(e.target.value)) })}
            autoFocus
          />
        </Field>
        <Field id="b-slug" label="Short name (URL-safe)" error={errors.slug?.message}>
          <Input
            {...fieldA11y("b-slug", errors.slug?.message)}
            {...register("slug", { onChange: () => setSlugTouched(true) })}
            spellCheck={false}
            autoCapitalize="none"
          />
        </Field>
        <Field id="b-website" label="Website" className="sm:col-span-2" error={errors.websiteUrl?.message}>
          <Input {...fieldA11y("b-website", errors.websiteUrl?.message)} type="url" placeholder="https://" {...register("websiteUrl")} />
        </Field>
        <Field id="b-tags" label="Tags" className="sm:col-span-2" hint="ugc = content made for the brand; instagram = collab posted on your profile." error={errors.tags?.message}>
          <Controller
            control={control}
            name="tags"
            render={({ field }) => (
              <TagInput
                id="b-tags"
                value={field.value}
                onChange={field.onChange}
                suggestions={allTags}
                normalize={(v) => v.toLowerCase()}
                describedBy="b-tags-hint"
                placeholder="Add a tag"
              />
            )}
          />
        </Field>
      </div>

      <div className="flex flex-col gap-2 rounded-lg border border-(--a-line) p-3">
        <Controller
          control={control}
          name="logoMediaId"
          render={({ field }) => (
            <MediaPickerField
              id="b-logo"
              label="Logo"
              hint="PNG or SVG with a transparent background looks best."
              media={logoChoices}
              value={field.value}
              onChange={field.onChange}
              imagesOnly
              preferKind="logo"
            />
          )}
        />
        <div>
          <UploadButton
            folder="logos"
            accept="image"
            variant="secondary"
            size="sm"
            onUploaded={async (upload) => {
              const result = await callAction(
                () => createMediaFromUpload(upload, { kind: "logo", brandId: brand?.id ?? null, published: true, title: brand?.name ?? null }),
                { success: "Logo uploaded. Save to keep it." },
              );
              if (result.ok) {
                onMediaCreated(result.data);
                setValue("logoMediaId", result.data.id, { shouldDirty: true });
              }
              return result.ok;
            }}
          >
            <Upload aria-hidden /> Upload new logo
          </UploadButton>
        </div>
      </div>

      <div className="flex flex-wrap gap-x-6">
        <Controller
          control={control}
          name="featured"
          render={({ field }) => <Switch showLabel label="Featured (shown first)" checked={field.value} onCheckedChange={field.onChange} />}
        />
        <Controller
          control={control}
          name="published"
          render={({ field }) => <Switch showLabel label="Published (visible on site)" checked={field.value} onCheckedChange={field.onChange} />}
        />
      </div>
      <div className="flex justify-end gap-2 border-t border-(--a-line) pt-4">
        <Button variant="ghost" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" pending={isSubmitting}>
          {brand ? "Save" : "Add brand"}
        </Button>
      </div>
    </form>
  );
}
