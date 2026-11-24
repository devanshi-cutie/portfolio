"use client";

/**
 * Full-screen viewer for reels and BTS media.
 * - grows out of the clicked card (transform-origin at the card's centre) and
 *   closes faster than it opens, shrinking back toward the current card;
 * - ←/→ to move, Esc to close, Tab is trapped, focus returns to the trigger;
 * - swipe left/right on touch screens;
 * - plays with sound (the user asked for it by opening it).
 */
import { ArrowUpRight, ChevronLeft, ChevronRight, Film, X } from "lucide-react";
import { AnimatePresence, motion, useDragControls, useIsPresent, useReducedMotion, type PanInfo } from "motion/react";
import Link from "next/link";
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type PointerEvent,
} from "react";
import { createPortal } from "react-dom";
import { editedDimensions } from "@/core/cloudinary/urls";
import type { MediaItem } from "@/core/types/content";
import type { MediaMeta } from "../lib/media";
import { isVideo, labelOf, posterOf, sourceLinkOf, videoSrcOf } from "../lib/media";
import { EASE_IN, EASE_MOVE, EASE_OUT } from "../motion/easing";
import { useFinePointer } from "../motion/hooks";
import { pauseAll } from "../motion/playback";

/** Aspect ratio of the item as displayed (after its crop/rotation edits). */
function aspectStyle(item: MediaItem) {
  const dims = editedDimensions(item);
  return dims ? { aspectRatio: `${dims.width} / ${dims.height}` } : undefined;
}

/*
 * Desktop (md+) sizing. The media and the caption sit side by side as one
 * centred group, so the media box needs a definite width of its own (a
 * full-width box would push the caption to the far edge, under the Next
 * button). Its width is the smaller of:
 *   - the room left beside the caption: 100% of the row's content box (the
 *     px-24 padding already clears the nav buttons) minus caption + gap;
 *   - the media height × aspect ratio, where the height is the old cap
 *     (86dvh) or the row's content height (100dvh − py-10), whichever is less.
 * Its height then follows from aspect-ratio, so the shape is never distorted.
 * Keep these in step with md:w-72 (caption), md:gap-10 and md:py-10 below.
 */
const CAPTION_W = "18rem";
const GROUP_GAP = "2.5rem";
const MEDIA_MAX_H = "min(86dvh, 100dvh - 5rem)";

function desktopBoxStyle(item: MediaItem): CSSProperties {
  const dims = editedDimensions(item);
  const ratio = dims && dims.width > 0 && dims.height > 0 ? dims.width / dims.height : 9 / 16;
  const r = Number(ratio.toFixed(5));
  return {
    "--lb-ar": String(r),
    "--lb-w": `min(100% - ${CAPTION_W} - ${GROUP_GAP}, ${r} * ${MEDIA_MAX_H})`,
  } as CSSProperties;
}

const noop = () => () => {};
const useIsClient = () => useSyncExternalStore(noop, () => true, () => false);

export interface LightboxProps {
  items: MediaItem[];
  metas: Record<string, MediaMeta>;
  index: number | null;
  onIndex: (i: number) => void;
  onClose: () => void;
  instagram: string;
  /** what to call one item in the counter, e.g. "Reel" */
  noun?: string;
}

/** Viewport centre of the card for `id`, used as the grow/shrink origin. */
function originOf(id: string | undefined) {
  if (typeof document === "undefined" || !id) return null;
  const el = document.querySelector<HTMLElement>(`[data-media-card="${CSS.escape(id)}"]`);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (r.bottom < 0 || r.top > window.innerHeight) return null;
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

export function Lightbox(props: LightboxProps) {
  const client = useIsClient();
  if (!client) return null;
  const target = document.getElementById("sb-portal") ?? document.body;
  return createPortal(
    <AnimatePresence>{props.index !== null ? <Panel key="lightbox" {...props} index={props.index} /> : null}</AnimatePresence>,
    target,
  );
}

function Panel({ items, metas, index, onIndex, onClose, instagram, noun = "Item" }: LightboxProps & { index: number }) {
  const reduce = useReducedMotion();
  const fine = useFinePointer();
  const dragControls = useDragControls();
  const titleId = useId();
  const dialog = useRef<HTMLDivElement>(null);
  const closeBtn = useRef<HTMLButtonElement>(null);
  const [dir, setDir] = useState(0);
  const item = items[index];
  const meta = item ? metas[item.id] : undefined;
  const count = items.length;
  // Captured once at open; the exit origin follows the item being shown.
  const [openOrigin] = useState(() => originOf(item?.id));
  const origin = originOf(item?.id) ?? openOrigin;

  const go = useCallback(
    (step: number) => {
      if (count < 2) return;
      setDir(step);
      onIndex((index + step + count) % count);
    },
    [count, index, onIndex],
  );

  // Captured once per opening (render-time initialiser, so React's dev double
  // effects cannot overwrite it with the dialog's own close button).
  const [restore] = useState(() => ({
    focus: document.activeElement as HTMLElement | null,
    overflow: document.documentElement.style.overflow,
  }));
  const present = useIsPresent();

  // Open: pause previews, lock scroll, focus the close button.
  useEffect(() => {
    pauseAll();
    document.documentElement.style.overflow = "hidden";
    closeBtn.current?.focus({ preventScroll: true });
  }, []);

  // Close: give scroll and focus back as soon as the exit starts, not after it.
  useEffect(() => {
    const giveBack = () => {
      document.documentElement.style.overflow = restore.overflow;
      restore.focus?.focus?.({ preventScroll: true });
    };
    if (!present) giveBack();
    return () => {
      if (present) giveBack();
    };
  }, [present, restore]);

  useEffect(() => {
    if (!present) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "ArrowRight") {
        go(1);
      } else if (e.key === "ArrowLeft") {
        go(-1);
      } else if (e.key === "Tab" && dialog.current) {
        const nodes = dialog.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), video[controls], [tabindex]:not([tabindex="-1"])',
        );
        if (!nodes.length) return;
        const first = nodes[0];
        const last = nodes[nodes.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, onClose, present]);

  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.x < -60 || info.velocity.x < -400) go(1);
    else if (info.offset.x > 60 || info.velocity.x > 400) go(-1);
  };

  if (!item) return null;
  const source = sourceLinkOf(item);
  const transformOrigin = origin ? `${origin.x}px ${origin.y}px` : "50% 50%";

  return (
    <div className="sb-on-dark fixed inset-0 z-[80]" ref={dialog} role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <motion.div
        aria-hidden
        className="absolute inset-0 bg-[rgb(31_12_19/0.9)] backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1, transition: { duration: 0.22, ease: EASE_OUT } }}
        exit={{ opacity: 0, transition: { duration: 0.14, ease: EASE_IN } }}
      />
      <motion.div
        className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-4 pb-4 pt-16 md:flex-row md:gap-10 md:px-24 md:py-10"
        style={{ transformOrigin }}
        initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.3 }}
        animate={{ opacity: 1, scale: 1, transition: { duration: reduce ? 0.2 : 0.38, ease: EASE_OUT } }}
        exit={reduce ? { opacity: 0, transition: { duration: 0.12 } } : { opacity: 0, scale: 0.4, transition: { duration: 0.18, ease: EASE_IN } }}
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <motion.div
          className="relative flex max-h-full min-h-0 w-full max-w-[min(100%,calc(78dvh*9/16))] flex-1 items-center justify-center md:aspect-(--lb-ar) md:h-auto md:max-h-none md:w-(--lb-w) md:max-w-none md:flex-none"
          style={desktopBoxStyle(item)}
          drag={fine ? false : "x"}
          dragControls={dragControls}
          dragListener={false}
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={reduce ? 0 : 0.25}
          onPointerDown={(e: PointerEvent<HTMLDivElement>) => {
            if (fine) return;
            // Leave the native video controls (bottom strip) to the video.
            const video = (e.target as HTMLElement).closest("video");
            if (video && e.clientY > video.getBoundingClientRect().bottom - 64) return;
            dragControls.start(e);
          }}
          onDragEnd={onDragEnd}
        >
          <AnimatePresence mode="popLayout" initial={false} custom={dir}>
            <motion.div
              key={item.id}
              custom={dir}
              className="relative aspect-[9/16] h-full max-h-[78dvh] max-w-full overflow-hidden rounded-[1.4rem] bg-[#1f0c12] shadow-[0_30px_80px_-20px_rgb(0_0_0/0.7)] md:h-auto md:max-h-none md:w-full"
              style={aspectStyle(item)}
              initial={reduce ? { opacity: 0 } : { opacity: 0, x: dir * 60 }}
              animate={{ opacity: 1, x: 0, transition: { duration: 0.26, ease: EASE_MOVE } }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, x: dir * -60, transition: { duration: 0.14, ease: EASE_IN } }}
            >
              <Stage item={item} instagram={instagram} autoPlay={!reduce} />
            </motion.div>
          </AnimatePresence>
        </motion.div>

        <div className="w-full max-w-md shrink-0 text-(--cream) md:w-72">
          {/* Only the counter and title are announced per slide, not the links. */}
          <div aria-live="polite">
            <p className="text-xs font-semibold tracking-wide text-(--blush)">
              {noun} {index + 1} of {count}
            </p>
            <h2 id={titleId} className="sb-serif mt-1 text-xl leading-tight md:text-2xl">
              {meta?.title ?? labelOf(item)}
            </h2>
          </div>
          {meta?.brand || meta?.collection ? (
            <p className="mt-1 text-sm text-(--cream)/75">{[meta.brand, meta.collection].filter(Boolean).join(" · ")}</p>
          ) : null}
          {source || meta?.collectionSlug ? (
            <div className="mt-3 flex flex-col items-start gap-1">
              {source ? (
                <a
                  href={source.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group/src flex min-h-11 flex-col justify-center py-1"
                >
                  <span className="inline-flex items-center gap-1.5 text-sm font-semibold underline decoration-(--blush) underline-offset-4 group-hover/src:text-(--blush)">
                    {source.label}
                    <ArrowUpRight className="size-4" aria-hidden />
                  </span>
                  <span className="mt-0.5 text-xs text-(--cream)/70">
                    see the views &amp; comments<span className="sr-only"> (opens in a new tab)</span>
                  </span>
                </a>
              ) : null}
              {meta?.collectionSlug ? (
                <Link
                  href={`/work/${meta.collectionSlug}`}
                  onClick={onClose}
                  className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold underline decoration-(--blush) underline-offset-4 hover:text-(--blush)"
                >
                  More {meta.collection ? meta.collection.toLowerCase() : "from this collection"}
                  <ArrowUpRight className="size-4" aria-hidden />
                </Link>
              ) : null}
            </div>
          ) : null}
        </div>
      </motion.div>

      <button
        ref={closeBtn}
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="absolute right-3 top-[calc(0.75rem+env(safe-area-inset-top))] z-10 grid size-12 place-items-center rounded-full bg-(--cream) text-(--ink) transition-transform duration-150 hover:scale-105 active:scale-95"
      >
        <X className="size-5" aria-hidden />
      </button>
      {count > 1 ? (
        <>
          <NavButton side="left" onClick={() => go(-1)} />
          <NavButton side="right" onClick={() => go(1)} />
        </>
      ) : null}
    </div>
  );
}

function NavButton({ side, onClick }: { side: "left" | "right"; onClick: () => void }) {
  const Icon = side === "left" ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={side === "left" ? "Previous" : "Next"}
      className={`absolute z-10 grid size-11 place-items-center rounded-full border border-(--cream)/50 bg-[rgb(31_12_19/0.55)] text-(--cream) transition-[background-color,transform] duration-150 hover:bg-(--cream)/15 top-[42%] -translate-y-1/2 active:scale-95 md:top-1/2 md:size-12 md:bg-transparent ${
        side === "left" ? "left-2 md:left-5" : "right-2 md:right-5"
      }`}
    >
      <Icon className="size-6" aria-hidden />
    </button>
  );
}

function Stage({ item, instagram, autoPlay }: { item: MediaItem; instagram: string; autoPlay: boolean }) {
  const [broken, setBroken] = useState(false);
  if (!isVideo(item)) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- Cloudinary-sized image
      <img src={posterOf(item, 1200) ?? ""} alt={labelOf(item)} className="size-full object-contain" />
    );
  }
  if (broken) {
    const source = sourceLinkOf(item);
    return (
      <div className="flex size-full flex-col items-center justify-center gap-3 p-6 text-center text-(--cream)">
        <Film className="size-8" strokeWidth={1.5} aria-hidden />
        <p className="text-sm">This clip can&apos;t play in this browser.</p>
        <a
          href={source?.href ?? instagram}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-11 items-center text-sm font-semibold underline underline-offset-4"
        >
          {source?.label ?? "Watch on Instagram"}
        </a>
      </div>
    );
  }
  return (
    <video
      key={item.id}
      src={videoSrcOf(item, 1080)}
      poster={posterOf(item, 720) ?? undefined}
      controls
      autoPlay={autoPlay}
      playsInline
      preload="auto"
      aria-label={labelOf(item)}
      onError={() => setBroken(true)}
      onLoadedData={(e) => {
        if (e.currentTarget.videoWidth === 0) setBroken(true);
      }}
      className="size-full bg-black object-contain"
    />
  );
}
