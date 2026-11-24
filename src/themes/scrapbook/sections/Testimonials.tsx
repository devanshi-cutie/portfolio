import type { SectionConfig, SiteContent, Testimonial } from "@/core/types/content";
import { SectionHeading } from "../components/SectionHeading";
import { SwipeList } from "../components/SwipeList";
import { hash, jitter } from "../lib/seed";
import { Reveal } from "../motion/Reveal";
import { stagger } from "../motion/stagger";

/** A deterministic torn bottom edge for a paper note. */
function tornEdge(id: string): string {
  const pts: string[] = ["0% 0%", "100% 0%"];
  const steps = 18;
  for (let i = steps; i >= 0; i--) {
    const x = (i / steps) * 100;
    const y = 100 - hash(`${id}:${i}`) * 2.6;
    pts.push(`${x.toFixed(1)}% calc(${y.toFixed(2)}% - ${(hash(`${id}~${i}`) * 6).toFixed(1)}px)`);
  }
  return `polygon(${pts.join(", ")})`;
}

function attribution(t: Testimonial, brand: string | null) {
  const primary = t.authorName || t.authorRole || "Brand partner";
  const secondary = t.authorName ? [t.authorRole, brand].filter(Boolean).join(", ") : brand;
  return { primary, secondary };
}

export function Testimonials({ content, section }: { content: SiteContent; section: SectionConfig }) {
  const items = content.testimonials.filter((t) => t.quote);
  if (!items.length) return null;
  const brandName = (id: string | null) => (id ? (content.brands.find((b) => b.id === id)?.name ?? null) : null);

  return (
    <section id="testimonials" aria-labelledby="testimonials-title" className="relative px-(--gutter) py-12 md:py-28">
      <div className="mx-auto max-w-[1320px]">
        <SectionHeading id="testimonials-title" section={section} align="center" />
        <SwipeList
          label={section.title || "Testimonials"}
          className="mx-auto mt-10 max-w-[1120px] md:mt-14"
          desktopClassName="md:block md:columns-2 md:gap-10"
          itemClassName="md:mb-12 md:break-inside-avoid"
          slideWidth="w-[88%]"
        >
          {items.map((t, i) => {
            const { primary, secondary } = attribution(t, brandName(t.brandId));
            return (
              <Reveal amount={0} key={t.id} delay={stagger(i, 0.06)} className="h-full pt-3">
                <figure
                  className="relative drop-shadow-[0_16px_20px_rgb(44_17_25/0.14)]"
                  style={{ rotate: `${jitter(t.id, 1.4)}deg` }}
                >
                  <span aria-hidden className="sb-tape absolute -top-3 left-8 z-[1] block h-6 w-24 rotate-[-4deg]" />
                  <div className="bg-(--card) px-6 pb-12 pt-8 md:px-10 md:pt-10" style={{ clipPath: tornEdge(t.id) }}>
                    <span aria-hidden className="sb-serif block h-10 text-[4.5rem] leading-none text-(--rose-deep)">
                      &ldquo;
                    </span>
                    <blockquote className="sb-serif text-[1.0625rem] italic leading-[1.6] text-(--ink) md:text-[1.2rem] md:leading-[1.65]">
                      <p>{t.quote}</p>
                    </blockquote>
                    <figcaption className="mt-6 flex items-center gap-3">
                      <span aria-hidden className="h-px w-8 bg-(--rose-deep)" />
                      <span>
                        <span className="block text-sm font-bold">{primary}</span>
                        {secondary ? <span className="block text-sm text-(--ink-soft)">{secondary}</span> : null}
                      </span>
                    </figcaption>
                  </div>
                </figure>
              </Reveal>
            );
          })}
        </SwipeList>
      </div>
    </section>
  );
}
