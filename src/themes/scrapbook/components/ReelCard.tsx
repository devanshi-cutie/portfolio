"use client";

/**
 * A reel in a phone frame. Desktop: hover tilts the phone (TiltedCard idea
 * from React Bits, reactbits.dev, MIT) and plays a muted preview. Touch: the
 * preview plays while the card sits in the middle of the screen. Click/Enter
 * opens the lightbox from this card.
 */
import { Play } from "lucide-react";
import { motion, useMotionValue, useReducedMotion, useSpring } from "motion/react";
import { useEffect, useRef, useState, type PointerEvent } from "react";
import type { MediaItem } from "@/core/types/content";
import { cn } from "../lib/cn";
import type { MediaMeta } from "../lib/media";
import { isVideo } from "../lib/media";
import { prefersSaveData, useFinePointer } from "../motion/hooks";
import { PhoneFrame } from "./PhoneFrame";
import { PreviewMedia } from "./PreviewMedia";

export function ReelCard({
  media,
  meta,
  handle,
  onOpen,
  eager,
  className,
}: {
  media: MediaItem;
  meta: MediaMeta;
  handle?: string;
  onOpen: () => void;
  eager?: boolean;
  className?: string;
}) {
  const fine = useFinePointer();
  const reduce = useReducedMotion();
  const [hover, setHover] = useState(false);
  const [centred, setCentred] = useState(false);
  const ref = useRef<HTMLButtonElement>(null);
  const rx = useMotionValue(0);
  const ry = useMotionValue(0);
  const srx = useSpring(rx, { stiffness: 300, damping: 24 });
  const sry = useSpring(ry, { stiffness: 300, damping: 24 });
  const video = isVideo(media);
  const autoplay = video && !reduce && !prefersSaveData();

  // Touch screens: play while the card crosses the middle band of the viewport.
  useEffect(() => {
    if (fine || !autoplay || !ref.current) return;
    const io = new IntersectionObserver(([e]) => setCentred(e.isIntersecting), {
      rootMargin: "-42% 0px -42% 0px",
    });
    io.observe(ref.current);
    return () => io.disconnect();
  }, [fine, autoplay]);

  const onMove = (e: PointerEvent<HTMLButtonElement>) => {
    if (!fine || reduce) return;
    const r = e.currentTarget.getBoundingClientRect();
    ry.set(((e.clientX - r.left) / r.width - 0.5) * 10);
    rx.set(-((e.clientY - r.top) / r.height - 0.5) * 8);
  };
  const onLeave = () => {
    setHover(false);
    rx.set(0);
    ry.set(0);
  };

  const play = autoplay && (fine ? hover : centred);
  const sub = [meta.brand, meta.collection].filter(Boolean).join(" · ");

  return (
    <div className={cn("group/card", className)}>
      <motion.button
        ref={ref}
        type="button"
        data-media-card={media.id}
        onClick={onOpen}
        onPointerEnter={() => fine && setHover(true)}
        onPointerMove={onMove}
        onPointerLeave={onLeave}
        aria-label={`Watch ${meta.title}`}
        aria-haspopup="dialog"
        className="block w-full cursor-pointer rounded-[1.9rem] [perspective:900px] active:scale-[0.98] transition-transform duration-150"
        style={{ rotateX: srx, rotateY: sry }}
      >
        <PhoneFrame
          handle={handle}
          className="transition-[translate,box-shadow] duration-150 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover/card:-translate-y-1"
        >
          <PreviewMedia media={media} width={540} play={play} eager={eager} sizes="(min-width: 1280px) 22vw, (min-width: 768px) 30vw, 46vw" />
          {fine ? null : (
            <span
              aria-hidden
              className="absolute inset-x-0 bottom-9 z-[2] flex justify-center"
            >
              <span className="inline-flex items-center gap-1.5 rounded-full bg-(--cream)/92 px-2.5 py-1 text-[0.7rem] font-semibold text-(--ink) shadow-sm">
                <Play className="size-3 fill-current" />
                Tap to watch
              </span>
            </span>
          )}
          <span
            aria-hidden
            className={cn(
              fine ? "" : "hidden",
              "absolute left-1/2 top-1/2 z-[1] grid size-14 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-(--cream)/90 text-(--rose-deep) shadow-lg transition-[opacity,scale] duration-150",
              play ? "scale-75 opacity-0" : "opacity-100 group-hover/card:scale-110",
            )}
          >
            <Play className="ml-0.5 size-5 fill-current" />
          </span>
        </PhoneFrame>
      </motion.button>
      <div className="mt-3 px-1">
        <p className="line-clamp-2 text-[0.95rem] font-semibold leading-snug">{meta.title}</p>
        {sub ? <p className="mt-0.5 truncate text-[0.8125rem] text-(--ink-soft)">{sub}</p> : null}
      </div>
    </div>
  );
}
