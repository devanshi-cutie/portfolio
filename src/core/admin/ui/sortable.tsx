"use client";

import { createContext, use, useId, type CSSProperties, type ReactNode } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type UniqueIdentifier,
} from "@dnd-kit/core";
import {
  SortableContext,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { cn } from "../lib/cn";
import { focusRing } from "./button";

interface SortableContainerProps {
  ids: string[];
  onMove: (fromIndex: number, toIndex: number) => void;
  layout?: "list" | "grid";
  /** human name for an item, used in screen-reader announcements */
  getLabel?: (id: string) => string;
  disabled?: boolean;
  children: ReactNode;
}

const DisabledContext = createContext(false);

/**
 * Drag-and-drop reordering via a handle. Pointer, touch (press and hold) and keyboard
 * (focus the handle, Space to pick up, arrows to move, Space to drop, Escape to cancel).
 */
export function SortableContainer({ ids, onMove, layout = "list", getLabel, disabled = false, children }: SortableContainerProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const id = useId();
  const label = (uid: UniqueIdentifier | undefined) => (uid == null ? "item" : (getLabel?.(String(uid)) ?? "item"));
  const position = (uid: UniqueIdentifier | undefined) => (uid == null ? 0 : ids.indexOf(String(uid)) + 1);

  const announcements: Announcements = {
    onDragStart: ({ active }) => `Picked up ${label(active.id)}. Position ${position(active.id)} of ${ids.length}.`,
    onDragOver: ({ active, over }) =>
      over ? `${label(active.id)} moved to position ${position(over.id)} of ${ids.length}.` : `${label(active.id)} is no longer over a position.`,
    onDragEnd: ({ active, over }) =>
      over ? `Dropped ${label(active.id)} at position ${position(over.id)} of ${ids.length}.` : `Dropped ${label(active.id)}.`,
    onDragCancel: ({ active }) => `Cancelled. ${label(active.id)} returned to its position.`,
  };

  function handleDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    const from = ids.indexOf(String(active.id));
    const to = ids.indexOf(String(over.id));
    if (from < 0 || to < 0) return;
    onMove(from, to);
  }

  return (
    <DndContext
      id={id}
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
      accessibility={{
        announcements,
        screenReaderInstructions: {
          draggable:
            "To reorder, press Space or Enter to pick up. Use the arrow keys to move, Space or Enter to drop, Escape to cancel.",
        },
      }}
    >
      <SortableContext
        items={ids}
        strategy={layout === "grid" ? rectSortingStrategy : verticalListSortingStrategy}
        disabled={disabled}
      >
        <DisabledContext value={disabled}>{children}</DisabledContext>
      </SortableContext>
    </DndContext>
  );
}

interface ItemContextValue {
  setActivator: (node: HTMLElement | null) => void;
  attributes: ReturnType<typeof useSortable>["attributes"];
  listeners: ReturnType<typeof useSortable>["listeners"];
  disabled: boolean;
}

const ItemContext = createContext<ItemContextValue | null>(null);

interface SortableItemProps {
  id: string;
  className?: string;
  as?: "li" | "div";
  /** render a <DragHandle> somewhere inside */
  children: (state: { isDragging: boolean }) => ReactNode;
}

export function SortableItem({ id, className, as = "li", children }: SortableItemProps) {
  const disabled = use(DisabledContext);
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style: CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition,
    zIndex: isDragging ? 20 : undefined,
    position: "relative",
  };
  const Tag = as;
  return (
    <ItemContext value={{ setActivator: setActivatorNodeRef, attributes, listeners, disabled }}>
      <Tag ref={setNodeRef} style={style} className={cn(isDragging && "adm-dragging", className)}>
        {children({ isDragging })}
      </Tag>
    </ItemContext>
  );
}

/** The drag activator for the enclosing SortableItem. Hidden when sorting is disabled. */
export function DragHandle({ label, className }: { label: string; className?: string }) {
  const item = use(ItemContext);
  if (!item || item.disabled) return null;
  const { setActivator, attributes, listeners } = item;
  return (
    <button
      type="button"
      ref={setActivator}
      {...attributes}
      {...listeners}
      aria-label={`Reorder ${label}`}
      className={cn(
        "inline-flex size-11 shrink-0 cursor-grab touch-none items-center justify-center rounded-md text-(--a-ink-soft) hover:bg-(--a-muted) hover:text-(--a-ink-soft) active:cursor-grabbing sm:pointer-fine:size-8",
        focusRing,
        className,
      )}
    >
      <GripVertical className="size-4" aria-hidden />
    </button>
  );
}

/** Immutable array move. */
export function moveItem<T>(list: readonly T[], from: number, to: number): T[] {
  const next = list.slice();
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}
