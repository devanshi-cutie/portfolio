"use client";

/**
 * Behind-the-scenes board: photos as polaroids you can push around on desktop
 * (drag, Stack-style, adapted from the React Bits "Stack" idea, reactbits.dev,
 * MIT), a swipeable row on phones; clips run along a strip of film. Anything
 * opens in the lightbox. Drag is mouse-only; keyboard users get buttons.
 */
import { motion, useReducedMotion } from "motion/react";
import { useRef, useState, type CSSProperties } from "react";
import type { MediaItem } from "@/core/types/content";
import { cn } from "../lib/cn";
import type { MediaMeta } from "../lib/media";
import { jitter } from "../lib/seed";
import { prefersSaveData, useFinePointer } from "../motion/hooks";
import { Lightbox } from "./Lightbox";
import { PreviewMedia } from "./PreviewMedia";

export function BtsBoard({
  photos,
  clips,
  metas,
  instagram,
}: {
  photos: MediaItem[];
  clips: MediaItem[];
  metas: Record<string, MediaMeta>;
  instagram: string;
}) {
  const fine = useFinePointer();
  const reduce = useReducedMotion();
  const board = useRef<HTMLDivElement>(null);
  const dragged = useRef(false);
  const [open, setOpen] = useState<number | null>(null);
  const [front, setFront] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const all = [...photos, ...clips];
  const canDrag = fine && !reduce;
  const autoplay = fine && !reduce && !prefersSaveData();

  const openItem = (m: MediaItem) => {
    if (dragged.current) {
      dragged.current = false;
      return;
    }
    setOpen(all.indexOf(m));
  };

  return (
    <div>
      {photos.length ? (
        <div
          ref={board}
          className="sb-snap-row sb-fade-x -mx-[var(--gutter)] flex snap-x snap-mandatory gap-5 overflow-x-auto overscroll-x-contain scroll-px-(--gutter) px-(--gutter) pb-8 pt-4 md:mx-0 md:grid md:snap-none md:grid-cols-5 md:gap-6 md:overflow-visible md:px-0 md:pb-4"
        >
          {photos.map((m, i) => {
            const rot = jitter(m.id, 6);
            return (
              <motion.figure
                key={m.id}
                drag={canDrag}
                dragConstraints={board}
                dragElastic={0.12}
                dragMomentum={false}
                whileDrag={{ scale: 1.04, rotate: 0, zIndex: 20 }}
                onDragStart={() => {
                  dragged.current = true;
                  setFront(m.id);
                }}
                onPointerDown={() => setFront(m.id)}
                className={cn(
                  "sb-polaroid relative w-[60vw] max-w-[260px] shrink-0 snap-center md:w-auto md:max-w-none",
                  canDrag && "cursor-grab active:cursor-grabbing",
                  i % 2 ? "md:mt-10" : "",
                )}
                style={{ rotate: `${rot}deg`, zIndex: front === m.id ? 10 : 1 } as CSSProperties}
              >
                <button
                  type="button"
                  data-media-card={m.id}
                  onClick={() => openItem(m)}
                  aria-label={`Open photo: ${metas[m.id]?.title ?? "behind the scenes"}`}
                  aria-haspopup="dialog"
                  className="block w-full"
                >
                  <div className="pointer-events-none aspect-[4/5] overflow-hidden bg-(--cream-2)">
                    <PreviewMedia media={m} width={720} sizes="(min-width: 768px) 30vw, 68vw" />
                  </div>
                </button>
                <figcaption className="sb-accent pointer-events-none absolute inset-x-3 bottom-2.5 truncate text-center text-[1.05rem] leading-tight text-(--ink)">
                  {metas[m.id]?.title}
                </figcaption>
              </motion.figure>
            );
          })}
        </div>
      ) : null}

      {clips.length ? (
        <div className="sb-film -mx-[var(--gutter)] mt-14 md:mx-0 md:rounded-sm">
          <ul className="sb-snap-row flex snap-x snap-mandatory gap-3 overflow-x-auto px-4">
            {clips.map((m) => (
              <li key={m.id} className="w-[36vw] max-w-[220px] shrink-0 snap-start md:w-[190px]">
                <button
                  type="button"
                  data-media-card={m.id}
                  onClick={() => openItem(m)}
                  onPointerEnter={() => fine && setHovered(m.id)}
                  onPointerLeave={() => setHovered(null)}
                  aria-label={`Watch clip: ${metas[m.id]?.title ?? "behind the scenes"}`}
                  aria-haspopup="dialog"
                  className="group block w-full"
                >
                  <div className="aspect-[9/16] overflow-hidden rounded-[3px] bg-[#3b1d26] transition-[opacity] duration-150 group-hover:opacity-95">
                    <PreviewMedia media={m} width={400} play={autoplay && hovered === m.id} />
                  </div>
                  <span className="mt-2 block truncate text-left text-xs font-semibold text-(--cream)">
                    {metas[m.id]?.title}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <Lightbox
        items={all}
        metas={metas}
        index={open}
        onIndex={setOpen}
        onClose={() => setOpen(null)}
        instagram={instagram}
        noun="Moment"
      />
    </div>
  );
}
