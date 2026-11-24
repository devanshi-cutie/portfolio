"use client";

import { useCallback, useMemo, useRef, useState, type KeyboardEvent, type RefObject } from "react";
import Cropper, { type Area, type Point } from "react-easy-crop";
import { Dialog, Tabs } from "radix-ui";
import {
  Crop,
  FlipHorizontal2,
  FlipVertical2,
  Pause,
  Play,
  RotateCcw,
  RotateCcwSquare,
  RotateCwSquare,
  SlidersHorizontal,
  Scissors,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import type { MediaEdits, MediaItem } from "@/core/types/content";
import type { MediaPatch } from "@/core/types/admin";
import { isDefaultEdits, normalizeEdits } from "@/core/lib/media-edits";
import { sourceImageUrl, sourceVideoUrl } from "@/core/cloudinary/urls";
import { updateMedia } from "@/core/actions/media";
import { useAdminConfig } from "../config-context";
import { callAction } from "../lib/use-action";
import { cn } from "../lib/cn";
import { formatDuration } from "../lib/format";
import { Button, focusRing } from "../ui/button";
import { ConfirmDialog } from "../ui/dialogs";
import { Range } from "../ui/range";
import { useAdminPortalContainer } from "../ui/portal";
import { mediaLabel } from "./labels";

/* ------------------------------------------------------------- constants */

const ASPECTS = [
  { id: "original", label: "Original", ratio: null },
  { id: "9:16", label: "9:16 Reel", ratio: 9 / 16 },
  { id: "4:5", label: "4:5", ratio: 4 / 5 },
  { id: "1:1", label: "1:1", ratio: 1 },
  { id: "16:9", label: "16:9", ratio: 16 / 9 },
] as const;
type AspectId = (typeof ASPECTS)[number]["id"];

const MIN_ZOOM = 1;
const MAX_ZOOM = 4;
const CROP_TOLERANCE = 0.4; // percent; cropper restores within float noise

/** Keep any angle inside (-180, 180]. */
function wrapAngle(deg: number): number {
  const r = ((((deg + 180) % 360) + 360) % 360) - 180;
  return r === -180 ? 180 : r;
}
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const round = (v: number, places = 2) => Math.round(v * 10 ** places) / 10 ** places;

/** null when there is nothing to apply, so a no-op save resets to the original. */
function effective(raw: MediaEdits | null | undefined): MediaEdits | null {
  if (!raw) return null;
  const normalized = normalizeEdits(raw);
  return normalized && !isDefaultEdits(normalized) ? normalized : null;
}

function sameEdits(a: MediaEdits | null, b: MediaEdits | null): boolean {
  if (!a || !b) return a === b;
  const cropSame =
    (!a.crop && !b.crop) ||
    (!!a.crop &&
      !!b.crop &&
      (["x", "y", "width", "height"] as const).every((k) => Math.abs(a.crop![k] - b.crop![k]) <= CROP_TOLERANCE));
  return (
    cropSame &&
    (a.aspect ?? "original") === (b.aspect ?? "original") &&
    Math.abs(a.rotation - b.rotation) < 0.05 &&
    a.flipH === b.flipH &&
    a.flipV === b.flipV &&
    a.brightness === b.brightness &&
    a.contrast === b.contrast &&
    a.saturation === b.saturation &&
    (a.trimStart ?? null) === (b.trimStart ?? null) &&
    (a.trimEnd ?? null) === (b.trimEnd ?? null)
  );
}

/* ----------------------------------------------------------------- shell */

interface MediaStudioProps {
  /** the item to edit; null = closed */
  media: MediaItem | null;
  onClose: () => void;
  onSaved: (media: MediaItem) => void;
}

/**
 * Non-destructive photo/video editor: crop, zoom, rotate, flip, light
 * adjustments and (videos) trim. The original file is never touched; the
 * result is stored as `media.edits` and applied by Cloudinary at delivery.
 */
export function MediaStudio({ media, onClose, onSaved }: MediaStudioProps) {
  return media ? <Studio key={`${media.id}:${media.updatedAt}`} media={media} onClose={onClose} onSaved={onSaved} /> : null;
}

function Studio({ media, onClose, onSaved }: { media: MediaItem; onClose: () => void; onSaved: (media: MediaItem) => void }) {
  const { preview } = useAdminConfig();
  const container = useAdminPortalContainer();
  const isVideo = media.resourceType === "video";
  const readOnly = preview || media.publicId.startsWith("local:");
  const saved = media.edits;
  const baseline = useMemo(() => effective(saved), [saved]);

  /* --------------------------------------------------------------- state */
  const [aspectId, setAspectId] = useState<AspectId>(() => {
    const stored = saved?.aspect;
    return ASPECTS.some((a) => a.id === stored) ? (stored as AspectId) : "original";
  });
  // whole degrees: normalizeEdits() stores rotation rounded
  const [rotation, setRotation] = useState(() => wrapAngle(Math.round(saved?.rotation ?? 0)));
  const [flipH, setFlipH] = useState(saved?.flipH ?? false);
  const [flipV, setFlipV] = useState(saved?.flipV ?? false);
  const [brightness, setBrightness] = useState(saved?.brightness ?? 0);
  const [contrast, setContrast] = useState(saved?.contrast ?? 0);
  const [saturation, setSaturation] = useState(saved?.saturation ?? 0);
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [area, setArea] = useState<Area | null>(saved?.crop ?? null);
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(
    media.width && media.height ? { w: media.width, h: media.height } : null,
  );
  const [duration, setDuration] = useState(media.duration && media.duration > 0 ? media.duration : 0);
  const [trim, setTrim] = useState<[number, number]>(() => [saved?.trimStart ?? 0, saved?.trimEnd ?? (media.duration ?? 0)]);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState<"discard" | "reset" | null>(null);
  const videoRef = useRef<RefObject<HTMLVideoElement> | null>(null);

  /* ------------------------------------------------------------- derived */
  const quarterTurned = Math.abs(Math.round(rotation / 90)) % 2 === 1;
  const naturalAspect = natural ? (quarterTurned ? natural.h / natural.w : natural.w / natural.h) : 9 / 16;
  const aspect = ASPECTS.find((a) => a.id === aspectId)?.ratio ?? naturalAspect;
  const quarter = Math.round(rotation / 90) * 90;
  const fine = clamp(rotation - quarter, -45, 45);
  const trimEnd = trim[1] > 0 ? trim[1] : duration;

  const draft = useMemo<MediaEdits>(() => {
    const full = !area || (area.x <= 0.05 && area.y <= 0.05 && area.width >= 99.9 && area.height >= 99.9);
    return {
      crop: full ? null : { x: round(area.x), y: round(area.y), width: round(area.width), height: round(area.height) },
      aspect: aspectId === "original" ? null : aspectId,
      rotation: Math.round(rotation),
      flipH,
      flipV,
      brightness,
      contrast,
      saturation,
      trimStart: isVideo && trim[0] > 0.05 ? round(trim[0], 1) : null,
      trimEnd: isVideo && duration > 0 && trimEnd < duration - 0.05 ? round(trimEnd, 1) : null,
    };
  }, [area, aspectId, rotation, flipH, flipV, brightness, contrast, saturation, isVideo, trim, trimEnd, duration]);

  const result = useMemo(() => effective(draft), [draft]);
  const dirty = !sameEdits(result, baseline);

  const filter = `brightness(${1 + brightness / 100}) contrast(${1 + contrast / 100}) saturate(${1 + saturation / 100})`;
  const transform = `translate(${crop.x}px, ${crop.y}px) rotate(${rotation}deg) scale(${zoom}) scaleX(${flipH ? -1 : 1}) scaleY(${flipV ? -1 : 1})`;

  /* ------------------------------------------------------------- actions */
  const video = () => videoRef.current?.current ?? null;

  function seek(seconds: number) {
    const el = video();
    if (!el) return;
    try {
      el.currentTime = seconds;
    } catch {
      // metadata not loaded yet
    }
    setTime(seconds);
  }

  function togglePlay() {
    const el = video();
    if (!el) return;
    if (el.paused) {
      if (el.currentTime < trim[0] || el.currentTime >= trimEnd - 0.05) seek(trim[0]);
      void el.play().catch(() => {});
    } else {
      el.pause();
    }
  }

  const rotateBy = useCallback((delta: number) => setRotation((r) => wrapAngle(r + delta)), []);
  const zoomBy = useCallback((delta: number) => setZoom((z) => clamp(round(z + delta, 2), MIN_ZOOM, MAX_ZOOM)), []);

  function resetDraft() {
    setAspectId("original");
    setRotation(0);
    setFlipH(false);
    setFlipV(false);
    setBrightness(0);
    setContrast(0);
    setSaturation(0);
    setZoom(1);
    setCrop({ x: 0, y: 0 });
    setArea(null);
    setTrim([0, duration]);
  }

  function requestClose() {
    if (saving) return;
    if (dirty && !readOnly) setConfirm("discard");
    else onClose();
  }

  async function save(edits: MediaEdits | null): Promise<boolean> {
    setSaving(true);
    try {
      const patch: MediaPatch = { edits };
      // keep the cover frame inside the trimmed clip
      if (isVideo && edits && (edits.trimStart !== null || edits.trimEnd !== null)) {
        const start = edits.trimStart ?? 0;
        const end = edits.trimEnd ?? duration;
        if (media.posterOffset < start || media.posterOffset > end) patch.posterOffset = round(start, 1);
      }
      const res = await callAction(() => updateMedia(media.id, patch), {
        success: edits ? "Edits saved. The original file is untouched." : "Back to the original",
      });
      if (res.ok) {
        onSaved(res.data);
        onClose();
      }
      return res.ok;
    } finally {
      setSaving(false);
    }
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const target = event.target as HTMLElement;
    if (target.closest("input, textarea, select, [role=slider]")) return;
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    if (event.key === "+" || event.key === "=") {
      event.preventDefault();
      zoomBy(0.2);
    } else if (event.key === "-" || event.key === "_") {
      event.preventDefault();
      zoomBy(-0.2);
    } else if (event.key === "r" || event.key === "R") {
      event.preventDefault();
      rotateBy(event.shiftKey ? -90 : 90);
    }
  }

  const kindWord = isVideo ? "video" : "photo";

  return (
    <Dialog.Root open onOpenChange={(open) => !open && requestClose()}>
      <Dialog.Portal container={container}>
        <Dialog.Overlay className="adm-overlay fixed inset-0 z-[65] bg-(--a-overlay)" />
        <Dialog.Content
          onKeyDown={onKeyDown}
          onEscapeKeyDown={(e) => {
            e.preventDefault();
            requestClose();
          }}
          onInteractOutside={(e) => e.preventDefault()}
          className="adm-studio fixed inset-0 z-[65] flex flex-col overflow-hidden bg-(--a-surface) outline-none sm:inset-4 sm:rounded-2xl sm:shadow-[0_24px_60px_-20px_color-mix(in_oklab,var(--a-ink)_45%,transparent)]"
        >
          {/* header */}
          <header className="flex items-center gap-3 border-b border-(--a-line) px-4 py-2.5 sm:px-5">
            <div className="min-w-0 flex-1">
              <Dialog.Title className="adm-display truncate text-lg font-semibold text-(--a-ink)">Edit {kindWord}</Dialog.Title>
              <Dialog.Description className="truncate text-xs text-(--a-ink-soft)">
                {mediaLabel(media)} · changes are applied on delivery; the original file stays as it is.
              </Dialog.Description>
            </div>
            <Button variant="ghost" size="icon-sm" aria-label="Close editor" onClick={requestClose}>
              <X />
            </Button>
          </header>

          {readOnly ? (
            <p role="status" className="border-b border-(--a-warn-line) bg-(--a-warn-bg) px-4 py-2 text-sm text-(--a-ink) sm:px-5">
              {preview
                ? "Preview mode: you can try the tools, but edits can't be saved until Supabase is connected."
                : "This item is a local preview file. Edits work once it's on Cloudinary."}
            </p>
          ) : null}

          <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
            {/* canvas */}
            <div className="relative min-h-[42dvh] flex-1 bg-(--a-ink) lg:min-h-0">
              <Cropper
                key={media.id}
                image={isVideo ? undefined : sourceImageUrl(media, { width: 2000 })}
                video={isVideo ? sourceVideoUrl(media, { width: 1280 }) : undefined}
                crop={crop}
                zoom={zoom}
                rotation={rotation}
                aspect={aspect}
                minZoom={MIN_ZOOM}
                maxZoom={MAX_ZOOM}
                transform={transform}
                onCropChange={setCrop}
                onZoomChange={(z) => setZoom(clamp(z, MIN_ZOOM, MAX_ZOOM))}
                onRotationChange={(r) => setRotation(wrapAngle(Math.round(r)))}
                onCropComplete={(croppedArea) => setArea(croppedArea)}
                onMediaLoaded={(size) => {
                  if (size.naturalWidth && size.naturalHeight) setNatural({ w: size.naturalWidth, h: size.naturalHeight });
                }}
                initialCroppedAreaPercentages={saved?.crop ?? undefined}
                keyboardStep={8}
                style={{ mediaStyle: { filter } }}
                setVideoRef={(ref) => {
                  videoRef.current = ref;
                }}
                mediaProps={
                  isVideo
                    ? {
                        autoPlay: false,
                        muted: true,
                        playsInline: true,
                        loop: false,
                        preload: "auto",
                        onPlay: () => setPlaying(true),
                        onPause: () => setPlaying(false),
                        // the Cropper owns onLoadedMetadata, so read the length here
                        onDurationChange: (e) => {
                          const d = (e.currentTarget as HTMLVideoElement).duration;
                          if (Number.isFinite(d) && d > 0) {
                            setDuration(d);
                            setTrim(([s, end]) => [s, end > 0 ? Math.min(end, d) : d]);
                          }
                        },
                        onTimeUpdate: (e) => {
                          const el = e.currentTarget as HTMLVideoElement;
                          if (!el.paused && el.currentTime >= trimEnd - 0.03) el.currentTime = trim[0];
                          setTime(el.currentTime);
                        },
                      }
                    : { alt: media.alt ?? "" }
                }
                cropperProps={{ "aria-label": `Crop area. Drag or use the arrow keys to move the ${kindWord}.` }}
              />
              {isVideo ? (
                <button
                  type="button"
                  onClick={togglePlay}
                  aria-label={playing ? "Pause" : "Play"}
                  className={cn(
                    "absolute bottom-3 left-3 z-10 grid size-11 cursor-pointer place-items-center rounded-full bg-(--a-surface)/90 text-(--a-ink) shadow backdrop-blur-sm",
                    focusRing,
                  )}
                >
                  {playing ? <Pause className="size-4" aria-hidden /> : <Play className="size-4" aria-hidden />}
                </button>
              ) : null}
            </div>

            {/* controls */}
            <Tabs.Root defaultValue="crop" className="flex min-h-0 flex-col border-t border-(--a-line) lg:w-[22rem] lg:border-t-0 lg:border-l">
              <Tabs.List aria-label="Editing tools" className="flex shrink-0 gap-1 border-b border-(--a-line) px-3">
                {[
                  { value: "crop", label: "Crop & rotate", icon: Crop },
                  { value: "adjust", label: "Adjust", icon: SlidersHorizontal },
                  ...(isVideo ? [{ value: "trim", label: "Trim", icon: Scissors }] : []),
                ].map(({ value, label, icon: Icon }) => (
                  <Tabs.Trigger
                    key={value}
                    value={value}
                    className={cn(
                      "-mb-px flex h-11 cursor-pointer items-center gap-1.5 border-b-2 border-transparent px-2.5 text-sm text-(--a-ink-soft) hover:text-(--a-ink)",
                      "data-[state=active]:border-(--a-primary) data-[state=active]:font-medium data-[state=active]:text-(--a-ink)",
                      focusRing,
                    )}
                  >
                    <Icon className="size-4" aria-hidden />
                    {label}
                  </Tabs.Trigger>
                ))}
              </Tabs.List>

              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">
                <Tabs.Content value="crop" className="flex flex-col gap-5 outline-none">
                  <fieldset>
                    <legend className="mb-2 text-[13px] font-medium text-(--a-ink)">Shape</legend>
                    <div className="flex flex-wrap gap-1.5">
                      {ASPECTS.map((a) => (
                        <button
                          key={a.id}
                          type="button"
                          aria-pressed={aspectId === a.id}
                          onClick={() => setAspectId(a.id)}
                          className={cn(
                            "h-11 cursor-pointer rounded-full border px-3.5 text-[13px] transition-colors duration-100 sm:pointer-fine:h-8",
                            aspectId === a.id
                              ? "border-(--a-primary) bg-(--a-primary) text-(--a-primary-ink)"
                              : "border-(--a-line-strong) bg-(--a-surface) text-(--a-ink) hover:bg-(--a-muted)",
                            focusRing,
                          )}
                        >
                          {a.label}
                        </button>
                      ))}
                    </div>
                    <p className="mt-1.5 text-xs text-(--a-ink-soft)">Original keeps the file&apos;s own shape. Drag the {kindWord} to choose what stays in the frame.</p>
                  </fieldset>

                  <div className="flex items-end gap-2">
                    <Button variant="secondary" size="icon-sm" aria-label="Zoom out" onClick={() => zoomBy(-0.2)} disabled={zoom <= MIN_ZOOM}>
                      <ZoomOut />
                    </Button>
                    <Range
                      className="flex-1"
                      label="Zoom"
                      display={`${zoom.toFixed(1)}×`}
                      value={[zoom]}
                      min={MIN_ZOOM}
                      max={MAX_ZOOM}
                      step={0.05}
                      onChange={([v]) => setZoom(v)}
                      valueText={(v) => `${v.toFixed(1)} times`}
                    />
                    <Button variant="secondary" size="icon-sm" aria-label="Zoom in" onClick={() => zoomBy(0.2)} disabled={zoom >= MAX_ZOOM}>
                      <ZoomIn />
                    </Button>
                  </div>

                  <div className="flex flex-col gap-2">
                    <div className="flex flex-wrap gap-1.5">
                      <Button variant="secondary" size="sm" onClick={() => rotateBy(-90)}>
                        <RotateCcwSquare aria-hidden /> Rotate left
                      </Button>
                      <Button variant="secondary" size="sm" onClick={() => rotateBy(90)}>
                        <RotateCwSquare aria-hidden /> Rotate right
                      </Button>
                    </div>
                    <Range
                      label="Straighten"
                      display={`${Math.round(fine)}° · total ${Math.round(rotation)}°`}
                      value={[fine]}
                      min={-45}
                      max={45}
                      step={1}
                      centre={0}
                      onChange={([v]) => setRotation(wrapAngle(quarter + v))}
                      valueText={(v) => `${v} degrees`}
                    />
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    <Button variant="secondary" size="sm" aria-pressed={flipH} className={cn(flipH && "border-(--a-primary) bg-(--a-blush)")} onClick={() => setFlipH((v) => !v)}>
                      <FlipHorizontal2 aria-hidden /> Flip horizontal
                    </Button>
                    <Button variant="secondary" size="sm" aria-pressed={flipV} className={cn(flipV && "border-(--a-primary) bg-(--a-blush)")} onClick={() => setFlipV((v) => !v)}>
                      <FlipVertical2 aria-hidden /> Flip vertical
                    </Button>
                  </div>

                  <p className="text-xs text-(--a-ink-soft)">
                    Shortcuts: arrow keys move the crop (focus the frame first), + / − zoom, R rotates right, Shift+R rotates left.
                  </p>
                </Tabs.Content>

                <Tabs.Content value="adjust" className="flex flex-col gap-5 outline-none">
                  {(
                    [
                      ["Brightness", brightness, setBrightness],
                      ["Contrast", contrast, setContrast],
                      ["Saturation", saturation, setSaturation],
                    ] as const
                  ).map(([label, value, set]) => (
                    <Range
                      key={label}
                      label={label}
                      display={value > 0 ? `+${value}` : `${value}`}
                      value={[value]}
                      min={label === "Brightness" ? -99 : -100}
                      max={100}
                      step={1}
                      centre={0}
                      onChange={([v]) => set(v)}
                    />
                  ))}
                  <div>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={!brightness && !contrast && !saturation}
                      onClick={() => {
                        setBrightness(0);
                        setContrast(0);
                        setSaturation(0);
                      }}
                    >
                      <RotateCcw aria-hidden /> Reset adjustments
                    </Button>
                  </div>
                </Tabs.Content>

                {isVideo ? (
                  <Tabs.Content value="trim" className="flex flex-col gap-4 outline-none">
                    <div className="flex items-center gap-3">
                      <Button variant="secondary" size="icon" aria-label={playing ? "Pause" : "Play"} onClick={togglePlay}>
                        {playing ? <Pause /> : <Play />}
                      </Button>
                      <p className="text-sm tabular-nums text-(--a-ink-soft)" aria-live="off">
                        {formatDuration(time)} / {formatDuration(duration)}
                      </p>
                    </div>
                    <Range
                      label="Keep from … to …"
                      display={`${formatDuration(trim[0])} – ${formatDuration(trimEnd)} (${formatDuration(trimEnd - trim[0])})`}
                      value={[trim[0], trimEnd]}
                      min={0}
                      max={duration || 1}
                      step={0.1}
                      disabled={!duration}
                      thumbLabels={["Start", "End"]}
                      valueText={(v) => `${round(v, 1)} seconds`}
                      onChange={([s, e]) => {
                        const movedStart = Math.abs(s - trim[0]) > Math.abs(e - trimEnd);
                        setTrim([s, e]);
                        video()?.pause();
                        seek(movedStart ? s : e);
                      }}
                    />
                    <div className="flex flex-wrap gap-1.5">
                      <Button variant="secondary" size="sm" disabled={!duration || time >= trimEnd - 0.2} onClick={() => setTrim([round(time, 1), trimEnd])}>
                        Start at playhead
                      </Button>
                      <Button variant="secondary" size="sm" disabled={!duration || time <= trim[0] + 0.2} onClick={() => setTrim([trim[0], round(time, 1)])}>
                        End at playhead
                      </Button>
                      <Button variant="ghost" size="sm" disabled={trim[0] === 0 && trimEnd >= duration} onClick={() => setTrim([0, duration])}>
                        <RotateCcw aria-hidden /> Full length
                      </Button>
                    </div>
                    <p className="text-xs text-(--a-ink-soft)">
                      Only the part between the handles plays on your site. If the cover frame falls outside it, it moves to the new start.
                    </p>
                  </Tabs.Content>
                ) : null}
              </div>
            </Tabs.Root>
          </div>

          {/* footer */}
          <footer className="flex flex-wrap items-center gap-2 border-t border-(--a-line) px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-5">
            <Button
              variant="ghost"
              disabled={saving || (readOnly && !dirty) || (!saved && !dirty)}
              onClick={() => (saved && !readOnly ? setConfirm("reset") : resetDraft())}
            >
              <RotateCcw aria-hidden /> Reset to original
            </Button>
            <div className="ml-auto flex gap-2">
              <Button variant="ghost" onClick={requestClose} disabled={saving}>
                Cancel
              </Button>
              <Button variant="primary" pending={saving} disabled={readOnly || !dirty} onClick={() => void save(result)}>
                Save
              </Button>
            </div>
          </footer>

          <ConfirmDialog
            open={confirm === "discard"}
            onOpenChange={(open) => !open && setConfirm(null)}
            title="Discard your changes?"
            description={`Your edits to this ${kindWord} haven't been saved.`}
            confirmLabel="Discard"
            onConfirm={() => {
              setConfirm(null);
              onClose();
            }}
          />
          <ConfirmDialog
            open={confirm === "reset"}
            onOpenChange={(open) => !open && setConfirm(null)}
            title={`Reset “${mediaLabel(media)}” to the original?`}
            description="All crops, rotations, adjustments and trims are removed. The original file was never changed, so nothing is lost."
            confirmLabel="Reset to original"
            onConfirm={() => save(null)}
          />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
