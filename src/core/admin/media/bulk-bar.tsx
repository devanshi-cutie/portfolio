"use client";

import { useState } from "react";
import { Eye, EyeOff, Star, StarOff, Trash2, X } from "lucide-react";
import type { Brand, Collection } from "@/core/types/content";
import type { MediaPatch } from "@/core/types/admin";
import { pluralize } from "../lib/format";
import { Button } from "../ui/button";
import { ConfirmDialog } from "../ui/dialogs";
import { Select } from "../ui/field";

interface BulkBarProps {
  count: number;
  collections: Collection[];
  brands: Brand[];
  onApply: (patch: MediaPatch, message: string) => Promise<void>;
  onDelete: () => Promise<boolean>;
  onClear: () => void;
}

export function BulkBar({ count, collections, brands, onApply, onDelete, onClear }: BulkBarProps) {
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (count === 0) return null;

  async function run(key: string, patch: MediaPatch, message: string) {
    setBusy(key);
    try {
      await onApply(patch, message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div
      role="region"
      aria-label="Bulk actions"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-(--a-line) bg-(--a-surface)/95 px-3 py-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))] shadow-[0_-4px_16px_-8px_color-mix(in_oklab,var(--a-ink)_18%,transparent)] backdrop-blur-sm lg:left-60"
    >
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-2">
        <p className="mr-1 text-sm font-medium text-(--a-ink)" aria-live="polite">
          {pluralize(count, "item")} selected
        </p>
        <Button size="sm" pending={busy === "pub"} disabled={!!busy} onClick={() => run("pub", { published: true }, "Published")}>
          <Eye aria-hidden /> Publish
        </Button>
        <Button size="sm" pending={busy === "unpub"} disabled={!!busy} onClick={() => run("unpub", { published: false }, "Hid")}>
          <EyeOff aria-hidden /> Hide
        </Button>
        <Button size="sm" pending={busy === "feat"} disabled={!!busy} onClick={() => run("feat", { featured: true }, "Featured")}>
          <Star aria-hidden /> Feature
        </Button>
        <Button size="sm" pending={busy === "unfeat"} disabled={!!busy} onClick={() => run("unfeat", { featured: false }, "Unfeatured")}>
          <StarOff aria-hidden /> Unfeature
        </Button>
        <Select
          aria-label="Move selected to collection"
          className="w-44"
          value=""
          disabled={!!busy}
          onChange={(e) => {
            const value = e.target.value;
            if (!value) return;
            const id = value === "none" ? null : value;
            void run("col", { collectionId: id }, "Updated the collection of");
          }}
        >
          <option value="">Collection…</option>
          <option value="none">No collection</option>
          {collections.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title}
            </option>
          ))}
        </Select>
        <Select
          aria-label="Assign selected to brand"
          className="w-40"
          value=""
          disabled={!!busy}
          onChange={(e) => {
            const value = e.target.value;
            if (!value) return;
            const id = value === "none" ? null : value;
            void run("brand", { brandId: id }, "Updated the brand of");
          }}
        >
          <option value="">Brand…</option>
          <option value="none">No brand</option>
          {brands.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </Select>
        <div className="ml-auto flex items-center gap-1">
          <Button size="sm" variant="danger-ghost" disabled={!!busy} onClick={() => setConfirmDelete(true)}>
            <Trash2 aria-hidden /> Delete
          </Button>
          <Button size="icon-sm" variant="ghost" aria-label="Clear selection" onClick={onClear}>
            <X />
          </Button>
        </div>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`Delete ${pluralize(count, "item")}?`}
        description="The selected files are removed from your library and your site. This can't be undone."
        confirmLabel={`Delete ${pluralize(count, "item")}`}
        onConfirm={onDelete}
      />
    </div>
  );
}
