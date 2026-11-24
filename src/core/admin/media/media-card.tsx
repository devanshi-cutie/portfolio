"use client";

import { memo } from "react";
import { EyeOff, Play, Star } from "lucide-react";
import type { MediaItem } from "@/core/types/content";
import { cn } from "../lib/cn";
import { formatDuration } from "../lib/format";
import { focusRing } from "../ui/button";
import { Badge } from "../ui/misc";
import { DragHandle } from "../ui/sortable";
import { MediaThumb } from "./media-thumb";
import { KIND_SHORT, mediaLabel } from "./labels";

interface MediaCardProps {
  media: MediaItem;
  selected: boolean;
  meta: string;
  isDragging: boolean;
  onToggleSelect: (id: string, shiftKey: boolean) => void;
  onOpen: (id: string) => void;
}

export const MediaCard = memo(function MediaCard({ media, selected, meta, isDragging, onToggleSelect, onOpen }: MediaCardProps) {
  const label = mediaLabel(media);
  return (
    <div
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-lg border bg-(--a-surface) transition-[border-color,box-shadow] duration-100",
        selected ? "border-(--a-primary) ring-2 ring-(--a-primary)/40" : "border-(--a-line) hover:border-(--a-line-strong)",
        isDragging && "opacity-90",
      )}
    >
      <div className="relative aspect-[4/5] bg-(--a-muted)">
        <button
          type="button"
          onClick={() => onOpen(media.id)}
          className={cn("absolute inset-0 block size-full cursor-pointer", focusRing, "focus-visible:ring-offset-0 focus-visible:ring-inset")}
          aria-label={`Edit ${label}`}
        >
          <MediaThumb media={media} width={360} className="size-full" />
        </button>

        <label
          className={cn(
            "absolute top-0 left-0 flex size-11 cursor-pointer items-center justify-center",
            "opacity-100 transition-opacity duration-100 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 [@media(hover:hover)]:has-[:focus-visible]:opacity-100",
            selected && "[@media(hover:hover)]:opacity-100",
          )}
        >
          <input
            type="checkbox"
            checked={selected}
            onChange={() => {}}
            onClick={(e) => onToggleSelect(media.id, e.shiftKey)}
            className="size-[18px] cursor-pointer rounded accent-(--a-primary) shadow ring-1 ring-(--a-surface)/80 focus-visible:outline-2 focus-visible:outline-(--a-ring)"
            aria-label={`Select ${label}`}
          />
        </label>

        <div className="absolute top-1 right-1 rounded-md bg-(--a-surface)/85 opacity-100 backdrop-blur-sm transition-opacity duration-100 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 [@media(hover:hover)]:has-[:focus-visible]:opacity-100">
          <DragHandle label={label} />
        </div>

        <div className="pointer-events-none absolute inset-x-1.5 bottom-1.5 flex flex-wrap items-center gap-1">
          {media.resourceType === "video" ? (
            <Badge tone="dark">
              <Play aria-hidden className="fill-current" />
              {formatDuration(media.duration) || "Video"}
            </Badge>
          ) : null}
          {!media.published ? (
            <Badge tone="amber">
              <EyeOff aria-hidden />
              Draft
            </Badge>
          ) : null}
          {media.featured ? (
            <Badge tone="rose">
              <Star aria-hidden className="fill-current" />
              Featured
            </Badge>
          ) : null}
        </div>
      </div>
      <div className="min-w-0 px-2.5 py-2">
        <p className="truncate text-[13px] font-medium text-(--a-ink)" title={label}>
          {label}
        </p>
        <p className="truncate text-xs text-(--a-ink-soft)">
          {KIND_SHORT[media.kind]}
          {meta ? ` · ${meta}` : ""}
        </p>
      </div>
    </div>
  );
});
