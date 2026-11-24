"use client";

import { useCallback, useDeferredValue, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Images, Search, X } from "lucide-react";
import type { Brand, Collection, MediaItem, MediaKind } from "@/core/types/content";
import { MEDIA_KINDS } from "@/core/types/content";
import type { MediaPatch } from "@/core/types/admin";
import { bulkUpdateMedia, createMediaFromUpload, deleteMedia, reorderMedia } from "@/core/actions/media";
import { callAction } from "../lib/use-action";
import { useServerState } from "../lib/use-server-state";
import { pluralize } from "../lib/format";
import { Button } from "../ui/button";
import { Input, Select } from "../ui/field";
import { EmptyState, PageHeader } from "../ui/misc";
import { SortableContainer, SortableItem, moveItem } from "../ui/sortable";
import { UploadButton } from "../upload/upload-button";
import { MediaCard } from "./media-card";
import { MediaEditor } from "./media-editor";
import { MediaStudio } from "./media-studio";
import { BulkBar } from "./bulk-bar";
import { KIND_SHORT, guessKind, mediaLabel } from "./labels";

type Status = "" | "published" | "draft" | "featured";

interface Filters {
  kind: MediaKind | "";
  collectionId: string; // "" = all, "none" = unassigned
  brandId: string;
  status: Status;
  q: string;
}

const EMPTY_FILTERS: Filters = { kind: "", collectionId: "", brandId: "", status: "", q: "" };

interface MediaLibraryProps {
  media: MediaItem[];
  collections: Collection[];
  brands: Brand[];
}

export function MediaLibrary({ media, collections, brands }: MediaLibraryProps) {
  const router = useRouter();
  const [items, setItems] = useServerState(media);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const deferredQ = useDeferredValue(filters.q);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const lastClicked = useRef<string | null>(null);

  const collectionById = useMemo(() => new Map(collections.map((c) => [c.id, c])), [collections]);
  const brandById = useMemo(() => new Map(brands.map((b) => [b.id, b])), [brands]);

  const visible = useMemo(() => {
    const q = deferredQ.trim().toLowerCase();
    return items.filter((m) => {
      if (filters.kind && m.kind !== filters.kind) return false;
      if (filters.collectionId === "none" ? m.collectionId : filters.collectionId && m.collectionId !== filters.collectionId) return false;
      if (filters.brandId === "none" ? m.brandId : filters.brandId && m.brandId !== filters.brandId) return false;
      if (filters.status === "published" && !m.published) return false;
      if (filters.status === "draft" && m.published) return false;
      if (filters.status === "featured" && !m.featured) return false;
      if (q) {
        const haystack = `${m.title ?? ""} ${m.caption ?? ""} ${m.publicId}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [items, filters.kind, filters.collectionId, filters.brandId, filters.status, deferredQ]);

  const visibleIds = useMemo(() => visible.map((m) => m.id), [visible]);
  const filtersActive = JSON.stringify(filters) !== JSON.stringify(EMPTY_FILTERS);
  const editing = editingId ? (items.find((m) => m.id === editingId) ?? null) : null;
  const selectedIds = useMemo(() => visibleIds.filter((id) => selected.has(id)), [visibleIds, selected]);

  const setFilter = <K extends keyof Filters>(key: K, value: Filters[K]) => setFilters((f) => ({ ...f, [key]: value }));

  /* ------------------------------------------------------------ selection */

  const toggleSelect = useCallback(
    (id: string, shiftKey: boolean) => {
      setSelected((prev) => {
        const next = new Set(prev);
        const anchor = lastClicked.current;
        if (shiftKey && anchor && anchor !== id) {
          const a = visibleIds.indexOf(anchor);
          const b = visibleIds.indexOf(id);
          if (a >= 0 && b >= 0) {
            const shouldSelect = !prev.has(id);
            for (const rangeId of visibleIds.slice(Math.min(a, b), Math.max(a, b) + 1)) {
              if (shouldSelect) next.add(rangeId);
              else next.delete(rangeId);
            }
            lastClicked.current = id;
            return next;
          }
        }
        if (next.has(id)) next.delete(id);
        else next.add(id);
        lastClicked.current = id;
        return next;
      });
    },
    [visibleIds],
  );

  const openEditor = useCallback((id: string) => setEditingId(id), []);
  const [studioId, setStudioId] = useState<string | null>(null);
  const openStudio = useCallback((id: string) => setStudioId(id), []);
  const studioMedia = studioId ? (items.find((m) => m.id === studioId) ?? null) : null;
  /** items created by the current upload batch, in order */
  const uploadedBatch = useRef<MediaItem[]>([]);

  /* -------------------------------------------------------------- reorder */

  function handleMove(from: number, to: number) {
    const reorderedVisible = moveItem(visible, from, to);
    const visibleSet = new Set(visibleIds);
    // put the reordered visible items back into the slots the visible items occupied
    let cursor = 0;
    const previous = items;
    const next = items.map((m) => (visibleSet.has(m.id) ? reorderedVisible[cursor++] : m));
    void callAction(() => reorderMedia(reorderedVisible.map((m) => m.id)), {
      optimistic: () => setItems(next),
      rollback: () => setItems(previous),
    });
  }

  /* ----------------------------------------------------------------- bulk */

  async function applyBulk(patch: MediaPatch, message: string) {
    const ids = selectedIds;
    if (ids.length === 0) return;
    const idSet = new Set(ids);
    const previous = items;
    const result = await callAction(() => bulkUpdateMedia(ids, patch), {
      success: `${message} ${pluralize(ids.length, "item")}`,
      optimistic: () => setItems((list) => list.map((m) => (idSet.has(m.id) ? { ...m, ...patch } as MediaItem : m))),
      rollback: () => setItems(previous),
    });
    if (result.ok) router.refresh();
  }

  async function deleteSelected(): Promise<boolean> {
    const ids = selectedIds;
    const deleted: string[] = [];
    let firstError: string | null = null;
    for (const id of ids) {
      try {
        const result = await deleteMedia(id);
        if (result.ok) deleted.push(id);
        else firstError ??= result.error;
      } catch {
        firstError ??= "Couldn't reach the server.";
      }
    }
    if (deleted.length) {
      const gone = new Set(deleted);
      setItems((list) => list.filter((m) => !gone.has(m.id)));
      setSelected((prev) => new Set([...prev].filter((id) => !gone.has(id))));
      toast.success(`Deleted ${pluralize(deleted.length, "item")}`);
      router.refresh();
    }
    if (firstError) toast.error(deleted.length ? `${ids.length - deleted.length} couldn't be deleted: ${firstError}` : firstError);
    return firstError === null;
  }

  /* --------------------------------------------------------------- upload */

  const uploadDefaults = (upload: Parameters<typeof createMediaFromUpload>[0]): MediaPatch => ({
    kind: guessKind(upload, filters.kind || undefined),
    collectionId: filters.collectionId && filters.collectionId !== "none" ? filters.collectionId : null,
    brandId: filters.brandId && filters.brandId !== "none" ? filters.brandId : null,
  });

  const metaFor = (m: MediaItem) =>
    [m.collectionId ? collectionById.get(m.collectionId)?.title : null, m.brandId ? brandById.get(m.brandId)?.name : null]
      .filter(Boolean)
      .join(" · ");

  return (
    <>
      <PageHeader
        title="Media library"
        description="Every photo and video on your site. Drag to change the order they appear in."
        actions={
          <UploadButton
            folder="media"
            multiple
            onUploaded={async (upload) => {
              const result = await callAction(() => createMediaFromUpload(upload, uploadDefaults(upload)));
              if (result.ok) {
                uploadedBatch.current.push(result.data);
                setItems((list) => [...list, result.data]);
              }
              return result.ok;
            }}
            onDone={(count) => {
              const batch = uploadedBatch.current;
              uploadedBatch.current = [];
              router.refresh();
              if (count === 1 && batch[0]) {
                // one file: go straight to crop / rotate / adjust
                setStudioId(batch[0].id);
              } else if (count > 1) {
                const first = batch[0];
                toast.success(`Uploaded ${pluralize(count, "file")}`, {
                  description: "Open each one to add a title, or crop and adjust it.",
                  action: first ? { label: "Edit first", onClick: () => setStudioId(first.id) } : undefined,
                });
              }
            }}
          />
        }
      />

      <div role="search" className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-[minmax(0,2fr)_repeat(4,minmax(0,1fr))_auto]">
        <div className="relative col-span-2 sm:col-span-3 lg:col-span-1">
          <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-(--a-ink-faint)" />
          <Input
            type="search"
            value={filters.q}
            onChange={(e) => setFilter("q", e.target.value)}
            placeholder="Search titles and captions"
            aria-label="Search media"
            className="pl-9"
          />
        </div>
        <Select aria-label="Filter by type" value={filters.kind} onChange={(e) => setFilter("kind", e.target.value as MediaKind | "")}>
          <option value="">All types</option>
          {MEDIA_KINDS.map((k) => (
            <option key={k} value={k}>
              {KIND_SHORT[k]}
            </option>
          ))}
        </Select>
        <Select aria-label="Filter by collection" value={filters.collectionId} onChange={(e) => setFilter("collectionId", e.target.value)}>
          <option value="">All collections</option>
          <option value="none">No collection</option>
          {collections.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title}
            </option>
          ))}
        </Select>
        <Select aria-label="Filter by brand" value={filters.brandId} onChange={(e) => setFilter("brandId", e.target.value)}>
          <option value="">All brands</option>
          <option value="none">No brand</option>
          {brands.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </Select>
        <Select aria-label="Filter by status" value={filters.status} onChange={(e) => setFilter("status", e.target.value as Status)}>
          <option value="">Any status</option>
          <option value="published">Published</option>
          <option value="draft">Drafts</option>
          <option value="featured">Featured</option>
        </Select>
        {filtersActive ? (
          <Button variant="ghost" onClick={() => setFilters(EMPTY_FILTERS)} className="justify-center">
            <X aria-hidden /> Clear
          </Button>
        ) : null}
      </div>

      <div className="mb-3 flex min-h-8 flex-wrap items-center justify-between gap-2 text-xs text-(--a-ink-soft)">
        <p aria-live="polite">
          {filtersActive ? `${visible.length} of ${pluralize(items.length, "item")}` : pluralize(items.length, "item")}
        </p>
        {visible.length > 0 ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              setSelected(selectedIds.length === visible.length ? new Set() : new Set(visibleIds))
            }
          >
            {selectedIds.length === visible.length ? "Select none" : "Select all"}
          </Button>
        ) : null}
      </div>

      {items.length === 0 ? (
        <EmptyState icon={<Images />} title="Your library is empty">
          Upload reels and photos with the Upload button. They&apos;ll appear here, ready to sort into collections.
        </EmptyState>
      ) : visible.length === 0 ? (
        <EmptyState icon={<Search />} title="Nothing matches these filters">
          <Button variant="secondary" size="sm" className="mt-3" onClick={() => setFilters(EMPTY_FILTERS)}>
            Clear filters
          </Button>
        </EmptyState>
      ) : (
        <SortableContainer
          ids={visibleIds}
          onMove={handleMove}
          layout="grid"
          getLabel={(id) => mediaLabel(items.find((m) => m.id === id))}
        >
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5" aria-label="Media items">
            {visible.map((m) => (
              <SortableItem key={m.id} id={m.id}>
                {({ isDragging }) => (
                  <MediaCard
                    media={m}
                    selected={selected.has(m.id)}
                    meta={metaFor(m)}
                    isDragging={isDragging}
                    onToggleSelect={toggleSelect}
                    onOpen={openEditor}
                    onEditVisual={openStudio}
                  />
                )}
              </SortableItem>
            ))}
          </ul>
        </SortableContainer>
      )}

      <BulkBar
        count={selectedIds.length}
        collections={collections}
        brands={brands}
        onApply={applyBulk}
        onDelete={deleteSelected}
        onClear={() => setSelected(new Set())}
      />

      <MediaEditor
        media={editing}
        collections={collections}
        brands={brands}
        onEditVisual={openStudio}
        onClose={() => setEditingId(null)}
        onSaved={(updated) => {
          setItems((list) => list.map((m) => (m.id === updated.id ? updated : m)));
          router.refresh();
        }}
        onDeleted={(id) => {
          setEditingId(null);
          setItems((list) => list.filter((m) => m.id !== id));
          setSelected((prev) => {
            const next = new Set(prev);
            next.delete(id);
            return next;
          });
          router.refresh();
        }}
      />
      <MediaStudio
        media={studioMedia}
        onClose={() => setStudioId(null)}
        onSaved={(updated) => {
          setItems((list) => list.map((m) => (m.id === updated.id ? updated : m)));
          router.refresh();
        }}
      />
    </>
  );
}
