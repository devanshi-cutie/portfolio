import type { CSSProperties } from "react";
import type { SectionConfig, SiteContent } from "@/core/types/content";
import { Heart, Squiggle, Star } from "../components/Doodles";
import { SectionHeading } from "../components/SectionHeading";
import { SwipeList } from "../components/SwipeList";
import { cn } from "../lib/cn";
import { jitter } from "../lib/seed";
import { Reveal } from "../motion/Reveal";
import { stagger } from "../motion/stagger";

// Paper stock per stamp, cycled. One burgundy stamp breaks the rhythm.
const STOCKS = [
  { bg: "bg-(--card)", text: "text-(--ink)", accent: "text-(--rose-deep)", dark: false },
  { bg: "bg-(--blush)", text: "text-(--ink)", accent: "text-(--rose-deeper)", dark: false },
  { bg: "bg-(--cream-2)", text: "text-(--ink)", accent: "text-(--rose-deep)", dark: false },
  { bg: "bg-(--rose-deep)", text: "text-(--cream)", accent: "text-(--blush)", dark: true },
  { bg: "bg-(--card)", text: "text-(--ink)", accent: "text-(--terracotta)", dark: false },
  { bg: "bg-(--blush)", text: "text-(--ink)", accent: "text-(--rose-deeper)", dark: false },
];
const MARKS = [Star, Heart, Squiggle];

export function Highlights({ content, section }: { content: SiteContent; section: SectionConfig }) {
  const items = content.settings.highlights.filter((h) => h.title);
  if (!items.length) return null;

  return (
    <section id="highlights" aria-labelledby="highlights-title" className="relative px-(--gutter) py-12 md:py-28">
      <div className="mx-auto max-w-[1320px]">
        <SectionHeading id="highlights-title" section={section} />
        <SwipeList
          label={section.title || "Highlights"}
          className="mt-10 md:mt-14"
          desktopClassName="md:grid md:grid-cols-2 md:gap-x-7 md:gap-y-9 lg:grid-cols-3"
        >
          {items.map((h, i) => {
            const stock = STOCKS[i % STOCKS.length];
            const Mark = MARKS[i % MARKS.length];
            return (
              <Reveal amount={0} key={h.title} delay={stagger(i)} className="h-full drop-shadow-[0_14px_18px_rgb(44_17_25/0.16)]">
                <article
                  className={cn("sb-stamp h-full", stock.bg, stock.dark && "sb-on-dark")}
                  style={{ rotate: `${jitter(h.title, 1.6)}deg` } as CSSProperties}
                >
                  <div
                    className={cn(
                      "flex h-full flex-col border border-dashed p-6 md:p-7",
                      stock.dark ? "border-(--cream)/35" : "border-(--rose-deep)/30",
                      stock.text,
                    )}
                  >
                    <Mark className={cn("size-8", stock.accent)} />
                    <h3 className="sb-display mt-4 text-[clamp(1.75rem,3vw,2.4rem)] md:mt-5">{h.title}</h3>
                    <p className={cn("mt-3 text-[0.98rem] leading-relaxed", stock.dark ? "text-(--cream)" : "text-(--ink-soft)")}>
                      {h.body}
                    </p>
                  </div>
                </article>
              </Reveal>
            );
          })}
        </SwipeList>
      </div>
    </section>
  );
}
