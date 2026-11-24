"use client";

import { useDeferredValue, useMemo, useState } from "react";
import { Check, ImagePlus, Search, X } from "lucide-react";
import type { MediaItem, MediaKind } from "@/core/types/content";
import { MEDIA_KINDS } from "@/core/types/content";
import { cn } from "../lib/cn";
import { Button, focusRing } from "../ui/button";
import { Modal } from "../ui/dialogs";
import { Input, Select } from "../ui/field";
import { Badge } from "../ui/misc";
import { MediaThumb } from "./media-thumb";
import { KIND_SHORT, mediaLabel } from "./labels";

interface MediaPickerFieldProps {
  id: string;
  label: string;
  hint?: string;
  media: MediaItem[];
  value: string | null;
  onChange: (id: string | null) => void;
  /** restrict to images (OG images, portraits, logos) */
  imagesOnly?: boolean;
  /** kind pre-selected in the picker's filter */
  preferKind?: MediaKind;
}

/** Shows the chosen item and opens a picker over the existing media library. */
export function MediaPickerField({ id, label, hint, media, value, onChange, imagesOnly, preferKind }: MediaPickerFieldProps) {
  const [open, setOpen] = useState(false);
  const current = value ? media.find((m) => m.id === value) : undefined;

  return (
    <div className="flex flex-col gap-1.5">
      <span id={`${id}-label`} className="text-[13px] font-medium text-(--a-ink)">
        {label}
      </span>
      <div className="flex items-center gap-3">
        <MediaThumb media={current} width={160} className="size-16 shrink-0 rounded-md border border-(--a-line)" />
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <p className="truncate text-sm text-(--a-ink-soft)">
            {current ? mediaLabel(current) : value ? "Missing item (it may have been deleted)" : "Nothing chosen"}
          </p>
          <div className="flex gap-1.5">
            <Button size="sm" aria-describedby={`${id}-label`} onClick={() => setOpen(true)}>
              <ImagePlus aria-hidden /> {value ? "Change" : "Choose"}
            </Button>
            {value ? (
              <Button size="sm" variant="ghost" aria-label={`Remove ${label}`} onClick={() => onChange(null)}>
                <X aria-hidden /> Remove
              </Button>
            ) : null}
          </div>
        </div>
      </div>
      {hint ? <p className="text-xs text-(--a-ink-soft)">{hint}</p> : null}
      <MediaPicker
        open={open}
        onOpenChange={setOpen}
        title={`Choose ${label.toLowerCase()}`}
        media={media}
        value={value}
        imagesOnly={imagesOnly}
        preferKind={preferKind}
        onSelect={(picked) => {
          onChange(picked);
          setOpen(false);
        }}
      />
    </div>
  );
}

interface MediaPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  media: MediaItem[];
  value: string | null;
  imagesOnly?: boolean;
  preferKind?: MediaKind;
  onSelect: (id: string) => void;
}

export function MediaPicker({ open, onOpenChange, title, media, value, imagesOnly, preferKind, onSelect }: MediaPickerProps) {
  const [q, setQ] = useState("");
  const [kind, setKind] = useState<MediaKind | "">(preferKind ?? "");
  const deferredQ = useDeferredValue(q);

  const options = useMemo(() => {
    const query = deferredQ.trim().toLowerCase();
    return media.filter((m) => {
      if (imagesOnly && m.resourceType !== "image") return false;
      if (kind && m.kind !== kind) return false;
      if (query && !`${m.title ?? ""} ${m.caption ?? ""} ${m.publicId}`.toLowerCase().includes(query)) return false;
      return true;
    });
  }, [media, imagesOnly, kind, deferredQ]);

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={imagesOnly ? "Only photos can be used here." : "Pick from your media library."}
      size="xl"
    >
      <div className="mb-3 flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-(--a-ink-faint)" />
          <Input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" aria-label="Search media" className="pl-9" />
        </div>
        <Select aria-label="Filter by type" className="sm:w-44" value={kind} onChange={(e) => setKind(e.target.value as MediaKind | "")}>
          <option value="">All types</option>
          {MEDIA_KINDS.map((k) => (
            <option key={k} value={k}>
              {KIND_SHORT[k]}
            </option>
          ))}
        </Select>
      </div>
      {options.length === 0 ? (
        <p className="py-10 text-center text-sm text-(--a-ink-soft)">No matching items. Upload them in the Media library first.</p>
      ) : (
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6" aria-label="Media">
          {options.map((m) => {
            const active = m.id === value;
            return (
              <li key={m.id}>
                <button
                  type="button"
                  onClick={() => onSelect(m.id)}
                  aria-pressed={active}
                  aria-label={mediaLabel(m)}
                  className={cn(
                    "group relative block w-full cursor-pointer overflow-hidden rounded-md border text-left",
                    active ? "border-(--a-primary) ring-2 ring-(--a-ring)/40" : "border-(--a-line) hover:border-(--a-line-strong)",
                    focusRing,
                  )}
                >
                  <MediaThumb media={m} width={240} className="aspect-[4/5] w-full" />
                  {m.resourceType === "video" ? (
                    <Badge tone="dark" className="absolute bottom-1 left-1">
                      Video
                    </Badge>
                  ) : null}
                  {active ? (
                    <span className="absolute top-1 right-1 grid size-5 place-items-center rounded-full bg-(--a-primary) text-(--a-primary-ink)">
                      <Check className="size-3" aria-hidden />
                    </span>
                  ) : null}
                  <span className="block truncate px-1.5 py-1 text-[11px] text-(--a-ink-soft)">{mediaLabel(m)}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Modal>
  );
}
