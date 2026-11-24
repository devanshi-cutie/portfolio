"use client";

/**
 * Fan of three featured reels in phone frames.
 * - The front phone plays muted while the hero is on screen.
 * - Mouse: depth-layered pointer parallax; click any phone to watch it.
 * - Touch: swipe the fan (or tap a back phone, or a dot) to bring the next
 *   reel to the front; tap the front phone to watch it.
 * Phones re-seat with a short in-out move; reduced motion swaps instantly.
 */
import {
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
  type MotionValue,
  type PanInfo,
} from "motion/react";
import { useEffect, useRef, useState, type CSSProperties, type PointerEvent, type ReactNode } from "react";
import type { MediaItem } from "@/core/types/content";
import { cn } from "../lib/cn";
import type { MediaMeta } from "../lib/media";
import { EASE_MOVE } from "../motion/easing";
import { prefersSaveData, useFinePointer } from "../motion/hooks";
import { CircularText } from "./CircularText";
import { Heart, Star } from "./Doodles";
import { Lightbox } from "./Lightbox";
import { PhoneFrame } from "./PhoneFrame";
import { PreviewMedia } from "./PreviewMedia";

// Seats in the fan: 0 = front, 1 = back-left, 2 = back-right.
const SEATS = [
  { rot: -1.5, depth: 24, z: 2, className: "left-[25%] top-0 w-[50%]", delay: 100 },
  { rot: -9, depth: 10, z: 1, className: "left-[1%] top-[13%] w-[43%]", delay: 160 },
  { rot: 8, depth: 14, z: 1, className: "right-[1%] top-[17%] w-[43%]", delay: 220 },
];

export function HeroStack({
  reels,
  metas,
  handle,
  badge,
  instagram,
}: {
  reels: MediaItem[];
  metas: Record<string, MediaMeta>;
  handle: string;
  badge: string;
  instagram: string;
}) {
  const fine = useFinePointer();
  const reduce = useReducedMotion();
  const box = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  const [open, setOpen] = useState<number | null>(null);
  /** index into `reels` of the reel sitting in the front seat */
  const [front, setFront] = useState(0);
  const px = useMotionValue(0);
  const py = useMotionValue(0);
  const sx = useSpring(px, { stiffness: 120, damping: 20 });
  const sy = useSpring(py, { stiffness: 120, damping: 20 });
  const autoplay = !reduce && !prefersSaveData();
  const n = reels.length;

  useEffect(() => {
    if (!box.current) return;
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { threshold: 0.35 });
    io.observe(box.current);
    return () => io.disconnect();
  }, []);

  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!fine || reduce) return;
    const r = e.currentTarget.getBoundingClientRect();
    px.set((e.clientX - r.left) / r.width - 0.5);
    py.set((e.clientY - r.top) / r.height - 0.5);
  };

  const cycle = (step: number) => setFront((f) => (f + step + n) % n);
  const onPanEnd = (_: unknown, info: PanInfo) => {
    if (fine || n < 2) return;
    if (info.offset.x < -40 || info.velocity.x < -300) cycle(1);
    else if (info.offset.x > 40 || info.velocity.x > 300) cycle(-1);
  };

  if (!n) return null;

  return (
    <div>
      <motion.div
        ref={box}
        onPointerMove={onMove}
        onPointerLeave={() => {
          px.set(0);
          py.set(0);
        }}
        onPanEnd={onPanEnd}
        style={{ touchAction: "pan-y" }}
        className="relative mx-auto aspect-[10/11] w-full max-w-[min(100%,330px)] md:max-w-[520px]"
      >
        {reels.map((m, i) => {
          const seatIndex = (i - front + n) % n;
          const seat = SEATS[seatIndex] ?? SEATS[0];
          const isFront = seatIndex === 0;
          return (
            <Layer key={m.id} sx={sx} sy={sy} depth={seat.depth} className={cn("absolute", seat.className)} z={seat.z}>
              <motion.div
                animate={{ rotate: seat.rot }}
                initial={false}
                transition={{ duration: reduce ? 0 : 0.3, ease: EASE_MOVE }}
              >
                <div className="sb-phone-in" style={{ "--d": `${seat.delay}ms` } as CSSProperties}>
                  <button
                    type="button"
                    data-media-card={m.id}
                    onClick={() => (isFront || fine ? setOpen(i) : setFront(i))}
                    aria-label={
                      isFront || fine ? `Watch ${metas[m.id]?.title ?? "reel"}` : `Show ${metas[m.id]?.title ?? "reel"} in front`
                    }
                    aria-haspopup={isFront || fine ? "dialog" : undefined}
                    className="block w-full rounded-[1.9rem] transition-transform duration-150 active:scale-[0.98]"
                  >
                    <PhoneFrame handle={handle} bar={isFront}>
                      <PreviewMedia
                        media={m}
                        width={640}
                        eager={i === 0}
                        play={isFront && autoplay && inView && open === null}
                        sizes="(min-width: 1024px) 260px, 50vw"
                      />
                    </PhoneFrame>
                  </button>
                </div>
              </motion.div>
            </Layer>
          );
        })}

        <Layer sx={sx} sy={sy} depth={34} z={3} className="absolute bottom-[2%] right-0 text-(--rose-deep) md:bottom-[4%] md:right-[3%]">
          <div className="relative grid place-items-center rounded-full bg-(--blush) p-1 shadow-[0_10px_30px_-12px_rgb(44_17_25/0.5)]">
            <CircularText text={badge} className="size-20 md:size-28" />
            <Star className="absolute size-6 text-(--rose-deep) md:size-7" />
          </div>
        </Layer>
        <Heart className="absolute bottom-[12%] left-0 z-[3] size-8 -rotate-12 text-(--rose-deep) md:size-9" />
      </motion.div>

      {/* Touch: dots to pick the front reel (also shows there is more than one). */}
      {n > 1 ? (
        <div className="mt-3 flex justify-center gap-1 md:hidden" role="group" aria-label="Featured reels">
          {reels.map((m, i) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setFront(i)}
              aria-label={`Show reel ${i + 1} of ${n}`}
              aria-pressed={front === i}
              className="grid size-11 place-items-center"
            >
              <span
                className={cn(
                  "block h-1.5 rounded-full transition-[width,background-color] duration-200",
                  front === i ? "w-5 bg-(--rose-deep)" : "w-1.5 bg-(--ink)/25",
                )}
              />
            </button>
          ))}
        </div>
      ) : null}

      <Lightbox
        items={reels}
        metas={metas}
        index={open}
        onIndex={setOpen}
        onClose={() => setOpen(null)}
        instagram={instagram}
        noun="Reel"
      />
    </div>
  );
}

function Layer({
  sx,
  sy,
  depth,
  z,
  className,
  children,
}: {
  sx: MotionValue<number>;
  sy: MotionValue<number>;
  depth: number;
  z: number;
  className?: string;
  children: ReactNode;
}) {
  const reduce = useReducedMotion();
  const x = useTransform(sx, (v) => v * depth);
  const y = useTransform(sy, (v) => v * depth);
  return (
    <motion.div
      layout={!reduce}
      transition={{ layout: { duration: 0.3, ease: EASE_MOVE } }}
      className={className}
      style={{ x, y, zIndex: z }}
    >
      {children}
    </motion.div>
  );
}
