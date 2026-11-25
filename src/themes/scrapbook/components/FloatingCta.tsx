"use client";

/**
 * Phones: a thumb-reach "Let's create together" pill that appears once the
 * hero has scrolled away and hides again while the contact section (or the
 * footer) is on screen. Respects the home-indicator safe area. Slides up
 * 250ms ease-out, leaves 150ms ease-in; reduced motion: fade only.
 */
import { ArrowRight } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { trackAttr } from "@/core/lib/track-events";
import { EASE_IN, EASE_OUT } from "../motion/easing";

export function FloatingCta({ label, href = "#contact" }: { label: string; href?: string }) {
  const reduce = useReducedMotion();
  const [pastHero, setPastHero] = useState(false);
  const [nearEnd, setNearEnd] = useState(false);

  useEffect(() => {
    const hero = document.getElementById("hero");
    const ends = [document.getElementById("contact"), document.querySelector("footer")].filter(Boolean) as Element[];
    const seen = new Map<Element, boolean>();
    const heroIo = new IntersectionObserver(([e]) => setPastHero(!e.isIntersecting && e.boundingClientRect.top < 0), {
      threshold: 0,
    });
    const endIo = new IntersectionObserver(
      (entries) => {
        for (const e of entries) seen.set(e.target, e.isIntersecting);
        setNearEnd([...seen.values()].some(Boolean));
      },
      { threshold: 0, rootMargin: "0px 0px -10% 0px" },
    );
    // Without a hero section the pill stays hidden (the page is short anyway).
    if (hero) heroIo.observe(hero);
    ends.forEach((el) => endIo.observe(el));
    return () => {
      heroIo.disconnect();
      endIo.disconnect();
    };
  }, []);

  const show = pastHero && !nearEnd;

  return (
    <AnimatePresence>
      {show ? (
        <motion.div
          key="cta"
          className="pointer-events-none fixed inset-x-0 z-40 flex justify-center px-4 md:hidden"
          style={{ bottom: "calc(0.875rem + env(safe-area-inset-bottom))" }}
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0, transition: { duration: 0.25, ease: EASE_OUT } }}
          exit={reduce ? { opacity: 0, transition: { duration: 0.12 } } : { opacity: 0, y: 24, transition: { duration: 0.15, ease: EASE_IN } }}
        >
          <Link
            href={href}
            data-track={trackAttr("cta_click", "floating")}
            className="pointer-events-auto inline-flex min-h-12 items-center gap-2 rounded-full bg-(--rose-deep) px-6 text-[0.95rem] font-semibold text-(--cream) shadow-[0_14px_30px_-10px_rgb(44_17_25/0.55)] transition-[background-color,transform] duration-150 active:scale-[0.97]"
          >
            {label}
            <ArrowRight className="size-4" aria-hidden />
          </Link>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
