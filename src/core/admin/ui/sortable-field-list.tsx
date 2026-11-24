"use client";

import type { ReactNode } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "./button";
import { DragHandle, SortableContainer, SortableItem } from "./sortable";

interface SortableFieldListProps {
  /** react-hook-form field ids */
  ids: string[];
  onMove: (from: number, to: number) => void;
  onRemove: (index: number) => void;
  onAdd: () => void;
  /** singular noun: "stat", "step" */
  itemName: string;
  getLabel: (index: number) => string;
  renderItem: (index: number) => ReactNode;
  emptyText?: string;
  max?: number;
}

/** Drag-reorderable list of form rows with add/remove. */
export function SortableFieldList({ ids, onMove, onRemove, onAdd, itemName, getLabel, renderItem, emptyText, max }: SortableFieldListProps) {
  return (
    <div className="flex flex-col gap-2">
      {ids.length === 0 ? (
        <p className="rounded-lg border border-dashed border-(--a-line-strong) py-6 text-center text-sm text-(--a-ink-soft)">
          {emptyText ?? `No ${itemName}s yet.`}
        </p>
      ) : (
        <SortableContainer ids={ids} onMove={onMove} getLabel={(id) => getLabel(ids.indexOf(id))}>
          <ol className="flex flex-col gap-2">
            {ids.map((id, index) => (
              <SortableItem key={id} id={id} className="rounded-lg border border-(--a-line) bg-(--a-surface)">
                {() => (
                  <div className="flex items-start gap-1.5 p-2 sm:gap-2 sm:p-3">
                    <DragHandle label={getLabel(index)} className="-ml-1" />
                    <div className="min-w-0 flex-1">{renderItem(index)}</div>
                    <Button variant="danger-ghost" size="icon-sm" aria-label={`Remove ${getLabel(index)}`} onClick={() => onRemove(index)}>
                      <Trash2 />
                    </Button>
                  </div>
                )}
              </SortableItem>
            ))}
          </ol>
        </SortableContainer>
      )}
      <div>
        <Button size="sm" onClick={onAdd} disabled={max !== undefined && ids.length >= max}>
          <Plus aria-hidden /> Add {itemName}
        </Button>
      </div>
    </div>
  );
}
