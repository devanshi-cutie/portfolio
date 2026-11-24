"use client";

/**
 * Phones: a native swipe carousel (CSS scroll-snap, momentum, the next card
 * peeking) with prev/next buttons, dots and a live "2 / 6" counter that follow
 * the scroll. Tablets and up: the same list renders in the section's own
 * desktop layout (`desktopClassName`), so desktop is unchanged.
 * Reduced motion: buttons jump instead of gliding; swiping still works.
 */
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useReducedMotion } from "motion/react";
import { Children, useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "../lib/cn";
import { useMediaQuery } from "../motion/hooks";

export function SwipeList({
  children,
  label,
  desktopClassName,
  itemClassName,
  slideWidth = "w-[84%]",
  tone = "light",
  className,
  as: List = "ul",
}: {
  children: ReactNode;
  /** accessible name of the carousel, e.g. "Why work with me" */
  label: string;
  /** layout from md up (grid / columns); the mobile track classes are dropped there */
  desktopClassName: string;
  itemClassName?: string;
  /** slide width on phones; < 100% so the next card peeks */
  slideWidth?: string;
  tone?: "light" | "dark";
  className?: string;
  as?: "ul" | "ol";
}) {
  const items = Children.toArray(children);
  const count = items.length;
  const mobile = useMediaQuery("(max-width: 767.98px)");
  const reduce = useReducedMotion();
  const track = useRef<HTMLUListElement & HTMLOListElement>(null);
  const [active, setActive] = useState(0);

  // Which slide is "current": the one most in view inside the track.
  useEffect(() => {
    const el = track.current;
    if (!el || !mobile) return;
    const slides = Array.from(el.children) as HTMLElement[];
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) setActive(slides.indexOf(e.target as HTMLElement));
        }
      },
      { root: el, threshold: 0.6 },
    );
    slides.forEach((s) => io.observe(s));
    return () => io.disconnect();
  }, [mobile, count]);

  const goTo = (i: number) => {
    const el = track.current;
    const slide = el?.children[Math.max(0, Math.min(count - 1, i))] as HTMLElement | undefined;
    if (!el || !slide) return;
    const pad = parseFloat(getComputedStyle(el).scrollPaddingLeft) || 0;
    const left = el.scrollLeft + slide.getBoundingClientRect().left - el.getBoundingClientRect().left - pad;
    el.scrollTo({ left, behavior: reduce ? "auto" : "smooth" });
  };

  const dark = tone === "dark";
  const carousel = mobile && count > 1;

  return (
    <div
      className={className}
      role={carousel ? "region" : undefined}
      aria-roledescription={carousel ? "carousel" : undefined}
      aria-label={carousel ? label : undefined}
    >
      <List
        ref={track}
        className={cn(
          // phone track
          "sb-snap-row -mx-[var(--gutter)] flex snap-x snap-mandatory gap-4 overflow-x-auto overscroll-x-contain scroll-px-(--gutter) px-(--gutter) pb-2 pt-2",
          // tablet/desktop: hand over to the section's layout
          "md:mx-0 md:snap-none md:overflow-visible md:px-0 md:pb-0 md:pt-0",
          desktopClassName,
        )}
      >
        {items.map((child, i) => (
          <li
            key={i}
            className={cn(slideWidth, "shrink-0 snap-start md:w-auto md:shrink", itemClassName)}
            aria-roledescription={carousel ? "slide" : undefined}
            aria-label={carousel ? `${i + 1} of ${count}` : undefined}
          >
            {child}
          </li>
        ))}
      </List>

      {count > 1 ? (
        <div className="mt-4 flex items-center gap-2 md:hidden">
          <button
            type="button"
            onClick={() => goTo(active - 1)}
            disabled={active === 0}
            aria-label="Previous"
            className={cn(
              "grid size-11 shrink-0 place-items-center rounded-full border transition-[opacity,transform] duration-150 active:scale-95 disabled:opacity-35",
              dark ? "border-(--cream)/60 text-(--cream)" : "border-(--ink-soft) text-(--ink)",
            )}
          >
            <ChevronLeft className="size-5" aria-hidden />
          </button>
          <div className="flex min-w-0 flex-1 items-center justify-center" aria-hidden>
            {items.map((_, i) => (
              <span
                key={i}
                className={cn(
                  "h-1.5 rounded-full transition-[width,background-color] duration-200",
                  i === active ? "w-5" : "w-1.5",
                  i === active ? (dark ? "bg-(--cream)" : "bg-(--rose-deep)") : dark ? "bg-(--cream)/40" : "bg-(--ink)/25",
                  "mx-[3px]",
                )}
              />
            ))}
          </div>
          <p className={cn("sr-only")} aria-live="polite">
            {carousel ? `Slide ${active + 1} of ${count}` : ""}
          </p>
          <span className={cn("w-11 text-center text-xs font-semibold tabular-nums", dark ? "text-(--cream)" : "text-(--ink-soft)")} aria-hidden>
            {active + 1}/{count}
          </span>
          <button
            type="button"
            onClick={() => goTo(active + 1)}
            disabled={active === count - 1}
            aria-label="Next"
            className={cn(
              "grid size-11 shrink-0 place-items-center rounded-full border transition-[opacity,transform] duration-150 active:scale-95 disabled:opacity-35",
              dark ? "border-(--cream)/60 text-(--cream)" : "border-(--ink-soft) text-(--ink)",
            )}
          >
            <ChevronRight className="size-5" aria-hidden />
          </button>
        </div>
      ) : null}
    </div>
  );
}
