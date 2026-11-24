import type { SectionConfig, SiteContent } from "@/core/types/content";
import { SectionHeading } from "../components/SectionHeading";
import { cn } from "../lib/cn";
import { jitter } from "../lib/seed";
import { CountUp } from "../motion/CountUp";
import { Reveal } from "../motion/Reveal";
import { stagger } from "../motion/stagger";

/** Numbers as postmarks: a double ring, the figure counting up inside. */
export function Stats({ content, section }: { content: SiteContent; section: SectionConfig }) {
  const stats = content.settings.stats.filter((s) => s.value);
  if (!stats.length) return null;

  return (
    <section id="stats" aria-labelledby="stats-title" className="relative bg-(--cream-2) px-(--gutter) py-12 md:py-24">
      <div className="mx-auto max-w-[1320px]">
        <SectionHeading id="stats-title" section={section} align="center" size="md" />
        <ul className="mx-auto mt-10 grid md:mt-14 max-w-[1100px] grid-cols-2 gap-x-5 gap-y-8 md:grid-cols-4 md:gap-y-12">
          {stats.map((s, i) => (
            <Reveal as="li" key={s.label} delay={stagger(i, 0.06)} className="flex flex-col items-center text-center">
              <div
                className="grid aspect-square w-full max-w-[136px] place-items-center rounded-full border-2 border-(--rose-deep) p-1.5 md:max-w-[200px] md:p-2"
                style={{ rotate: `${jitter(s.label, 5)}deg` }}
              >
                <div className="grid size-full place-items-center rounded-full border border-dashed border-(--rose-deep)/60 bg-(--cream)">
                  <p
                    className={cn(
                      "sb-display px-2 text-(--rose-deep)",
                      s.value.length > 4 ? "text-[clamp(1.4rem,3.6vw,2.6rem)]" : "text-[clamp(2.1rem,5.5vw,3.9rem)]",
                    )}
                  >
                    <CountUp value={s.value} />
                  </p>
                </div>
              </div>
              <p className="mt-4 max-w-[18ch] text-[0.95rem] font-semibold leading-snug">{s.label}</p>
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  );
}
