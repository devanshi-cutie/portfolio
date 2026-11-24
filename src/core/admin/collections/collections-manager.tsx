"use client";

import { useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { ExternalLink, FolderOpen, Pencil, Plus, Trash2 } from "lucide-react";
import type { Collection, MediaItem } from "@/core/types/content";
import type { CollectionInput } from "@/core/types/admin";
import { collectionInputSchema } from "@/core/schemas";
import { createCollection, deleteCollection, reorderCollections, updateCollection } from "@/core/actions/collections";
import { slugify } from "@/core/lib/slug";
import { useAction } from "../lib/use-action";
import { useServerState } from "../lib/use-server-state";
import { emptyToNull, pluralize } from "../lib/format";
import { applyFieldErrors, validateWith } from "../lib/validate";
import { useUnsavedChanges } from "../lib/use-unsaved-changes";
import { Button } from "../ui/button";
import { ConfirmDialog, Modal } from "../ui/dialogs";
import { Field, Input, Textarea, fieldA11y } from "../ui/field";
import { EmptyState, PageHeader } from "../ui/misc";
import { DragHandle, SortableContainer, SortableItem, moveItem } from "../ui/sortable";
import { Switch } from "../ui/switch";
import { MediaThumb } from "../media/media-thumb";
import { MediaPickerField } from "../media/media-picker";

interface Props {
  collections: Collection[];
  media: MediaItem[];
}

export function CollectionsManager({ collections, media }: Props) {
  const [items, setItems] = useServerState(collections);
  const [editing, setEditing] = useState<Collection | "new" | null>(null);
  const [deleting, setDeleting] = useState<Collection | null>(null);
  const { run } = useAction();

  const mediaById = useMemo(() => new Map(media.map((m) => [m.id, m])), [media]);
  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const m of media) if (m.collectionId) map.set(m.collectionId, (map.get(m.collectionId) ?? 0) + 1);
    return map;
  }, [media]);

  function handleMove(from: number, to: number) {
    const previous = items;
    const next = moveItem(items, from, to);
    void run(() => reorderCollections(next.map((c) => c.id)), {
      optimistic: () => setItems(next),
      rollback: () => setItems(previous),
    });
  }

  function togglePublished(collection: Collection, published: boolean) {
    const previous = items;
    void run(() => updateCollection(collection.id, { published }), {
      key: `pub-${collection.id}`,
      success: published ? `“${collection.title}” is visible` : `“${collection.title}” is hidden`,
      optimistic: () => setItems((list) => list.map((c) => (c.id === collection.id ? { ...c, published } : c))),
      rollback: () => setItems(previous),
    });
  }

  return (
    <>
      <PageHeader
        title="Collections"
        description="Groups of work, like Jewellery or Real estate. Each published collection gets its own page."
        actions={
          <Button variant="primary" onClick={() => setEditing("new")}>
            <Plus aria-hidden /> New collection
          </Button>
        }
      />

      {items.length === 0 ? (
        <EmptyState icon={<FolderOpen />} title="No collections yet">
          Create one, then assign media to it from the Media library.
        </EmptyState>
      ) : (
        <SortableContainer ids={items.map((c) => c.id)} onMove={handleMove} getLabel={(id) => items.find((c) => c.id === id)?.title ?? "collection"}>
          <ul className="flex flex-col gap-2" aria-label="Collections">
            {items.map((c) => (
              <SortableItem key={c.id} id={c.id} className="rounded-lg border border-(--a-line) bg-(--a-surface)">
                {() => (
                  <div className="flex flex-wrap items-center gap-x-2 p-2 sm:flex-nowrap sm:gap-3">
                    <DragHandle label={c.title} />
                    <MediaThumb media={c.coverMediaId ? mediaById.get(c.coverMediaId) : null} width={120} className="size-12 shrink-0 rounded-md" />
                    <div className="min-w-36 flex-1">
                      <p className="truncate text-sm font-medium text-(--a-ink)">{c.title}</p>
                      <p className="truncate text-xs text-(--a-ink-soft)">
                        /work/{c.slug} · {pluralize(counts.get(c.id) ?? 0, "item")}
                      </p>
                    </div>
                    <div className="ml-auto flex items-center gap-1">
                    <Switch label={`Show “${c.title}” on site`} checked={c.published} onCheckedChange={(v) => togglePublished(c, v)} className="px-1" />
                      <Button asChild variant="ghost" size="icon-sm" className="hidden sm:inline-flex">
                        <a href={`/work/${c.slug}`} target="_blank" rel="noreferrer" aria-label={`View “${c.title}” page (opens in a new tab)`}>
                          <ExternalLink />
                        </a>
                      </Button>
                      <Button variant="ghost" size="icon-sm" aria-label={`Edit “${c.title}”`} onClick={() => setEditing(c)}>
                        <Pencil />
                      </Button>
                      <Button variant="danger-ghost" size="icon-sm" aria-label={`Delete “${c.title}”`} onClick={() => setDeleting(c)}>
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

      <CollectionDialog
        target={editing}
        media={media}
        onClose={() => setEditing(null)}
        onSaved={(saved, isNew) => {
          setItems((list) => (isNew ? [...list, saved] : list.map((c) => (c.id === saved.id ? saved : c))));
          setEditing(null);
        }}
      />

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={`Delete collection “${deleting?.title ?? ""}”?`}
        description={
          deleting && (counts.get(deleting.id) ?? 0) > 0
            ? `Its ${pluralize(counts.get(deleting.id) ?? 0, "media item")} stay in your library but won't belong to a collection. The /work/${deleting.slug} page goes away.`
            : "The collection and its page are removed. This can't be undone."
        }
        onConfirm={async () => {
          if (!deleting) return;
          const target = deleting;
          const result = await run(() => deleteCollection(target.id), { success: `Deleted “${target.title}”` });
          if (result.ok) setItems((list) => list.filter((c) => c.id !== target.id));
          return result.ok;
        }}
      />
    </>
  );
}

/* ---------------------------------------------------------------- dialog */

interface FormValues {
  title: string;
  slug: string;
  description: string;
  coverMediaId: string | null;
  published: boolean;
}

function CollectionDialog({
  target,
  media,
  onClose,
  onSaved,
}: {
  target: Collection | "new" | null;
  media: MediaItem[];
  onClose: () => void;
  onSaved: (c: Collection, isNew: boolean) => void;
}) {
  const open = target !== null;
  const key = target === "new" ? "new" : (target?.id ?? "none");
  return (
    <Modal open={open} onOpenChange={(v) => !v && onClose()} title={target === "new" ? "New collection" : `Edit “${target?.title ?? ""}”`} size="lg" modalLock>
      {open ? <CollectionForm key={key} collection={target === "new" ? null : target} media={media} onCancel={onClose} onSaved={onSaved} /> : null}
    </Modal>
  );
}

function CollectionForm({
  collection,
  media,
  onCancel,
  onSaved,
}: {
  collection: Collection | null;
  media: MediaItem[];
  onCancel: () => void;
  onSaved: (c: Collection, isNew: boolean) => void;
}) {
  const { run } = useAction();
  const [slugTouched, setSlugTouched] = useState(collection !== null);
  const {
    register,
    control,
    handleSubmit,
    setValue,
    setError,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<FormValues>({
    defaultValues: {
      title: collection?.title ?? "",
      slug: collection?.slug ?? "",
      description: collection?.description ?? "",
      coverMediaId: collection?.coverMediaId ?? null,
      published: collection?.published ?? true,
    },
  });
  useUnsavedChanges(isDirty);

  // collection media first in the cover picker
  const coverOptions = useMemo(() => {
    if (!collection) return media;
    const inCollection = media.filter((m) => m.collectionId === collection.id);
    return [...inCollection, ...media.filter((m) => m.collectionId !== collection.id)];
  }, [media, collection]);

  const onSubmit = handleSubmit(async (values) => {
    const input: CollectionInput = {
      title: values.title.trim(),
      slug: values.slug.trim() || slugify(values.title),
      description: emptyToNull(values.description),
      coverMediaId: values.coverMediaId,
      published: values.published,
    };
    const parsed = validateWith(collectionInputSchema, input, setError);
    if (!parsed) return;
    const result = collection
      ? await run(() => updateCollection(collection.id, parsed), { success: "Collection saved" })
      : await run(() => createCollection(parsed), { success: `Created “${parsed.title}”` });
    if (result.ok) onSaved(result.data, !collection);
    else applyFieldErrors(result.fieldErrors, setError);
  });

  const titleField = register("title", {
    onChange: (e) => {
      if (!slugTouched) setValue("slug", slugify(e.target.value));
    },
  });

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="c-title" label="Title" error={errors.title?.message}>
          <Input {...fieldA11y("c-title", errors.title?.message)} {...titleField} placeholder="Jewellery" autoFocus />
        </Field>
        <Field id="c-slug" label="Page address" hint="yoursite.com/work/…" error={errors.slug?.message}>
          <Input
            {...fieldA11y("c-slug", errors.slug?.message, true)}
            {...register("slug", { onChange: () => setSlugTouched(true) })}
            spellCheck={false}
            autoCapitalize="none"
          />
        </Field>
      </div>
      <Field id="c-description" label="Description" error={errors.description?.message}>
        <Textarea {...fieldA11y("c-description", errors.description?.message)} rows={3} {...register("description")} />
      </Field>
      <Controller
        control={control}
        name="coverMediaId"
        render={({ field }) => (
          <MediaPickerField id="c-cover" label="Cover" hint="Shown on the collection card." media={coverOptions} value={field.value} onChange={field.onChange} />
        )}
      />
      <Controller
        control={control}
        name="published"
        render={({ field }) => <Switch showLabel label="Published (visible on site)" checked={field.value} onCheckedChange={field.onChange} />}
      />
      <div className="flex justify-end gap-2 border-t border-(--a-line) pt-4">
        <Button variant="ghost" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" pending={isSubmitting}>
          {collection ? "Save" : "Create collection"}
        </Button>
      </div>
    </form>
  );
}
