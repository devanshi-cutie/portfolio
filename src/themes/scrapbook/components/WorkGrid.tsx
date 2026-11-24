"use client";

/**
 * Reel grid with collection filter chips and the lightbox. The active chip's
 * pill slides between chips (shared layout, spring, interruptible); cards
 * re-flow with layout animation. Long lists show the first `initial` items
 * and a "show all" button.
 */
import { ArrowUpRight } from "lucide-react";
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { useMemo, useState, type MouseEvent } from "react";
import type { MediaItem } from "@/core/types/content";
import { cn } from "../lib/cn";
import type { MediaMeta } from "../lib/media";
import { EASE_IN, EASE_OUT, SPRING_UI } from "../motion/easing";
import { useMediaQuery } from "../motion/hooks";
import { Lightbox } from "./Lightbox";
import { ReelCard } from "./ReelCard";

export interface Chip {
  id: string;
  slug: string;
  title: string;
  count: number;
}

export function WorkGrid({
  items,
  metas,
  chips = [],
  handle,
  instagram,
  initial = 12,
  initialMobile = 6,
  noun = "Reel",
}: {
  items: MediaItem[];
  metas: Record<string, MediaMeta>;
  chips?: Chip[];
  handle?: string;
  instagram: string;
  initial?: number;
  /** first page on phones (keeps the page short) */
  initialMobile?: number;
  noun?: string;
}) {
  const reduce = useReducedMotion();
  const [filter, setFilter] = useState<string>("all");
  const [expanded, setExpanded] = useState(false);
  const phone = useMediaQuery("(max-width: 767.98px)");
  const pageSize = phone ? Math.min(initial, initialMobile) : initial;

  const choose = (id: string, e: MouseEvent<HTMLButtonElement>) => {
    setFilter(id);
    // keep the chosen chip fully visible in the swipe strip
    e.currentTarget.scrollIntoView({ inline: "center", block: "nearest", behavior: reduce ? "auto" : "smooth" });
  };
  const [open, setOpen] = useState<number | null>(null);

  const filtered = useMemo(
    () => (filter === "all" ? items : items.filter((m) => m.collectionId === filter)),
    [filter, items],
  );
  const visible = expanded || filter !== "all" ? filtered : filtered.slice(0, pageSize);
  const activeChip = chips.find((c) => c.id === filter);

  return (
    <div>
      {chips.length > 1 ? (
        <LayoutGroup id="work-chips">
          <div
            role="group"
            aria-label="Filter reels by collection"
            className="sb-snap-row sb-fade-x -mx-[var(--gutter)] flex snap-x gap-2 overflow-x-auto overscroll-x-contain scroll-px-(--gutter) px-(--gutter) py-1 md:mx-0 md:flex-wrap md:overflow-visible md:px-0 md:[mask-image:none]"
          >
            <ChipButton active={filter === "all"} onClick={(e) => choose("all", e)} label="All" count={items.length} />
            {chips.map((c) => (
              <ChipButton key={c.id} active={filter === c.id} onClick={(e) => choose(c.id, e)} label={c.title} count={c.count} />
            ))}
          </div>
        </LayoutGroup>
      ) : null}

      <ul className="mt-6 grid grid-cols-2 gap-x-3.5 gap-y-7 pb-8 sm:gap-x-4 md:mt-8 md:grid-cols-3 md:gap-x-7 md:gap-y-12 md:pb-10 xl:grid-cols-4">
        <AnimatePresence mode="popLayout" initial={false}>
          {visible.map((m, i) => (
            <motion.li
              key={m.id}
              layout={!reduce}
              className="max-md:even:translate-y-8 md:max-xl:[&:nth-child(3n+2)]:translate-y-12 xl:even:translate-y-12"
              initial={{ opacity: 0, y: reduce ? 0 : 18 }}
              animate={{
                opacity: 1,
                y: 0,
                transition: { duration: 0.3, ease: EASE_OUT, delay: i < 8 ? i * 0.035 : 0.28 },
              }}
              exit={{ opacity: 0, scale: reduce ? 1 : 0.96, transition: { duration: 0.12, ease: EASE_IN } }}
              transition={{ layout: { duration: 0.3, ease: [0.65, 0, 0.35, 1] } }}
            >
              <ReelCard
                media={m}
                meta={metas[m.id]}
                handle={handle}
                onOpen={() => setOpen(filtered.indexOf(m))}
              />
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>

      <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3">
        {!expanded && filter === "all" && filtered.length > pageSize ? (
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="inline-flex min-h-12 items-center rounded-full border-[1.5px] border-(--ink) px-6 text-[0.95rem] font-semibold transition-[background-color,color] duration-150 hover:bg-(--ink) hover:text-(--cream) active:scale-[0.97]"
          >
            Show all {filtered.length} reels
          </button>
        ) : null}
        {activeChip ? (
          <Link
            href={`/work/${activeChip.slug}`}
            className="inline-flex min-h-11 items-center gap-1.5 font-semibold text-(--rose-deep) underline decoration-(--blush) decoration-2 underline-offset-[6px] hover:decoration-(--rose-deep)"
          >
            Open the {activeChip.title.toLowerCase()} page
            <ArrowUpRight className="size-4" aria-hidden />
          </Link>
        ) : null}
      </div>

      <Lightbox
        items={filtered}
        metas={metas}
        index={open}
        onIndex={setOpen}
        onClose={() => setOpen(null)}
        instagram={instagram}
        noun={noun}
      />
    </div>
  );
}

function ChipButton({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean;
  onClick: (e: MouseEvent<HTMLButtonElement>) => void;
  label: string;
  count: number;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "relative inline-flex min-h-11 shrink-0 snap-start items-center gap-2 rounded-full px-4 text-sm font-semibold transition-colors duration-150",
        active ? "text-(--cream)" : "text-(--ink) hover:bg-(--cream-2)",
      )}
    >
      {active ? (
        <motion.span layoutId="chip-pill" transition={SPRING_UI} className="absolute inset-0 rounded-full bg-(--rose-deep)" aria-hidden />
      ) : (
        <span className="absolute inset-0 rounded-full border border-(--line)" aria-hidden />
      )}
      <span className="relative">{label}</span>
      <span className={cn("relative text-xs tabular-nums", active ? "text-(--cream)" : "text-(--ink-soft)")}>{count}</span>
    </button>
  );
}
